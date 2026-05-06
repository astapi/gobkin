import { ExpeditionEngine } from '@app/core/services/ExpeditionEngine'
import type {
  Goblin,
  GoblinStats,
  ExpeditionReplay,
  ExpeditionRequest,
  DungeonTier,
} from '@app/shared/types'

import type { BackupGoblin, BackupGoblinStats } from './goblinMapper'

export type ReturnPolicy = ExpeditionRequest['returnPolicy']

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
  party: BackupGoblin[]
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

  const goblinParty = party.map(backupGoblinToGoblin)
  const baseRequest: ExpeditionRequest = {
    partyId: 'studio',
    areaId,
    tier,
    returnPolicy,
    clientVersion: 'studio',
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
  party: BackupGoblin[]
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
  const goblinParty = party.map(backupGoblinToGoblin)
  const baseRequest: ExpeditionRequest = {
    partyId: 'studio',
    areaId,
    tier,
    returnPolicy,
    clientVersion: 'studio',
  }
  const engine = new ExpeditionEngine(trialSeed)
  const replay = await engine.generateExpedition(baseRequest, goblinParty)
  return { options: opts, seed: trialSeed, replay, party: goblinParty }
}

export const RETURN_POLICIES: { value: ReturnPolicy; label: string }[] = [
  { value: 'never', label: '帰還しない（到達階まで進む）' },
  { value: 'until_floor2', label: '2F到達で帰還' },
  { value: 'until_floor3', label: '3F到達で帰還' },
  { value: 'if_any_ko', label: '誰か気絶したら帰還' },
  { value: 'if_two_ko', label: '2名気絶したら帰還' },
  { value: 'last_one', label: '最後の一人になったら帰還' },
]
