import type { GameAgentActionDefinition, GameAgentObservation, BuildGameAgentObservationInput } from './types'
import { GAME_AGENT_PROTOCOL_VERSION } from './types'
import { getTutorialExpeditionRequirement } from './tutorialExpeditionPolicy'

export const GAME_AGENT_ACTION_CATALOG: GameAgentActionDefinition[] = [
  {
    type: 'set_party_members',
    description: '待機中のパーティメンバーを変更する',
    parameters: { partyId: 'number', memberIds: 'number[]（最大6体）' },
  },
  {
    type: 'configure_expedition',
    description: '待機中のパーティの遠征先・難易度・目標階層・帰還条件を設定する',
    parameters: {
      partyId: 'number',
      dungeonId: '解放済みダンジョンID',
      tier: '0 | 1 | 2 | 3（省略可）',
      targetFloor: 'number | null（省略可）',
      returnPolicy: 'if_any_ko | if_two_ko | last_one | never（省略可）',
    },
  },
  {
    type: 'set_auto_expedition',
    description: 'クリア済み遠征の自動周回を切り替える',
    parameters: { partyId: 'number', enabled: 'boolean' },
  },
  {
    type: 'start_expedition',
    description: '設定済みの待機パーティを遠征へ出発させる',
    parameters: { partyId: 'number', useGoldenAcorn: 'boolean（省略可、既定false）' },
  },
  {
    type: 'abort_expedition',
    description: '進行中の遠征を緊急帰還させる',
    parameters: { expeditionId: '進行中の遠征ID' },
  },
  {
    type: 'rank_up',
    description: '条件を満たしていれば拠点をランクアップする',
    parameters: {},
  },
]

/**
 * AIへ公開可能な状態だけを構築する。遠征seed・未公開replayは意図的に含めない。
 */
export function buildGameAgentObservation(
  input: BuildGameAgentObservationInput,
): GameAgentObservation {
  return {
    protocolVersion: GAME_AGENT_PROTOCOL_VERSION,
    revision: input.revision,
    capturedAt: (input.capturedAt ?? new Date()).toISOString(),
    tutorial: {
      step: input.tutorialStep,
      requiredExpedition: getTutorialExpeditionRequirement(input.tutorialStep),
    },
    base: input.baseState
      ? {
          rank: input.baseState.rank,
          gold: input.baseState.gold,
          capacity: input.baseState.capacity,
          currentMaxParties: input.baseState.currentMaxParties,
          currentMaxGoblins: input.baseState.currentMaxGoblins,
          capturedDungeons: [...input.baseState.capturedDungeons],
        }
      : null,
    goblins: input.goblins.map(goblin => {
      const stats = goblin.effectiveStats ?? goblin.stats
      return {
        id: goblin.id,
        name: goblin.name,
        race: goblin.race,
        job: goblin.job,
        level: goblin.level,
        experience: goblin.experience,
        currentHp: goblin.currentHp ?? stats.hp,
        stats: { ...stats },
        factors: [...(goblin.factors ?? [])],
        skillIds: goblin.skills.map(skill => skill.id),
      }
    }),
    parties: input.parties.map(party => ({
      id: party.id,
      name: party.name,
      memberIds: [...party.memberIds],
      status: party.status ?? 'idle',
      dungeonId: party.dungeonId,
      dungeonTier: party.dungeonTier ?? 0,
      targetFloor: party.targetFloor ?? null,
      returnPolicy: party.returnPolicy ?? 'never',
      autoExpeditionEnabled: party.autoExpeditionEnabled === true,
    })),
    dungeons: input.dungeons.map(dungeon => ({
      id: dungeon.id,
      name: dungeon.name,
      floors: dungeon.floors,
      areaLevel: dungeon.areaLevel,
      unlocked: dungeon.unlocked === true,
      cleared: dungeon.cleared === true,
      maxClearedTier: dungeon.maxClearedTier ?? 0,
      maxClearedFloorsByTier: { ...(dungeon.maxClearedFloorsByTier ?? {}) },
    })),
    expeditions: input.expeditions.map(record => ({
      id: record.id,
      partyId: record.partyId,
      partyName: record.partyName,
      dungeonId: record.dungeonId,
      dungeonName: record.dungeonName,
      status: record.status,
      startTime: record.startTime.toISOString(),
      returnTime: record.returnTime?.toISOString() ?? null,
      returnPolicy: record.returnPolicy,
    })),
    equipment: input.equipment.map(item => ({
      id: item.id,
      templateId: item.templateId,
      goblinId: item.goblinId,
      slotIndex: item.slotIndex,
      titleId: item.titleId,
      prefixMod: item.prefixMod,
      suffixMod: item.suffixMod,
    })),
    actionCatalog: GAME_AGENT_ACTION_CATALOG,
  }
}
