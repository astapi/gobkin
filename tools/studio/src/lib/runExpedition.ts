import { ExpeditionEngine } from '@app/core/services/ExpeditionEngine'
import { computeDungeonExplorationTime } from '@app/shared/types'
import type {
  Goblin,
  GoblinStats,
  ExpeditionReplay,
  ExpeditionRequest,
  DungeonTier,
} from '@app/shared/types'
import allAreaData from '@app/shared/data/expeditionArea/allArea.json'

import type { BackupGoblin, BackupGoblinStats } from './goblinMapper'

export type ReturnPolicy = ExpeditionRequest['returnPolicy']

type AreaDurationMeta = {
  id: string
  exploration_time_sec_first?: number
  exploration_time_sec?: number
}

const AREA_DURATION_META = (allAreaData as { areas?: AreaDurationMeta[] }).areas ?? []

const DEFAULT_STATS: GoblinStats = {
  hp: 0,
  atk: 0,
  magicAtk: 0,
  def: 0,
  magicDef: 0,
  attackCount: 1,
  accuracy: 0,
  evasion: 0,
  magicHeal: 0,
  criticalRate: 0,
}

function getSimulationDurationSec(areaId: string, tier: DungeonTier | undefined): number | undefined {
  const area = AREA_DURATION_META.find((entry) => entry.id === areaId)
  if (!area || area.exploration_time_sec_first === undefined) return undefined
  return computeDungeonExplorationTime(
    areaId,
    area.exploration_time_sec_first,
    area.exploration_time_sec ?? area.exploration_time_sec_first,
    tier ?? 0,
    false,
  )
}

function fillStats(partial: BackupGoblinStats | undefined): GoblinStats {
  if (!partial) return { ...DEFAULT_STATS }
  return {
    hp: partial.hp,
    atk: partial.atk,
    magicAtk: partial.magicAtk ?? 0,
    def: partial.def,
    magicDef: partial.magicDef ?? 0,
    attackCount: partial.attackCount,
    accuracy: partial.accuracy,
    evasion: partial.evasion,
    magicHeal: partial.magicHeal ?? 0,
    criticalRate: partial.criticalRate ?? 0,
  }
}

export function backupGoblinToGoblin(g: BackupGoblin): Goblin {
  return {
    id: g.id,
    name: g.name,
    race: g.race,
    raceId: g.raceId as Goblin['raceId'],
    job: g.job as Goblin['job'],
    level: g.level,
    experience: g.experience,
    avatar: g.avatar,
    stats: fillStats(g.stats),
    effectiveStats: g.effectiveStats ? fillStats(g.effectiveStats) : undefined,
    currentHp: g.currentHp,
    factors: g.factors,
    variantFactorId: g.variantFactorId,
    individualValue: g.individualValue,
    skills: (g.skills as Goblin['skills']) ?? [],
    spells: (g.spells as Goblin['spells']) ?? undefined,
    battleActionPolicy: g.battleActionPolicy as Goblin['battleActionPolicy'],
  }
}

export interface SimulationOptions {
  areaId: string
  /** 組み立て済みのPT。BackupGoblin から作る場合は backupGoblinToGoblin を通すこと */
  party: Goblin[]
  trials: number
  tier?: DungeonTier
  returnPolicy: ReturnPolicy
  seed?: number
  onProgress?: (completed: number, total: number) => void
}

export interface SimulationResult {
  options: SimulationOptions
  trials: number
  success: number
  defeated: number
  policyReturned: number
  aborted: number
  floorDistribution: Record<number, number>
  avgMaxFloor: number
  avgXpGained: number
  avgGoldGained: number
  avgDurationSec: number
  casualtyCounts: Record<string, number>
  replays: ExpeditionReplay[]
  errors: string[]
}

