import type {
  GameAgentAction,
  GameAgentActionEnvelope,
  GameAgentBridgeInboundMessage,
} from '../../core/agent'
import type { DungeonTier } from '../../shared/types'

const RETURN_POLICIES = new Set(['if_any_ko', 'if_two_ko', 'last_one', 'never'])

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireInteger(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error(`${name}には整数が必要です`)
  }
  return value
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name}には空でない文字列が必要です`)
  }
  return value
}

function parseAction(value: unknown): GameAgentAction {
  if (!isObject(value)) throw new Error('actionが不正です')

  switch (value.type) {
    case 'set_party_members': {
      if (!Array.isArray(value.memberIds)) throw new Error('memberIdsには配列が必要です')
      return {
        type: value.type,
        partyId: requireInteger(value.partyId, 'partyId'),
        memberIds: value.memberIds.map((id, index) => requireInteger(id, `memberIds[${index}]`)),
      }
    }
    case 'configure_expedition': {
      const tier = value.tier === undefined ? undefined : requireInteger(value.tier, 'tier')
      const targetFloor = value.targetFloor === undefined || value.targetFloor === null
        ? value.targetFloor
        : requireInteger(value.targetFloor, 'targetFloor')
      if (value.returnPolicy !== undefined && !RETURN_POLICIES.has(String(value.returnPolicy))) {
        throw new Error('returnPolicyが不正です')
      }
      return {
        type: value.type,
        partyId: requireInteger(value.partyId, 'partyId'),
        dungeonId: requireString(value.dungeonId, 'dungeonId'),
        tier: tier as DungeonTier | undefined,
        targetFloor,
        returnPolicy: value.returnPolicy as Extract<GameAgentAction, { type: 'configure_expedition' }>['returnPolicy'],
      }
    }
    case 'set_auto_expedition':
      if (typeof value.enabled !== 'boolean') throw new Error('enabledにはbooleanが必要です')
      return {
        type: value.type,
        partyId: requireInteger(value.partyId, 'partyId'),
        enabled: value.enabled,
      }
    case 'start_expedition':
      if (value.useGoldenAcorn !== undefined && typeof value.useGoldenAcorn !== 'boolean') {
        throw new Error('useGoldenAcornにはbooleanが必要です')
      }
      return {
        type: value.type,
        partyId: requireInteger(value.partyId, 'partyId'),
        useGoldenAcorn: value.useGoldenAcorn,
      }
    case 'abort_expedition':
      return {
        type: value.type,
        expeditionId: requireString(value.expeditionId, 'expeditionId'),
      }
    case 'rank_up':
      return { type: value.type }
    default:
      throw new Error(`未対応のaction typeです: ${String(value.type)}`)
  }
}

export function parseGameAgentBridgeMessage(raw: string): GameAgentBridgeInboundMessage {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    throw new Error('JSONを解析できません')
  }
  if (!isObject(value) || value.type !== 'execute_action' || !isObject(value.payload)) {
    throw new Error('メッセージ形式が不正です')
  }

  const actionId = requireString(value.payload.actionId, 'actionId')
  const reason = value.payload.reason
  if (reason !== undefined && typeof reason !== 'string') {
    throw new Error('reasonには文字列が必要です')
  }

  const payload: GameAgentActionEnvelope = {
    actionId,
    action: parseAction(value.payload.action),
    reason,
  }
  return { type: 'execute_action', payload }
}
