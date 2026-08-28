import { ExpeditionEngine } from '@app/core/services/ExpeditionEngine'
import { GoblinBirthService } from '@app/core/services/GoblinBirthService'
import { EquipmentService } from '@app/core/services/EquipmentService'
import { applyGoblinJob } from '@app/shared/data/goblinJobs'
import { applySkillBonusesToEquipmentBonuses } from '@app/shared/data/characterSkills'
import { getGoblinVariantByFactorId } from '@app/shared/data/goblinVariants'
import { getCharacterSkill } from '@app/shared/data/skillCatalog'
import { getLegacyRaceName } from '@app/shared/types/Race'
import type { Goblin, GoblinStats } from '@app/shared/types'

export interface ScenarioPartyMember {
  name: string
  /** 任意。未指定時は無職（ゴブリン集落帯はジョブが無いので通常未指定） */
  job?: string
  /** 任意。スライム/ウルフ等の亜種因子ID。未指定時は通常ゴブリン */
  variantFactorId?: string
  equipmentTemplateIds: string[]
}

export interface ScenarioLoadout {
  name: string
  description?: string
  party: ScenarioPartyMember[]
}

export interface EquipmentFilter {
  maxUnlockRank?: number
  maxDropRank?: number
  allowIds?: string[]
  denyIds?: string[]
}

export interface BalanceScenario {
  areaId: string
  description?: string
  iterations?: number
  levelRange?: { min: number; max: number; step?: number }
  equipmentFilter?: EquipmentFilter
  loadouts: ScenarioLoadout[]
}

export interface ScenarioRunOptions {
  scenario: BalanceScenario
  iterations: number
  levelMin: number
  levelMax: number
  step: number
  seed: number
  onProgress?: (done: number, total: number) => void
}

export interface LoadoutCellResult {
  iterations: number
  wins: number
  winRate: number
  avgRoundsPerBattle: number
}

export interface ScenarioMatrixRow {
  level: number
  loadouts: Record<string, LoadoutCellResult>
}

export interface ScenarioMatrixResult {
  scenario: BalanceScenario
  options: ScenarioRunOptions
  rows: ScenarioMatrixRow[]
}

function applyEquipmentFlatBonuses(
  stats: GoblinStats,
  equipmentBonuses: Array<{ stat: string; value: number }>,
): GoblinStats {
  const next = { ...stats }
  for (const bonus of equipmentBonuses) {
    if (bonus.stat === 'hp_flat') next.hp += bonus.value
    else if (bonus.stat === 'atk_flat') next.atk += bonus.value
    else if (bonus.stat === 'def_flat') next.def += bonus.value
    else if (bonus.stat === 'magic_atk_flat') next.magicAtk += bonus.value
    else if (bonus.stat === 'magic_def_flat') next.magicDef += bonus.value
    else if (bonus.stat === 'attackCount_flat') next.attackCount += bonus.value
    else if (bonus.stat === 'accuracy_flat') next.accuracy += bonus.value
    else if (bonus.stat === 'evasion_flat') next.evasion += bonus.value
    else if (bonus.stat === 'magicHeal_flat') next.magicHeal += bonus.value
    else if (bonus.stat === 'critical_rate_percent') next.criticalRate += bonus.value
  }
  return next
}

function applyVariant(goblin: Goblin, variantFactorId: string | undefined): Goblin {
  if (!variantFactorId) return goblin
  const def = getGoblinVariantByFactorId(variantFactorId)
  if (!def) return goblin
  const extraSkills = (def.defaultSkillIds ?? []).map((id) => getCharacterSkill(id))
  return {
    ...goblin,
    raceId: def.raceId,
    race: getLegacyRaceName(def.raceId),
    variantFactorId: def.factorId,
    factors: [def.factorId],
    skills: [...(goblin.skills ?? []), ...extraSkills],
    baseAttributes: def.baseAttributes ?? goblin.baseAttributes,
    effectiveStats: undefined,
  }
}

function createBaseGoblin(
  id: number,
  name: string,
  level: number,
  job: string | undefined,
  variantFactorId: string | undefined,
): Goblin {
  const birthService = new GoblinBirthService(() => 0)
  const born = birthService.createNewGoblin(id, 1)
  let goblin: Goblin = {
    ...(born as Goblin),
    id,
    name,
    level,
    experience: 0,
    effectiveStats: undefined,
    factors: [],
    skills: born.skills ?? [],
  }
  goblin = applyVariant(goblin, variantFactorId)
  // applyGoblinJob は job=undefined でも syncGoblinDerivedStats を走らせ、
  // レベルに応じた baseAttributes / 派生ステータスを正規化するので必ず呼ぶ。
  goblin = applyGoblinJob(goblin, job ? (job as Goblin['job']) : undefined)
  return { ...goblin, effectiveStats: undefined }
}

