import type {
  Dungeon,
  ExpeditionRecord,
  ExpeditionRequest,
  Party,
} from '../../shared/types'
import { DUNGEON_TIER_SELECTABLE_MAX } from '../../shared/types'
import { isAutoExpeditionDungeonCleared } from '../../shared/utils/autoExpedition'
import type {
  GameAgentActionEnvelope,
  GameAgentActionResult,
} from '../../core/agent'
import { getTutorialExpeditionConfigError } from '../../core/agent'
import { useBaseStore } from '../stores/useBaseStore'
import { useDungeonStore } from '../stores/useDungeonStore'
import { useExpeditionStore } from '../stores/useExpeditionStore'
import { useGoblinStore } from '../stores/useGoblinStore'
import { usePartyStore } from '../stores/usePartyStore'
import { useTutorialStore } from '../stores/useTutorialStore'

interface GameAgentExpeditionHandlers {
  startExpedition: (input: {
    party: Party
    dungeon: Dungeon
    returnPolicy: ExpeditionRequest['returnPolicy']
    targetFloor?: number | null
    tier?: Party['dungeonTier']
    useGoldenAcorn?: boolean
  }) => Promise<{ record: ExpeditionRecord }>
  abortExpedition: (record: ExpeditionRecord) => Promise<void>
}

class AgentActionRejectedError extends Error {}

function reject(message: string): never {
  throw new AgentActionRejectedError(message)
}

function requireParty(partyId: number): Party {
  const party = usePartyStore.getState().parties.find(item => item.id === partyId)
  if (!party) reject(`パーティID ${partyId} が見つかりません`)
  return party
}

function requireIdleParty(partyId: number): Party {
  const party = requireParty(partyId)
  if ((party.status ?? 'idle') !== 'idle') {
    reject(`${party.name}は遠征中です`)
  }
  return party
}

function requireUnlockedDungeon(dungeonId: string): Dungeon {
  const dungeon = useDungeonStore.getState().dungeons.find(item => item.id === dungeonId)
  if (!dungeon) reject(`ダンジョンID ${dungeonId} が見つかりません`)
  if (!dungeon.unlocked) reject(`${dungeon.name}は未解放です`)
  return dungeon
}

async function refreshGameStores(): Promise<void> {
  await Promise.all([
    usePartyStore.getState().refresh(),
    useGoblinStore.getState().refresh(),
    useBaseStore.getState().refresh(),
    useDungeonStore.getState().refresh(),
    useExpeditionStore.getState().refresh(),
  ])
}

