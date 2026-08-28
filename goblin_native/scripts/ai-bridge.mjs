import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'

const host = process.env.GOBLIN_AI_BRIDGE_HOST?.trim() || '127.0.0.1'
const parsedPort = Number.parseInt(process.env.GOBLIN_AI_BRIDGE_PORT ?? '8787', 10)
const port = Number.isSafeInteger(parsedPort) && parsedPort > 0 ? parsedPort : 8787
const token = process.env.GOBLIN_AI_BRIDGE_TOKEN?.trim() || ''
const actionTimeoutMs = 30_000
const maxBodyBytes = 1024 * 1024
const maxLogs = 200

let gameSocket = null
let latestObservation = null
const actionLogs = []
const pendingActions = new Map()

function writeJson(response, statusCode, body) {
  const json = JSON.stringify(body)
  response.writeHead(statusCode, {
    'access-control-allow-headers': 'authorization, content-type, x-agent-token',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-origin': '*',
    'content-length': Buffer.byteLength(json),
    'content-type': 'application/json; charset=utf-8',
  })
  response.end(json)
}

function isAuthorized(request, requestUrl) {
  if (!token) return true
  const authorization = request.headers.authorization
  const headerToken = request.headers['x-agent-token']
  const queryToken = requestUrl.searchParams.get('token')
  return authorization === `Bearer ${token}` || headerToken === token || queryToken === token
}

async function readJsonBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBodyBytes) throw new Error('リクエスト本文が大きすぎます')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('JSONを解析できません')
  }
}

function normalizeActionRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('リクエスト本文にはJSON objectが必要です')
  }
  const actionId = typeof body.actionId === 'string' && body.actionId.trim()
    ? body.actionId
    : randomUUID()
  const reason = typeof body.reason === 'string' ? body.reason : undefined
  const action = body.action && typeof body.action === 'object' && !Array.isArray(body.action)
    ? body.action
    : Object.fromEntries(
        Object.entries(body).filter(([key]) => key !== 'actionId' && key !== 'reason'),
      )
  if (typeof action.type !== 'string' || !action.type) {
    throw new Error('action.typeが必要です')
  }
  return { actionId, action, reason }
}

function forwardAction(envelope) {
  return new Promise((resolve, reject) => {
    if (!gameSocket || gameSocket.readyState !== WebSocket.OPEN) {
      reject(new Error('ゲームアプリが接続されていません'))
      return
    }

    const timeout = setTimeout(() => {
      pendingActions.delete(envelope.actionId)
      reject(new Error('ゲームアプリからの応答がタイムアウトしました'))
    }, actionTimeoutMs)

    pendingActions.set(envelope.actionId, { resolve, reject, timeout, envelope })
    gameSocket.send(JSON.stringify({ type: 'execute_action', payload: envelope }))
  })
}

function rejectPendingActions(message) {
  for (const pending of pendingActions.values()) {
    clearTimeout(pending.timeout)
    pending.reject(new Error(message))
  }
  pendingActions.clear()
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

  if (request.method === 'OPTIONS') {
    writeJson(response, 204, {})
    return
  }
  if (!isAuthorized(request, requestUrl)) {
    writeJson(response, 401, { error: '認証に失敗しました' })
    return
  }

  try {
    if (request.method === 'GET' && requestUrl.pathname === '/v1/health') {
      writeJson(response, 200, {
        ok: true,
        gameConnected: Boolean(gameSocket && gameSocket.readyState === WebSocket.OPEN),
        hasObservation: latestObservation !== null,
      })
      return
    }

    if (request.method === 'GET' && requestUrl.pathname === '/v1/observation') {
      if (!latestObservation) {
        writeJson(response, 503, { error: 'ゲーム状態がまだ同期されていません' })
        return
      }
      writeJson(response, 200, latestObservation)
      return
    }

    if (request.method === 'GET' && requestUrl.pathname === '/v1/legal-actions') {
      if (!latestObservation) {
        writeJson(response, 503, { error: 'ゲーム状態がまだ同期されていません' })
        return
      }
      writeJson(response, 200, { actions: latestObservation.actionCatalog ?? [] })
      return
    }

    if (request.method === 'GET' && requestUrl.pathname === '/v1/action-log') {
      writeJson(response, 200, { actions: actionLogs })
      return
    }

    if (request.method === 'POST' && requestUrl.pathname === '/v1/actions') {
      const envelope = normalizeActionRequest(await readJsonBody(request))
      const completed = actionLogs.find(log => log.actionId === envelope.actionId)
      if (completed) {
        writeJson(response, completed.status === 'completed' ? 200 : 422, completed)
        return
      }
      if (pendingActions.has(envelope.actionId)) {
        writeJson(response, 409, {
          actionId: envelope.actionId,
          error: '同じactionIdの操作を処理中です',
        })
        return
      }
      try {
        const result = await forwardAction(envelope)
        writeJson(response, result.status === 'completed' ? 200 : 422, result)
      } catch (error) {
        writeJson(response, 503, {
          actionId: envelope.actionId,
          status: 'failed',
          summary: error instanceof Error ? error.message : 'AI操作の転送に失敗しました',
          completedAt: new Date().toISOString(),
        })
      }
      return
    }

    writeJson(response, 404, { error: 'エンドポイントが見つかりません' })
  } catch (error) {
    writeJson(response, 400, {
      error: error instanceof Error ? error.message : 'リクエストを処理できませんでした',
    })
  }
})

const webSocketServer = new WebSocketServer({ noServer: true })

server.on('upgrade', (request, socket, head) => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  if (requestUrl.pathname !== '/v1/game' || !isAuthorized(request, requestUrl)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
    socket.destroy()
    return
  }
  webSocketServer.handleUpgrade(request, socket, head, client => {
    webSocketServer.emit('connection', client, request)
  })
})

webSocketServer.on('connection', socket => {
  if (gameSocket && gameSocket.readyState === WebSocket.OPEN) {
    gameSocket.close(1012, '別のゲームアプリが接続しました')
  }
  gameSocket = socket
  latestObservation = null

  socket.on('message', data => {
    let message
    try {
      message = JSON.parse(data.toString())
    } catch {
      return
    }

    if (message?.type === 'snapshot' && message.payload) {
      latestObservation = message.payload
      return
    }

    if (message?.type === 'action_result' && message.payload?.actionId) {
      const result = message.payload
      const pending = pendingActions.get(result.actionId)
      const log = {
        ...result,
        reason: pending?.envelope.reason,
      }
      actionLogs.unshift(log)
      actionLogs.splice(maxLogs)
      if (pending) {
        clearTimeout(pending.timeout)
        pendingActions.delete(result.actionId)
        pending.resolve(result)
      }
    }
  })

  socket.on('close', () => {
    if (gameSocket !== socket) return
    gameSocket = null
    latestObservation = null
    rejectPendingActions('ゲームアプリとの接続が切れました')
  })
})

server.listen(port, host, () => {
  const authLabel = token ? 'token認証あり' : '認証なし・ローカル接続専用'
  console.log(`Goblin AI Bridge: http://${host}:${port} (${authLabel})`)
})

function shutdown() {
  rejectPendingActions('AIブリッジを終了しています')
  gameSocket?.close(1001, 'AIブリッジ終了')
  webSocketServer.close()
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