export async function runSimulationBatch(
  opts: SimulationOptions,
): Promise<SimulationResult> {
  const {
    areaId,
    party,
    trials,
    tier,
    returnPolicy,
    seed,
    onProgress,
  } = opts

  const goblinParty = party
  const durationSec = getSimulationDurationSec(areaId, tier)
  const baseRequest: ExpeditionRequest = {
    partyId: 'studio',
    areaId,
    tier,
    returnPolicy,
    clientVersion: 'studio',
    durationSec,
    simulationDurationSec: durationSec,
  }

  let successCount = 0
  let defeatedCount = 0
  let policyReturnedCount = 0
  let abortedCount = 0
  let sumFloor = 0
  let sumXp = 0
  let sumGold = 0
  let sumDuration = 0
  const floorDistribution: Record<number, number> = {}
  const casualtyCounts: Record<string, number> = {}
  const replays: ExpeditionReplay[] = []
  const errors: string[] = []

  for (let i = 0; i < trials; i++) {
    const trialSeed =
      seed !== undefined ? seed + i : Math.floor(Math.random() * 0x7fffffff)
    const engine = new ExpeditionEngine(trialSeed)
    try {
      const replay = await engine.generateExpedition(baseRequest, goblinParty)
      const floor = replay.summary.maxFloorReached
      sumFloor += floor
      sumXp += replay.summary.xpGained
      sumGold += replay.summary.goldGained
      sumDuration += replay.durationSec
      floorDistribution[floor] = (floorDistribution[floor] ?? 0) + 1

      const lastEvent = replay.events[replay.events.length - 1]
      const endReason =
        lastEvent && lastEvent.type === 'return' ? lastEvent.reason : null

      if (replay.summary.success) {
        successCount++
      } else if (endReason === 'defeated') {
        defeatedCount++
      } else if (endReason === 'policy_return') {
        policyReturnedCount++
      } else {
        abortedCount++
      }

      for (const name of replay.summary.casualties) {
        casualtyCounts[name] = (casualtyCounts[name] ?? 0) + 1
      }

      if (replays.length < 3) replays.push(replay)
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }

    if (onProgress && (i + 1) % 10 === 0) {
      onProgress(i + 1, trials)
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  onProgress?.(trials, trials)

  const divisor = Math.max(1, trials - errors.length)
  return {
    options: opts,
    trials,
    success: successCount,
    defeated: defeatedCount,
    policyReturned: policyReturnedCount,
    aborted: abortedCount,
    floorDistribution,
    avgMaxFloor: sumFloor / divisor,
    avgXpGained: sumXp / divisor,
    avgGoldGained: sumGold / divisor,
    avgDurationSec: sumDuration / divisor,
    casualtyCounts,
    replays,
    errors,
  }
}

export interface SingleRunOptions {
  areaId: string
  /** 組み立て済みのPT。BackupGoblin から作る場合は backupGoblinToGoblin を通すこと */
  party: Goblin[]
  tier?: DungeonTier
  returnPolicy: ReturnPolicy
  seed?: number
}

export interface SingleRunResult {
  options: SingleRunOptions
  seed: number
  replay: ExpeditionReplay
  party: Goblin[]
}

export async function runSingleExpedition(
  opts: SingleRunOptions,
): Promise<SingleRunResult> {
  const { areaId, party, tier, returnPolicy, seed } = opts
  const trialSeed =
    seed !== undefined ? seed : Math.floor(Math.random() * 0x7fffffff)
  const goblinParty = party
  const durationSec = getSimulationDurationSec(areaId, tier)
  const baseRequest: ExpeditionRequest = {
    partyId: 'studio',
    areaId,
    tier,
    returnPolicy,
    clientVersion: 'studio',
    durationSec,
    simulationDurationSec: durationSec,
  }
  const engine = new ExpeditionEngine(trialSeed)
  const replay = await engine.generateExpedition(baseRequest, goblinParty)
  return { options: opts, seed: trialSeed, replay, party: goblinParty }
}

export const RETURN_POLICIES: { value: ReturnPolicy; label: string }[] = [
  { value: 'if_any_ko', label: '1人でも死亡したら帰還' },
  { value: 'if_two_ko', label: '2人が死亡したら帰還' },
  { value: 'last_one', label: '最後の1人になったら帰還' },
  { value: 'never', label: '帰還しない（どんな状態でも進む）' },
]
