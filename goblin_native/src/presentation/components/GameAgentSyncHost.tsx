import { useCallback, useEffect, useRef } from 'react'
import {
  buildGameAgentObservation,
  GAME_AGENT_PROTOCOL_VERSION,
} from '../../core/agent'
import type {
  GameAgentActionEnvelope,
  GameAgentActionResult,
  GameAgentBridgeOutboundMessage,
} from '../../core/agent'
import { equipmentRepository } from '../di/repositories'
import { executeGameAgentAction } from '../agent/executeGameAgentAction'
import { parseGameAgentBridgeMessage } from '../agent/parseGameAgentMessage'
import { useExpeditionFlow } from '../hooks/useExpeditionFlow'
import { useBaseStore } from '../stores/useBaseStore'
import { useDungeonStore } from '../stores/useDungeonStore'
import { useExpeditionStore } from '../stores/useExpeditionStore'
import { useGameAgentStore } from '../stores/useGameAgentStore'
import { useGoblinStore } from '../stores/useGoblinStore'
import { usePartyStore } from '../stores/usePartyStore'
import { useTutorialStore } from '../stores/useTutorialStore'

const DEFAULT_DEV_BRIDGE_URL = 'ws://127.0.0.1:8787/v1/game'
const RECONNECT_DELAY_MS = 2000
const SNAPSHOT_DEBOUNCE_MS = 150

function getBridgeUrl(): string | null {
  const configured = process.env.EXPO_PUBLIC_GOBLIN_AI_BRIDGE_URL?.trim()
  if (configured) return configured
  return __DEV__ ? DEFAULT_DEV_BRIDGE_URL : null
}