export async function executeGameAgentAction(
  envelope: GameAgentActionEnvelope,
  handlers: GameAgentExpeditionHandlers,
): Promise<GameAgentActionResult> {
  const completedAt = () => new Date().toISOString()

  try {
    const action = envelope.action
    let summary: string

    switch (action.type) {
      case 'set_party_members': {
        const party = requireIdleParty(action.partyId)
        const uniqueMemberIds = [...new Set(action.memberIds)]
        if (uniqueMemberIds.length !== action.memberIds.length) reject('memberIdsが重複しています')
        if (uniqueMemberIds.length > 6) reject('パーティは最大6体です')

        const goblinIds = new Set(useGoblinStore.getState().goblins.map(goblin => goblin.id))
        const missingId = uniqueMemberIds.find(id => !goblinIds.has(id))
        if (missingId !== undefined) reject(`ゴブリンID ${missingId} が見つかりません`)

        const conflictingParty = usePartyStore.getState().parties.find(other => (
          other.id !== party.id && other.memberIds.some(id => uniqueMemberIds.includes(id))
        ))
        if (conflictingParty) reject(`${conflictingParty.name}に所属中のゴブリンが含まれています`)

        await usePartyStore.getState().updateMembers(party.id, uniqueMemberIds)
        summary = `${party.name}の編成を${uniqueMemberIds.length}体に変更しました`
        break
      }

      case 'configure_expedition': {
        const party = requireIdleParty(action.partyId)
        const dungeon = requireUnlockedDungeon(action.dungeonId)
        const tier = action.tier ?? (party.dungeonId === dungeon.id ? party.dungeonTier ?? 0 : 0)
        const maxUnlockedTier = Math.min(
          dungeon.maxClearedTier ?? 0,
          DUNGEON_TIER_SELECTABLE_MAX,
        )
        if (!Number.isInteger(tier) || tier < 0 || tier > maxUnlockedTier) {
          reject(`${dungeon.name}で選択できるtierは0〜${maxUnlockedTier}です`)
        }

        const targetFloor = action.targetFloor === undefined
          ? (party.targetFloor ?? null)
          : action.targetFloor
        if (targetFloor !== null && (targetFloor < 1 || targetFloor > dungeon.floors)) {
          reject(`targetFloorは1〜${dungeon.floors}またはnullで指定してください`)
        }
        const returnPolicy = action.returnPolicy ?? party.returnPolicy ?? 'never'

        const tutorialError = getTutorialExpeditionConfigError(
          useTutorialStore.getState().step,
          {
            dungeonId: dungeon.id,
            tier,
            targetFloor,
            returnPolicy,
          },
          dungeon.floors,
        )
        if (tutorialError) reject(tutorialError)

        await usePartyStore.getState().configureExpedition(party.id, {
          dungeonId: dungeon.id,
          tier,
          targetFloor,
          returnPolicy,
        })
        summary = `${party.name}の遠征先を${dungeon.name}に設定しました`
        break
      }

      case 'set_auto_expedition': {
        const party = requireParty(action.partyId)
        if (action.enabled) {
          if ((party.status ?? 'idle') !== 'idle') reject(`${party.name}は遠征中です`)
          if (!party.dungeonId) reject('遠征先が設定されていません')
          const dungeon = requireUnlockedDungeon(party.dungeonId)
          if (!isAutoExpeditionDungeonCleared(dungeon, party.dungeonTier ?? 0)) {
            reject(`${dungeon.name}の選択中tierは自動周回できません`)
          }
        }
        await usePartyStore.getState().setAutoExpedition(party.id, action.enabled)
        summary = `${party.name}の自動周回を${action.enabled ? 'ON' : 'OFF'}にしました`
        break
      }

      case 'start_expedition': {
        const party = requireIdleParty(action.partyId)
        if (party.memberIds.length === 0) reject('パーティにメンバーがいません')
        if (!party.dungeonId) reject('遠征先が設定されていません')
        const dungeon = requireUnlockedDungeon(party.dungeonId)
        const tutorialError = getTutorialExpeditionConfigError(
          useTutorialStore.getState().step,
          {
            dungeonId: dungeon.id,
            tier: party.dungeonTier ?? 0,
            targetFloor: party.targetFloor ?? null,
            returnPolicy: party.returnPolicy ?? 'never',
          },
          dungeon.floors,
        )
        if (tutorialError) reject(tutorialError)
        const result = await handlers.startExpedition({
          party,
          dungeon,
          returnPolicy: party.returnPolicy ?? 'never',
          targetFloor: party.targetFloor ?? null,
          tier: party.dungeonTier ?? 0,
          useGoldenAcorn: action.useGoldenAcorn === true,
        })
        summary = `${party.name}が${dungeon.name}へ出発しました（${result.record.id}）`
        break
      }

      case 'abort_expedition': {
        const record = useExpeditionStore.getState().expeditionRecords.find(
          item => item.id === action.expeditionId,
        )
        if (!record || record.status !== 'ongoing') {
          reject(`進行中の遠征 ${action.expeditionId} が見つかりません`)
        }
        await handlers.abortExpedition(record)
        summary = `${record.partyName}を${record.dungeonName}から緊急帰還させました`
        break
      }

      case 'rank_up': {
        const result = await useBaseStore.getState().performRankUp()
        if (!result.success) reject(result.error)
        summary = `拠点をランク${result.state.rank}へ拡張しました`
        break
      }
    }

    await refreshGameStores()
    return {
      actionId: envelope.actionId,
      actionType: envelope.action.type,
      status: 'completed',
      summary,
      completedAt: completedAt(),
    }
  } catch (error) {
    return {
      actionId: envelope.actionId,
      actionType: envelope.action.type,
      status: error instanceof AgentActionRejectedError ? 'rejected' : 'failed',
      summary: error instanceof Error ? error.message : '不明なエラーが発生しました',
      completedAt: completedAt(),
    }
  }
}
