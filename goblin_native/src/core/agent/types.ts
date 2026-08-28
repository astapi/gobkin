import type {
  Dungeon,
  DungeonTier,
  EquipmentInstance,
  ExpeditionRecord,
  ExpeditionRequest,
  Goblin,
  Party,
  BaseState,
} from '../../shared/types'
import type { TutorialStep } from '../../shared/types/Tutorial'

export const GAME_AGENT_PROTOCOL_VERSION = 1 as const

export type GameAgentAction =
  | {
      type: 'set_party_members'
      partyId: number
      memberIds: number[]
    }
  | {
      type: 'configure_expedition'
      partyId: number
      dungeonId: string
      tier?: DungeonTier
      targetFloor?: number | null
      returnPolicy?: ExpeditionRequest['returnPolicy']
    }
  | {
      type: 'set_auto_expedition'
      partyId: number
      enabled: boolean
    }
  | {
      type: 'start_expedition'
      partyId: number
      useGoldenAcorn?: boolean
    }
  | {
      type: 'abort_expedition'
      expeditionId: string
    }
  | {
      type: 'rank_up'
    }

export interface GameAgentActionEnvelope {
  actionId: string
  action: GameAgentAction
  /** 観戦ログへ表示するAIの判断理由。ゲームロジックには使用しない。 */
  reason?: string
}

export type GameAgentActionStatus = 'completed' | 'rejected' | 'failed'

export interface GameAgentActionResult {
  actionId: string
  status: GameAgentActionStatus
  summary: string
  actionType?: GameAgentAction['type']
  completedAt: string
}

export interface GameAgentLogEntry extends GameAgentActionResult {
  reason?: string
}

export interface GameAgentActionDefinition {
  type: GameAgentAction['type']
  description: string
  parameters: Record<string, string>
}

export interface GameAgentObservation {
  protocolVersion: typeof GAME_AGENT_PROTOCOL_VERSION
  revision: number
  capturedAt: string
  tutorial: {
    step: TutorialStep
    requiredExpedition: {
      dungeonId: 'slime_cave'
      tier: 0
      targetFloor: null
      returnPolicy: 'never'
    } | null
  }
  base: Pick<
    BaseState,
    'rank' | 'gold' | 'capacity' | 'currentMaxParties' | 'currentMaxGoblins' | 'capturedDungeons'
  > | null
  goblins: Array<{
    id: number
    name: string
    race: string
    job?: Goblin['job']
    level: number
    experience: number
    currentHp: number
    stats: Goblin['stats']
    factors: string[]
    skillIds: string[]
  }>
  parties: Array<{
    id: number
    name: string
    memberIds: number[]
    status: NonNullable<Party['status']>
    dungeonId?: string
    dungeonTier: DungeonTier
    targetFloor: number | null
    returnPolicy: ExpeditionRequest['returnPolicy']
    autoExpeditionEnabled: boolean
  }>
  dungeons: Array<{
    id: string
    name: string
    floors: number
    areaLevel?: number
    unlocked: boolean
    cleared: boolean
    maxClearedTier: number
    maxClearedFloorsByTier: Record<number, number>
  }>
  expeditions: Array<{
    id: string
    partyId: number
    partyName: string
    dungeonId: string
    dungeonName: string
    status: ExpeditionRecord['status']
    startTime: string
    returnTime: string | null
    returnPolicy: ExpeditionRequest['returnPolicy']
  }>
  equipment: Array<{
    id: string
    templateId: string
    goblinId: number | null
    slotIndex: number
    titleId?: EquipmentInstance['titleId']
    prefixMod?: EquipmentInstance['prefixMod']
    suffixMod?: EquipmentInstance['suffixMod']
  }>
  actionCatalog: GameAgentActionDefinition[]
}

export interface BuildGameAgentObservationInput {
  revision: number
  capturedAt?: Date
  tutorialStep: TutorialStep
  baseState: BaseState | null
  goblins: Goblin[]
  parties: Party[]
  dungeons: Dungeon[]
  expeditions: ExpeditionRecord[]
  equipment: EquipmentInstance[]
}

export type GameAgentBridgeInboundMessage = {
  type: 'execute_action'
  payload: GameAgentActionEnvelope
}

export type GameAgentBridgeOutboundMessage =
  | {
      type: 'register'
      role: 'game'
      protocolVersion: typeof GAME_AGENT_PROTOCOL_VERSION
    }
  | {
      type: 'snapshot'
      payload: GameAgentObservation
    }
  | {
      type: 'action_result'
      payload: GameAgentActionResult
    }
