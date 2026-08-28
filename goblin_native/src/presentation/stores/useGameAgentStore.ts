import { create } from 'zustand'
import type {
  GameAgentActionEnvelope,
  GameAgentActionResult,
  GameAgentLogEntry,
} from '../../core/agent'

export type GameAgentConnectionStatus = 'disabled' | 'connecting' | 'connected' | 'disconnected'

interface GameAgentState {
  connectionStatus: GameAgentConnectionStatus
  bridgeUrl: string | null
  revision: number
  reconnectNonce: number
  lastSnapshotAt: string | null
  logs: GameAgentLogEntry[]
}

interface GameAgentActions {
  setConnectionStatus: (status: GameAgentConnectionStatus) => void
  setBridgeUrl: (url: string | null) => void
  nextRevision: () => number
  markSnapshotSent: (capturedAt: string) => void
  addActionResult: (envelope: GameAgentActionEnvelope, result: GameAgentActionResult) => void
  requestReconnect: () => void
  clearLogs: () => void
}

const MAX_AGENT_LOGS = 100

export const useGameAgentStore = create<GameAgentState & GameAgentActions>()((set, get) => ({
  connectionStatus: 'disabled',
  bridgeUrl: null,
  revision: 0,
  reconnectNonce: 0,
  lastSnapshotAt: null,
  logs: [],

  setConnectionStatus: connectionStatus => set({ connectionStatus }),
  setBridgeUrl: bridgeUrl => set({ bridgeUrl }),
  nextRevision: () => {
    const revision = get().revision + 1
    set({ revision })
    return revision
  },
  markSnapshotSent: lastSnapshotAt => set({ lastSnapshotAt }),
  addActionResult: (envelope, result) => set(state => ({
    logs: [
      {
        ...result,
        actionType: result.actionType ?? envelope.action.type,
        reason: envelope.reason,
      },
      ...state.logs,
    ].slice(0, MAX_AGENT_LOGS),
  })),
  requestReconnect: () => set(state => ({ reconnectNonce: state.reconnectNonce + 1 })),
  clearLogs: () => set({ logs: [] }),
}))

