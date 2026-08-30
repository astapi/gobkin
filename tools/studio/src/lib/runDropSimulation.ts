import { ExpeditionEngine } from '@app/core/services/ExpeditionEngine'
import { getEquipmentTemplate } from '@app/shared/data/equipmentPoolLoader'
import type {
  DungeonTier,
  EquipmentModRoll,
  EquipmentTitleId,
  ExpeditionRequest,
  Goblin,
} from '@app/shared/types'

import { getSimulationDurationSec } from './runExpedition'

export interface DropSimulationOptions {
  dungeons: Array<{ areaId: string; name: string }>
  runsPerDungeon: number
  tier: DungeonTier
  partyLuck: number
  dropMultiplier: number
  titleMultiplier: number
  seed?: number
  onProgress?: (completed: number, total: number, areaId: string) => void
}

export interface DropModAggregate {
  id: string
  tier: number
  count: number
}

export interface DropItemAggregate {
  templateId: string
  name: string
  category: string
  isRare: boolean
  count: number
  titleCounts: Partial<Record<EquipmentTitleId | 'none', number>>
  prefixMods: DropModAggregate[]
  suffixMods: DropModAggregate[]
}

export interface DungeonDropSimulationResult {
  areaId: string
  areaName: string
  runs: number
  clears: number
  runsWithDrops: number
  totalDrops: number
  items: DropItemAggregate[]
  errors: string[]
}

export interface DropSimulationResult {
  options: DropSimulationOptions
  totalRuns: number
  totalDrops: number
  dungeons: DungeonDropSimulationResult[]
}

type MutableDropItemAggregate = Omit<DropItemAggregate, 'prefixMods' | 'suffixMods'> & {
  prefixModCounts: Map<string, number>
  suffixModCounts: Map<string, number>
}

const SIMULATION_STATS = {
  hp: 1_000_000,
  atk: 1_000_000,
  magicAtk: 1_000_000,
  def: 1_000_000,
  magicDef: 1_000_000,
  attackCount: 50,
  accuracy: 1_000_000,
  evasion: 1_000_000,
  magicHeal: 1_000_000,
  criticalRate: 50,
} as const

function createDropSimulationParty(luck: number): Goblin[] {
  const baseAttributes = {
    power: 100,
    wisdom: 100,
    spirit: 100,
    vitality: 100,
    agility: 100,
    luck,
  }

  return Array.from({ length: 6 }, (_, index): Goblin => ({
    id: 9_900_000 + index,
    name: `ドロップ検証${index + 1}`,
    race: 'ゴブリン',
    raceId: 'goblin',
    level: 999,
    experience: 0,
    avatar: '',
    stats: { ...SIMULATION_STATS },
    effectiveStats: { ...SIMULATION_STATS },
    currentHp: SIMULATION_STATS.hp,
    baseAttributes: { ...baseAttributes },
    effectiveBaseAttributes: { ...baseAttributes },
    factors: [],
    skills: [],
    battleActionPolicy: {
      attackRate: 100,
      clericMagicRate: 0,
      mageMagicRate: 0,
    },
  }))
}

function addModCount(target: Map<string, number>, mod: EquipmentModRoll | undefined): void {
  if (!mod) return
  const key = `${mod.id}|${mod.tier}`
  target.set(key, (target.get(key) ?? 0) + 1)
}

function toModAggregates(source: Map<string, number>): DropModAggregate[] {
  return [...source.entries()]
    .map(([key, count]) => {
      const [id, tier] = key.split('|')
      return { id, tier: Number(tier), count }
    })
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id) || a.tier - b.tier)
}

function finalizeItems(items: Map<string, MutableDropItemAggregate>): DropItemAggregate[] {
  return [...items.values()]
    .map(({ prefixModCounts, suffixModCounts, ...item }) => ({
      ...item,
      prefixMods: toModAggregates(prefixModCounts),
      suffixMods: toModAggregates(suffixModCounts),
    }))
    .sort((a, b) => b.count - a.count || a.templateId.localeCompare(b.templateId))
}

export async function runDropSimulation(options: DropSimulationOptions): Promise<DropSimulationResult> {
  const runsPerDungeon = Math.max(1, Math.floor(options.runsPerDungeon))
  const partyLuck = Math.max(0, Math.floor(options.partyLuck))
  const party = createDropSimulationParty(partyLuck)
  const totalRuns = runsPerDungeon * options.dungeons.length
  const baseSeed = options.seed ?? Math.floor(Math.random() * 0x3fffffff)
  const results: DungeonDropSimulationResult[] = []
  let completed = 0
  let totalDrops = 0

  for (let dungeonIndex = 0; dungeonIndex < options.dungeons.length; dungeonIndex++) {
    const dungeon = options.dungeons[dungeonIndex]
    const items = new Map<string, MutableDropItemAggregate>()
    const errors: string[] = []
    let clears = 0
    let runsWithDrops = 0
    let dungeonDropCount = 0
    const durationSec = getSimulationDurationSec(dungeon.areaId, options.tier)
    const request: ExpeditionRequest = {
      partyId: 'studio-drop-simulation',
      areaId: dungeon.areaId,
      tier: options.tier,
      returnPolicy: 'never',
      clientVersion: 'studio-drop-simulation',
      durationSec,
      simulationDurationSec: durationSec,
    }

    for (let runIndex = 0; runIndex < runsPerDungeon; runIndex++) {
      const seed = baseSeed + dungeonIndex * 1_000_003 + runIndex
      try {
        const replay = await new ExpeditionEngine(seed).generateExpedition(
          request,
          party,
          {
            gold: 1,
            rare: Math.max(0.01, options.dropMultiplier),
            title: Math.max(0.01, options.titleMultiplier),
          },
        )
        if (replay.summary.success) clears++
        const drops = replay.summary.treasureDrops ?? []
        if (drops.length > 0) runsWithDrops++
        dungeonDropCount += drops.length

        for (const drop of drops) {
          const template = getEquipmentTemplate(drop.templateId)
          let item = items.get(drop.templateId)
          if (!item) {
            item = {
              templateId: drop.templateId,
              name: template?.name ?? drop.templateId,
              category: template?.category ?? 'unknown',
              isRare: template?.isRare === true,
              count: 0,
              titleCounts: {},
              prefixModCounts: new Map(),
              suffixModCounts: new Map(),
            }
            items.set(drop.templateId, item)
          }
          item.count++
          const titleId = drop.titleId ?? 'none'
          item.titleCounts[titleId] = (item.titleCounts[titleId] ?? 0) + 1
          addModCount(item.prefixModCounts, drop.prefixMod)
          addModCount(item.suffixModCounts, drop.suffixMod)
        }
      } catch (error) {
        if (errors.length < 20) errors.push(error instanceof Error ? error.message : String(error))
      }

      completed++
      if (completed % 10 === 0 || completed === totalRuns) {
        options.onProgress?.(completed, totalRuns, dungeon.areaId)
        await new Promise<void>(resolve => setTimeout(resolve, 0))
      }
    }

    totalDrops += dungeonDropCount
    results.push({
      areaId: dungeon.areaId,
      areaName: dungeon.name,
      runs: runsPerDungeon,
      clears,
      runsWithDrops,
      totalDrops: dungeonDropCount,
      items: finalizeItems(items),
      errors,
    })
  }

  return {
    options: { ...options, runsPerDungeon, partyLuck, onProgress: undefined },
    totalRuns,
    totalDrops,
    dungeons: results,
  }
}
