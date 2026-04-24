import { z } from 'zod'

export const AreaConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  areaLevel: z.number().int().nonnegative(),
  floors: z.number().int().positive(),
  baseDurationSec: z.number().int().positive(),
  moveSpeedScale: z.number().positive().optional(),
  description: z.string().optional(),
  encounter: z.object({
    perFloorEvents: z.number().int().positive(),
    eventWeights: z.object({
      battle: z.number().nonnegative(),
      exploring: z.number().nonnegative(),
      trap: z.number().nonnegative().optional(),
      npc: z.number().nonnegative().optional(),
    }),
    pityTimerSec: z.number().nonnegative().optional(),
  }),
  enemyTable: z
    .array(
      z.object({
        id: z.string(),
        weight: z.number().nonnegative(),
        lvl: z.number().int().nonnegative(),
      }),
    )
    .optional(),
  boss: z
    .object({
      id: z.string(),
      lvl: z.number().int().nonnegative(),
    })
    .optional(),
  unlockNext: z.string().optional(),
})

export const EnemySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    raceTags: z.array(z.string()),
    level: z.number().int().nonnegative(),
    hp: z.number().int().nonnegative(),
    vitality: z.number().int().nonnegative().optional(),
    atk: z.number().int().nonnegative(),
    magicAtk: z.number().int().nonnegative().optional(),
    def: z.number().int().nonnegative(),
    magicDef: z.number().int().nonnegative().optional(),
    magicHeal: z.number().int().nonnegative().optional(),
    agility: z.number().int().nonnegative(),
    attackCount: z.number().int().positive(),
    accuracy: z.number().nonnegative(),
    evasion: z.number().nonnegative(),
    criticalRate: z.number().nonnegative().optional(),
    physicalResistancePercent: z.number().optional(),
    penetrationResistancePercent: z.number().optional(),
    criticalResistancePercent: z.number().optional(),
    magicResistancePercent: z.number().optional(),
    exp: z.number().int().nonnegative(),
    gold: z.number().int().nonnegative(),
  })
  .passthrough()

export const EnemyPatternSchema = z.object({
  id: z.string(),
  floors: z.array(z.number().int().nonnegative()),
  enemies: z.array(z.array(z.string())),
  isBoss: z.boolean().optional(),
})

export const EnemyDatabaseSchema = z.object({
  enemies: z.array(EnemySchema),
  patterns: z.array(EnemyPatternSchema),
})

export type AreaConfig = z.infer<typeof AreaConfigSchema>
export type EnemyDatabase = z.infer<typeof EnemyDatabaseSchema>

export interface DungeonSummary {
  areaId: string
  name: string
  areaLevel: number
  floors: number
  baseDurationSec: number
  enemyCount: number
  patternCount: number
}

export interface DungeonDetailDto {
  areaId: string
  area: AreaConfig
  enemy: EnemyDatabase | null
}
