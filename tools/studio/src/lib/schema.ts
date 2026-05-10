import { z } from 'zod'

export const GoblinBaseAttributesSchema = z.object({
  power: z.number(),
  wisdom: z.number(),
  spirit: z.number(),
  vitality: z.number(),
  agility: z.number(),
  luck: z.number(),
})

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
    baseAttributes: GoblinBaseAttributesSchema,
    atk: z.number().int().nonnegative(),
    magicAtk: z.number().int().nonnegative().optional(),
    def: z.number().int().nonnegative(),
    magicDef: z.number().int().nonnegative().optional(),
    magicHeal: z.number().int().nonnegative().optional(),
    attackCount: z.number().int().nonnegative(),
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

export const EquipmentCategorySchema = z.enum([
  'weapon',
  'armor',
  'robe',
  'shield',
  'gauntlet',
  'wand',
  'rod',
  'accessory',
])

export const WeaponSubCategorySchema = z.enum([
  'sword',
  'axe',
  'spear',
  'bow',
  'staff',
  'claw',
])

export const WeaponRangeSchema = z.enum(['melee', 'ranged'])

export const EquipmentStatSchema = z.enum([
  'hp_flat',
  'atk_flat',
  'def_flat',
  'magic_atk_flat',
  'magic_def_flat',
  'attackCount_flat',
  'accuracy_flat',
  'evasion_flat',
  'magicHeal_flat',
  'hp_percent',
  'atk_percent',
  'def_percent',
  'critical_rate_percent',
  'damage_reduction',
])

export const EquipmentStatBonusSchema = z.object({
  stat: EquipmentStatSchema,
  value: z.number(),
  sourceCategory: EquipmentCategorySchema.optional(),
  sourceSubCategory: WeaponSubCategorySchema.optional(),
})

export const EquipmentTemplateSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    category: EquipmentCategorySchema,
    subCategory: WeaponSubCategorySchema.optional(),
    statBonuses: z.array(EquipmentStatBonusSchema),
    grantedSkillIds: z.array(z.string()).optional(),
    grantedSkills: z.array(z.object({ id: z.string() }).passthrough()).optional(),
    range: WeaponRangeSchema.optional(),
    price: z.number().nonnegative(),
    unlockRank: z.number().int().nonnegative().optional(),
    rank: z.number().int().nonnegative().optional(),
    isRare: z.boolean().optional(),
  })
  .passthrough()

export const EquipmentPoolCommentSchema = z
  .object({ _comment: z.string() })
  .passthrough()

export const EquipmentPoolEntrySchema = z.union([
  EquipmentTemplateSchema,
  EquipmentPoolCommentSchema,
])

export const EquipmentPoolSchema = z.object({
  version: z.string(),
  templates: z.array(EquipmentPoolEntrySchema),
})

export type EquipmentCategory = z.infer<typeof EquipmentCategorySchema>
export type WeaponSubCategory = z.infer<typeof WeaponSubCategorySchema>
export type WeaponRange = z.infer<typeof WeaponRangeSchema>
export type EquipmentStat = z.infer<typeof EquipmentStatSchema>
export type EquipmentStatBonus = z.infer<typeof EquipmentStatBonusSchema>
export type EquipmentTemplate = z.infer<typeof EquipmentTemplateSchema>
export type EquipmentPoolComment = z.infer<typeof EquipmentPoolCommentSchema>
export type EquipmentPoolEntry = z.infer<typeof EquipmentPoolEntrySchema>
export type EquipmentPool = z.infer<typeof EquipmentPoolSchema>

export function isEquipmentTemplate(
  entry: EquipmentPoolEntry,
): entry is EquipmentTemplate {
  return typeof (entry as { id?: unknown }).id === 'string'
}

export const StoryUnlockConditionSchema = z
  .object({
    type: z.literal('dungeon_cleared'),
    dungeonId: z.string(),
  })
  .nullable()

export const StoryRewardSchema = z.object({
  type: z.enum(['gold', 'goblin', 'equipment']),
  value: z.union([z.number(), z.string()]),
})

export const StoryChapterSchema = z.object({
  id: z.string(),
  text: z.string(),
})

export const StorySchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.enum(['main', 'side']),
  order: z.number().int(),
  unlockCondition: StoryUnlockConditionSchema,
  rewards: z.array(StoryRewardSchema),
  chapters: z.array(StoryChapterSchema),
})

export const StoryCollectionSchema = z.object({
  stories: z.array(StorySchema),
})

export type AreaConfig = z.infer<typeof AreaConfigSchema>
export type EnemyDatabase = z.infer<typeof EnemyDatabaseSchema>
export type StoryUnlockCondition = z.infer<typeof StoryUnlockConditionSchema>
export type StoryReward = z.infer<typeof StoryRewardSchema>
export type StoryChapter = z.infer<typeof StoryChapterSchema>
export type Story = z.infer<typeof StorySchema>
export type StoryCollection = z.infer<typeof StoryCollectionSchema>
export type StoryCategory = Story['category']