function applyLoadoutEquipment(goblin: Goblin, equipmentTemplateIds: string[]): Goblin {
  const slotCount = Math.min(
    EquipmentService.getAvailableSlots(goblin),
    equipmentTemplateIds.length,
  )
  const equippedItems = Array.from({ length: slotCount }, (_, slotIndex) => ({
    id: `studio_${goblin.id}_${slotIndex}`,
    templateId: equipmentTemplateIds[slotIndex],
    slotIndex,
    goblinId: goblin.id,
  }))
  const equipmentBonuses = applySkillBonusesToEquipmentBonuses(
    goblin.skills ?? [],
    EquipmentService.calculateEquipmentBonuses(equippedItems),
  )
  const equipmentSkills = EquipmentService.collectGrantedSkills(equippedItems)
  const stats = applyEquipmentFlatBonuses(goblin.stats, equipmentBonuses)
  return {
    ...goblin,
    stats,
    baseAttributes: undefined,
    effectiveStats: undefined,
    skills: [...(goblin.skills ?? []), ...equipmentSkills],
  }
}

export function buildPartyFromLoadout(
  loadout: ScenarioLoadout,
  level: number,
): Goblin[] {
  return loadout.party.map((member, index) => {
    const base = createBaseGoblin(
      index,
      member.name,
      level,
      member.job,
      member.variantFactorId,
    )
    return applyLoadoutEquipment(base, member.equipmentTemplateIds || [])
  })
}

async function runSingleExpedition(
  areaId: string,
  party: Goblin[],
  seed: number,
): Promise<{ success: boolean; totalRounds: number; battleCount: number }> {
  const engine = new ExpeditionEngine(seed)
  const replay = await engine.generateExpedition(
    {
      partyId: 'studio-balance-ref',
      areaId,
      returnPolicy: 'never',
      clientVersion: 'studio-balance-ref',
    },
    party.map((g) => ({ ...g, currentHp: undefined })),
  )
  let totalRounds = 0
  let battleCount = 0
  for (const event of replay.events ?? []) {
    if (event.type === 'battle' || event.type === 'boss') {
      totalRounds += event.combat?.rounds ?? 0
      battleCount++
    }
  }
  return { success: replay.summary?.success === true, totalRounds, battleCount }
}

export async function runScenarioMatrix(
  options: ScenarioRunOptions,
): Promise<ScenarioMatrixResult> {
  const { scenario, iterations, levelMin, levelMax, step, seed, onProgress } = options
  const levels: number[] = []
  for (let lv = levelMin; lv <= levelMax; lv += step) levels.push(lv)
  const total = levels.length * scenario.loadouts.length * iterations
  let done = 0

  const rows: ScenarioMatrixRow[] = []
  for (const level of levels) {
    const loadoutResults: Record<string, LoadoutCellResult> = {}
    for (const loadout of scenario.loadouts) {
      const party = buildPartyFromLoadout(loadout, level)
      let wins = 0
      let totalRounds = 0
      let totalBattles = 0
      const seedBase = seed + level * 1009 + loadout.name.length * 17
      for (let i = 0; i < iterations; i++) {
        const trialSeed = (seedBase + i * 7919) | 0
        const { success, totalRounds: r, battleCount: bc } = await runSingleExpedition(
          scenario.areaId,
          party,
          trialSeed,
        )
        if (success) wins++
        totalRounds += r
        totalBattles += bc
        done++
        if (onProgress && done % 25 === 0) {
          onProgress(done, total)
          await new Promise((resolve) => setTimeout(resolve, 0))
        }
      }
      loadoutResults[loadout.name] = {
        iterations,
        wins,
        winRate: wins / iterations,
        avgRoundsPerBattle: totalBattles > 0 ? totalRounds / totalBattles : 0,
      }
    }
    rows.push({ level, loadouts: loadoutResults })
  }
  onProgress?.(total, total)
  return { scenario, options, rows }
}

export function findThresholdLevel(
  rows: ScenarioMatrixRow[],
  loadoutName: string,
  threshold: number,
): number | null {
  const sorted = [...rows].sort((a, b) => a.level - b.level)
  for (const row of sorted) {
    const cell = row.loadouts[loadoutName]
    if (cell && cell.winRate >= threshold) return row.level
  }
  return null
}