function withBridgeToken(url: string): string {
  const token = process.env.EXPO_PUBLIC_GOBLIN_AI_BRIDGE_TOKEN?.trim()
  if (!token) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}token=${encodeURIComponent(token)}`
}

function sendMessage(socket: WebSocket | null, message: GameAgentBridgeOutboundMessage): boolean {
  if (!socket || socket.readyState !== 1) return false
  socket.send(JSON.stringify(message))
  return true
}

function getActionIdFromInvalidMessage(raw: string): string {
  try {
    const value = JSON.parse(raw) as { payload?: { actionId?: unknown } }
    return typeof value.payload?.actionId === 'string' ? value.payload.actionId : 'invalid-message'
  } catch {
    return 'invalid-message'
  }
}

/**
 * AIブリッジとの接続を常駐させ、コマンドを既存UseCaseへ流してUI Storeと同期する。
 */
export function GameAgentSyncHost() {
  const { startExpedition, abortExpedition } = useExpeditionFlow()
  const reconnectNonce = useGameAgentStore(state => state.reconnectNonce)
  const socketRef = useRef<WebSocket | null>(null)
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapshotInFlightRef = useRef(false)
  const snapshotPendingRef = useRef(false)
  const commandRunningRef = useRef(false)
  const actionQueueRef = useRef<Promise<void>>(Promise.resolve())

  const sendSnapshot = useCallback(async () => {
    if (commandRunningRef.current) {
      snapshotPendingRef.current = true
      return
    }
    if (snapshotInFlightRef.current) {
      snapshotPendingRef.current = true
      return
    }
    if (!socketRef.current || socketRef.current.readyState !== 1) return

    snapshotInFlightRef.current = true
    try {
      const equipment = await equipmentRepository.getAll()
      const revision = useGameAgentStore.getState().nextRevision()
      const observation = buildGameAgentObservation({
        revision,
        tutorialStep: useTutorialStore.getState().step,
        baseState: useBaseStore.getState().baseState,
        goblins: useGoblinStore.getState().goblins,
        parties: usePartyStore.getState().parties,
        dungeons: useDungeonStore.getState().dungeons,
        expeditions: useExpeditionStore.getState().expeditionRecords.slice(0, 50),
        equipment,
      })
      const sent = sendMessage(socketRef.current, { type: 'snapshot', payload: observation })
      if (sent) {
        useGameAgentStore.getState().markSnapshotSent(observation.capturedAt)
      }
    } catch (error) {
      console.warn('[GameAgentSyncHost] Failed to build snapshot', error)
    } finally {
      snapshotInFlightRef.current = false
      if (snapshotPendingRef.current) {
        snapshotPendingRef.current = false
        void sendSnapshot()
      }
    }
  }, [])

  const scheduleSnapshot = useCallback(() => {
    if (commandRunningRef.current) {
      snapshotPendingRef.current = true
      return
    }
    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current)
    snapshotTimerRef.current = setTimeout(() => {
      snapshotTimerRef.current = null
      void sendSnapshot()
    }, SNAPSHOT_DEBOUNCE_MS)
  }, [sendSnapshot])

  const executeEnvelope = useCallback(async (envelope: GameAgentActionEnvelope) => {
    commandRunningRef.current = true
    const result = await executeGameAgentAction(envelope, { startExpedition, abortExpedition })
    useGameAgentStore.getState().addActionResult(envelope, result)
    commandRunningRef.current = false
    snapshotPendingRef.current = false
    await sendSnapshot()
    // snapshotを先に送ることで、HTTP応答直後のobservationも更新済みにする。
    sendMessage(socketRef.current, { type: 'action_result', payload: result })
  }, [abortExpedition, sendSnapshot, startExpedition])

  useEffect(() => {
    const subscriptions = [
      useBaseStore.subscribe(scheduleSnapshot),
      useGoblinStore.subscribe(scheduleSnapshot),
      usePartyStore.subscribe(scheduleSnapshot),
      useDungeonStore.subscribe(scheduleSnapshot),
      useExpeditionStore.subscribe(scheduleSnapshot),
      useTutorialStore.subscribe(scheduleSnapshot),
    ]
    return () => {
      subscriptions.forEach(unsubscribe => unsubscribe())
      if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current)
    }
  }, [scheduleSnapshot])

  useEffect(() => {
    const bridgeUrl = getBridgeUrl()
    useGameAgentStore.getState().setBridgeUrl(bridgeUrl)
    if (!bridgeUrl) {
      useGameAgentStore.getState().setConnectionStatus('disabled')
      return
    }

    let disposed = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      if (disposed) return
      useGameAgentStore.getState().setConnectionStatus('connecting')
      const socket = new WebSocket(withBridgeToken(bridgeUrl))
      socketRef.current = socket

      socket.onopen = () => {
        if (disposed) return
        useGameAgentStore.getState().setConnectionStatus('connected')
        sendMessage(socket, {
          type: 'register',
          role: 'game',
          protocolVersion: GAME_AGENT_PROTOCOL_VERSION,
        })
        void sendSnapshot()
      }

      socket.onmessage = event => {
        const raw = typeof event.data === 'string' ? event.data : String(event.data)
        try {
          const message = parseGameAgentBridgeMessage(raw)
          actionQueueRef.current = actionQueueRef.current.then(
            () => executeEnvelope(message.payload),
            () => executeEnvelope(message.payload),
          )
        } catch (error) {
          const result: GameAgentActionResult = {
            actionId: getActionIdFromInvalidMessage(raw),
            status: 'rejected',
            summary: error instanceof Error ? error.message : '不正なAIコマンドです',
            completedAt: new Date().toISOString(),
          }
          sendMessage(socketRef.current, { type: 'action_result', payload: result })
        }
      }

      socket.onerror = () => {
        if (!disposed) useGameAgentStore.getState().setConnectionStatus('disconnected')
      }

      socket.onclose = () => {
        if (socketRef.current === socket) socketRef.current = null
        if (disposed) return
        useGameAgentStore.getState().setConnectionStatus('disconnected')
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
      }
    }

    connect()
    return () => {
      disposed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      const socket = socketRef.current
      socketRef.current = null
      socket?.close()
    }
  }, [executeEnvelope, reconnectNonce, sendSnapshot])

  return null
}