export interface DungeonSummary {
  areaId: string
  name: string
  areaLevel: number
  floors: number
  baseDurationSec: number
  enemyCount: number
  patternCount: number
}

export interface DungeonUnlockNode {
  areaId: string
  name: string
  areaLevel: number
  unlockRequires?: string
  unlockNext?: string
  unlockNexts: string[]
  unlocked: boolean
  isBaseCapture: boolean
}

export interface DungeonDetailDto {
  areaId: string
  area: AreaConfig
  enemy: EnemyDatabase | null
}

export interface StorySummary {
  id: string
  title: string
  category: Story['category']
  order: number
  chapterCount: number
  rewardCount: number
  unlockLabel: string
}

export const GoblinFactorEffectSchema = z.object({
  type: z.enum(['stat_bonus', 'resistance', 'skill_unlock']),
  target: z.enum([
    'hp',
    'atk',
    'magicAtk',
    'def',
    'magicDef',
    'attackCount',
    'accuracy',
    'evasion',
    'magicHeal',
  ]),
  value: z.number(),
})

export const GoblinRaceEntrySchema = z.object({
  id: z.string(),
  label: z.string(),
  implies: z.array(z.string()).optional(),
  skillIds: z.array(z.string()).optional(),
  physicalResistancePercent: z.number().optional(),
  penetrationResistancePercent: z.number().optional(),
  criticalResistancePercent: z.number().optional(),
  magicResistancePercent: z.number().optional(),
})

export const GoblinJobSkillSeedSchema = z.object({
  unlockLevel: z.number().optional(),
  skillId: z.string(),
})

export const GoblinJobSeedSchema = z.object({
  id: z.string(),
  accentColor: z.string(),
  skills: z.array(GoblinJobSkillSeedSchema),
  unlockRequiresClearedArea: z.string().optional(),
  unlockRequiresReadStory: z.string().optional(),
  baseAttributes: GoblinBaseAttributesSchema.optional(),
})

export const GoblinVariantSeedSchema = z.object({
  factorId: z.string(),
  factorName: z.string(),
  factorDescription: z.string(),
  inheritProbability: z.number(),
  factorEffects: z.array(GoblinFactorEffectSchema),
  variantProbability: z.number(),
  raceId: z.string(),
  raceName: z.string(),
  avatar: z.string(),
  imageKey: z.string(),
  baseAttributes: GoblinBaseAttributesSchema.optional(),
  hpCoefficient: z.number().optional(),
  defaultSkillIds: z.array(z.string()).optional(),
})

export const GoblinFactorSeedSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  inheritProbability: z.number(),
  effects: z.array(GoblinFactorEffectSchema),
  source: z.enum(['variant', 'standalone']).optional(),
})

export const BirthSkillLotteryEntrySchema = z.object({
  skillId: z.string(),
  probability: z.number(),
})

export const FactorSkillInheritanceRuleSchema = z.object({
  factorId: z.string(),
  skills: z.array(BirthSkillLotteryEntrySchema),
})

export const PureGoblinSkillManifestationRuleSchema = z.object({
  baseRank: z.number().int(),
  skills: z.array(BirthSkillLotteryEntrySchema),
})

export const GoblinStudioDataSchema = z.object({
  races: z.array(GoblinRaceEntrySchema),
  factors: z.array(GoblinFactorSeedSchema),
  jobs: z.array(GoblinJobSeedSchema),
  variants: z.array(GoblinVariantSeedSchema),
  factorSkillInheritanceRules: z.array(FactorSkillInheritanceRuleSchema),
  pureGoblinSkillManifestationRules: z.array(PureGoblinSkillManifestationRuleSchema),
})

export type GoblinBaseAttributes = z.infer<typeof GoblinBaseAttributesSchema>
export type GoblinFactorEffect = z.infer<typeof GoblinFactorEffectSchema>
export type GoblinRaceEntry = z.infer<typeof GoblinRaceEntrySchema>
export type GoblinJobSkillSeed = z.infer<typeof GoblinJobSkillSeedSchema>
export type GoblinJobSeed = z.infer<typeof GoblinJobSeedSchema>
export type GoblinVariantSeed = z.infer<typeof GoblinVariantSeedSchema>
export type GoblinFactorSeed = z.infer<typeof GoblinFactorSeedSchema>
export type BirthSkillLotteryEntry = z.infer<typeof BirthSkillLotteryEntrySchema>
export type FactorSkillInheritanceRule = z.infer<typeof FactorSkillInheritanceRuleSchema>
export type PureGoblinSkillManifestationRule = z.infer<typeof PureGoblinSkillManifestationRuleSchema>
export type GoblinStudioData = z.infer<typeof GoblinStudioDataSchema>
