import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import type { DungeonUnlockNode } from '../lib/schema'

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; data: DungeonUnlockNode[] }
  | { kind: 'error'; message: string }

type PositionedNode = DungeonUnlockNode & {
  depth: number
  x: number
  y: number
}

const NODE_WIDTH = 240
const NODE_HEIGHT = 96
const COLUMN_GAP = 84
const ROW_GAP = 24
const CANVAS_PADDING = 32

export function DungeonUnlockFlowPage() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/dungeon-unlocks')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as DungeonUnlockNode[]
        if (!cancelled) setState({ kind: 'ready', data })
      } catch (err) {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: err instanceof Error ? err.message : String(err),
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const graph = useMemo(() => {
    if (state.kind !== 'ready') return null
    return buildUnlockLayout(state.data)
  }, [state])

  if (state.kind === 'loading') return <p className="state-msg">読み込み中…</p>
  if (state.kind === 'error') {
    return <p className="state-msg error">読み込みに失敗しました: {state.message}</p>
  }
  if (!graph) return null

  return (
    <div className="detail">
      <div className="detail-head">
        <div>
          <h2>エリア解放フロー</h2>
          <p className="subtle">エリア間の解放関係を図で確認できます。カードを押すと詳細へ移動します。</p>
        </div>
      </div>

      <section className="card unlock-flow-card">
        <div className="unlock-flow-legend">
          <span className="unlock-chip">開始地点</span>
          <span className="unlock-chip branch">分岐あり</span>
          <span className="unlock-chip capture">拠点化</span>
        </div>

        <div className="unlock-flow-scroll">
          <div
            className="unlock-flow-canvas"
            style={{ width: `${graph.width}px`, height: `${graph.height}px` }}
          >
            <svg
              className="unlock-flow-svg"
              width={graph.width}
              height={graph.height}
              viewBox={`0 0 ${graph.width} ${graph.height}`}
              aria-hidden="true"
            >
              <defs>
                <marker
                  id="unlock-arrow"
                  markerWidth="10"
                  markerHeight="10"
                  refX="8"
                  refY="5"
                  orient="auto"
                >
                  <path d="M0,0 L10,5 L0,10 z" fill="#b7b0a5" />
                </marker>
              </defs>
              {graph.edges.map((edge) => (
                <path
                  key={`${edge.from.areaId}-${edge.to.areaId}`}
                  d={buildEdgePath(edge.from, edge.to)}
                  className="unlock-flow-edge"
                  markerEnd="url(#unlock-arrow)"
                />
              ))}
            </svg>

            {graph.nodes.map((node) => {
              const branchCount = graph.outgoingCount.get(node.areaId) ?? 0
              return (
                <Link
                  key={node.areaId}
                  to={`/dungeons/${node.areaId}`}
                  className={[
                    'unlock-node',
                    node.unlocked ? 'is-root' : '',
                    node.isBaseCapture ? 'is-capture' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{
                    width: `${NODE_WIDTH}px`,
                    minHeight: `${NODE_HEIGHT}px`,
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                  }}
                >
                  <div className="unlock-node-head">
                    <strong>{node.name}</strong>
                    <span className="subtle">Lv{node.areaLevel}</span>
                  </div>
                  <div className="unlock-node-id">
                    <code>{node.areaId}</code>
                  </div>
                  <div className="unlock-node-meta">
                    {node.unlockRequires ? (
                      <span>← {node.unlockRequires}</span>
                    ) : (
                      <span>開始地点</span>
                    )}
                    {branchCount > 1 && <span>分岐 {branchCount}</span>}
                    {node.isBaseCapture && <span>拠点化</span>}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}

function buildUnlockLayout(nodes: DungeonUnlockNode[]) {
  const nodeMap = new Map(nodes.map((node) => [node.areaId, node]))
  const depthCache = new Map<string, number>()

  const getDepth = (areaId: string): number => {
    const cached = depthCache.get(areaId)
    if (cached !== undefined) return cached

    const node = nodeMap.get(areaId)
    if (!node?.unlockRequires || !nodeMap.has(node.unlockRequires)) {
      depthCache.set(areaId, 0)
      return 0
    }

    const depth = getDepth(node.unlockRequires) + 1
    depthCache.set(areaId, depth)
    return depth
  }

  const sorted = [...nodes].sort(
    (a, b) =>
      getDepth(a.areaId) - getDepth(b.areaId) ||
      a.areaLevel - b.areaLevel ||
      a.areaId.localeCompare(b.areaId),
  )

  const byDepth = new Map<number, DungeonUnlockNode[]>()
  for (const node of sorted) {
    const depth = getDepth(node.areaId)
    const list = byDepth.get(depth) ?? []
    list.push(node)
    byDepth.set(depth, list)
  }

  const positioned: PositionedNode[] = []
  for (const [depth, group] of [...byDepth.entries()].sort((a, b) => a[0] - b[0])) {
    group.forEach((node, index) => {
      positioned.push({
        ...node,
        depth,
        x: CANVAS_PADDING + depth * (NODE_WIDTH + COLUMN_GAP),
        y: CANVAS_PADDING + index * (NODE_HEIGHT + ROW_GAP),
      })
    })
  }

  const positionedMap = new Map(positioned.map((node) => [node.areaId, node]))
  const edges: Array<{ from: PositionedNode; to: PositionedNode }> = []
  const outgoingCount = new Map<string, number>()

  for (const node of positioned) {
    const nextIds = [node.unlockNext, ...node.unlockNexts].filter(
      (value, index, array): value is string => Boolean(value) && array.indexOf(value) === index,
    )

    outgoingCount.set(node.areaId, nextIds.length)

    for (const nextId of nextIds) {
      const target = positionedMap.get(nextId)
      if (!target) continue
      edges.push({ from: node, to: target })
    }
  }

  const maxDepth = Math.max(...positioned.map((node) => node.depth), 0)
  const maxRows = Math.max(...[...byDepth.values()].map((group) => group.length), 1)

  return {
    nodes: positioned,
    edges,
    outgoingCount,
    width: CANVAS_PADDING * 2 + (maxDepth + 1) * NODE_WIDTH + maxDepth * COLUMN_GAP,
    height: CANVAS_PADDING * 2 + maxRows * NODE_HEIGHT + (maxRows - 1) * ROW_GAP,
  }
}

function buildEdgePath(from: PositionedNode, to: PositionedNode): string {
  const startX = from.x + NODE_WIDTH
  const startY = from.y + NODE_HEIGHT / 2
  const endX = to.x
  const endY = to.y + NODE_HEIGHT / 2
  const deltaX = endX - startX
  const controlOffset = Math.max(24, deltaX * 0.45)

  return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`
}
