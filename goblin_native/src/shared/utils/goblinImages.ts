import { ImageSourcePropType } from 'react-native'
import type { Goblin, GoblinJob } from '@/shared/types'
import { getGoblinVariantByRace } from '@/shared/data/goblinVariants'
import { isBaseGoblinRaceId, normalizeGoblinRaceId } from '@/shared/types/Race'

// ゴブリン画像のマッピング
const goblinImages: Record<string, ImageSourcePropType> = {
  goblin: require('../../../assets/goblin/goblin.png'),
  marku: require('../../../assets/goblin/marku.png'),
  hobgoblin: require('../../../assets/goblin/hobgoblin.png'),
  wolf_goblin: require('../../../assets/goblin/wolf_goblin.png'),
  slime_goblin: require('../../../assets/goblin/slime_goblin.png'),
  orc_goblin: require('../../../assets/goblin/orc_goblin.png'),
  skelton_goblin: require('../../../assets/goblin/skelton_goblin.png'),
  troll_goblin: require('../../../assets/goblin/troll_goblin.png'),
  scale_goblin: require('../../../assets/goblin/scale_goblin.png'),
  scale_goblin_battle: require('../../../assets/goblin/scale_goblin_battle.png'),
  elf_goblin: require('../../../assets/goblin/goblin.png'),
  dwarf_goblin: require('../../../assets/goblin/goblin.png'),
  goblin_guard: require('../../../assets/goblin/goblin_guard.png'),
  goblin_guard_variant_a_classic: require('../../../assets/goblin/goblin_guard_variant_a_classic.png'),
  goblin_guard_variant_b_heavy_tank: require('../../../assets/goblin/goblin_guard_variant_b_heavy_tank.png'),
  goblin_guard_variant_c_protector: require('../../../assets/goblin/goblin_guard_variant_c_protector.png'),
  goblin_guard_variant_d_armored_warrior: require('../../../assets/goblin/goblin_guard_variant_d_armored_warrior.png'),
  goblin_thief: require('../../../assets/goblin/goblin_thief_variant_b_treasure.png'),
  goblin_thief_original: require('../../../assets/goblin/goblin_thief_original.png'),
  goblin_thief_variant_a_speed: require('../../../assets/goblin/goblin_thief_variant_a_speed.png'),
  goblin_thief_variant_b_treasure: require('../../../assets/goblin/goblin_thief_variant_b_treasure.png'),
  goblin_thief_variant_c_assassin: require('../../../assets/goblin/goblin_thief_variant_c_assassin.png'),
  goblin_thief_variant_d_gold_snatcher: require('../../../assets/goblin/goblin_thief_variant_d_gold_snatcher.png'),
  goblin_mage: require('../../../assets/goblin/goblin_mage.png'),
  goblin_mage_variant_a_upright_staff: require('../../../assets/goblin/goblin_mage_variant_a_upright_staff.png'),
  goblin_mage_variant_b_ready_stance: require('../../../assets/goblin/goblin_mage_variant_b_ready_stance.png'),
  goblin_mage_variant_c_diagonal_cast: require('../../../assets/goblin/goblin_mage_variant_c_diagonal_cast.png'),
  goblin_mage_variant_d_staff_thrust: require('../../../assets/goblin/goblin_mage_variant_d_staff_thrust.png'),
  goblin_warrior: require('../../../assets/goblin/goblin_warrior.png'),
  goblin_warrior_variant_a_balanced: require('../../../assets/goblin/goblin_warrior_variant_a_balanced.png'),
  goblin_warrior_variant_b_heavy: require('../../../assets/goblin/goblin_warrior_variant_b_heavy.png'),
  goblin_warrior_variant_c_berserker: require('../../../assets/goblin/goblin_warrior_variant_c_berserker.png'),
  goblin_warrior_variant_d_captain: require('../../../assets/goblin/goblin_warrior_variant_d_captain.png'),
  goblin_cleric: require('../../../assets/goblin/goblin_cleric.png'),
  goblin_rider: require('../../../assets/goblin/goblin_rider.png'),
  goblin_rider_battle: require('../../../assets/goblin/goblin_rider_battle.png'),
}

export type GoblinImageOption = {
  key: string
  avatar: string
  source: ImageSourcePropType
}

export const GOBLIN_GUARD_IMAGE_OPTIONS: GoblinImageOption[] = [
  {
    key: 'goblin_guard_variant_b_heavy_tank',
    avatar: '/src/assets/goblin/goblin_guard_variant_b_heavy_tank.png',
    source: goblinImages.goblin_guard_variant_b_heavy_tank,
  },
  {
    key: 'goblin_guard_variant_a_classic',
    avatar: '/src/assets/goblin/goblin_guard_variant_a_classic.png',
    source: goblinImages.goblin_guard_variant_a_classic,
  },
  {
    key: 'goblin_guard_variant_c_protector',
    avatar: '/src/assets/goblin/goblin_guard_variant_c_protector.png',
    source: goblinImages.goblin_guard_variant_c_protector,
  },
  {
    key: 'goblin_guard_variant_d_armored_warrior',
    avatar: '/src/assets/goblin/goblin_guard_variant_d_armored_warrior.png',
    source: goblinImages.goblin_guard_variant_d_armored_warrior,
  },
  {
    key: 'goblin_guard',
    avatar: '/src/assets/goblin/goblin_guard.png',
    source: goblinImages.goblin_guard,
  },
]

export const GOBLIN_THIEF_IMAGE_OPTIONS: GoblinImageOption[] = [
  {
    key: 'goblin_thief_variant_b_treasure',
    avatar: '/src/assets/goblin/goblin_thief_variant_b_treasure.png',
    source: goblinImages.goblin_thief_variant_b_treasure,
  },
  {
    key: 'goblin_thief_variant_a_speed',
    avatar: '/src/assets/goblin/goblin_thief_variant_a_speed.png',
    source: goblinImages.goblin_thief_variant_a_speed,
  },
  {
    key: 'goblin_thief_variant_c_assassin',
    avatar: '/src/assets/goblin/goblin_thief_variant_c_assassin.png',
    source: goblinImages.goblin_thief_variant_c_assassin,
  },
  {
    key: 'goblin_thief_variant_d_gold_snatcher',
    avatar: '/src/assets/goblin/goblin_thief_variant_d_gold_snatcher.png',
    source: goblinImages.goblin_thief_variant_d_gold_snatcher,
  },
  {
    key: 'goblin_thief_original',
    avatar: '/src/assets/goblin/goblin_thief_original.png',
    source: goblinImages.goblin_thief_original,
  },
]

export const GOBLIN_MAGE_IMAGE_OPTIONS: GoblinImageOption[] = [
  {
    key: 'goblin_mage',
    avatar: '/src/assets/goblin/goblin_mage.png',
    source: goblinImages.goblin_mage,
  },
  {
    key: 'goblin_mage_variant_a_upright_staff',
    avatar: '/src/assets/goblin/goblin_mage_variant_a_upright_staff.png',
    source: goblinImages.goblin_mage_variant_a_upright_staff,
  },
  {
    key: 'goblin_mage_variant_b_ready_stance',
    avatar: '/src/assets/goblin/goblin_mage_variant_b_ready_stance.png',
    source: goblinImages.goblin_mage_variant_b_ready_stance,
  },
  {
    key: 'goblin_mage_variant_c_diagonal_cast',
    avatar: '/src/assets/goblin/goblin_mage_variant_c_diagonal_cast.png',
    source: goblinImages.goblin_mage_variant_c_diagonal_cast,
  },
  {
    key: 'goblin_mage_variant_d_staff_thrust',
    avatar: '/src/assets/goblin/goblin_mage_variant_d_staff_thrust.png',
    source: goblinImages.goblin_mage_variant_d_staff_thrust,
  },
]

export const GOBLIN_WARRIOR_IMAGE_OPTIONS: GoblinImageOption[] = [
  {
    key: 'goblin_warrior_variant_b_heavy',
    avatar: '/src/assets/goblin/goblin_warrior_variant_b_heavy.png',
    source: goblinImages.goblin_warrior_variant_b_heavy,
  },
  {
    key: 'goblin_warrior_variant_a_balanced',
    avatar: '/src/assets/goblin/goblin_warrior_variant_a_balanced.png',
    source: goblinImages.goblin_warrior_variant_a_balanced,
  },
  {
    key: 'goblin_warrior_variant_c_berserker',
    avatar: '/src/assets/goblin/goblin_warrior_variant_c_berserker.png',
    source: goblinImages.goblin_warrior_variant_c_berserker,
  },
  {
    key: 'goblin_warrior_variant_d_captain',
    avatar: '/src/assets/goblin/goblin_warrior_variant_d_captain.png',
    source: goblinImages.goblin_warrior_variant_d_captain,
  },
  {
    key: 'goblin_warrior',
    avatar: '/src/assets/goblin/goblin_warrior.png',
    source: goblinImages.goblin_warrior,
  },
]

const goblinGuardImageKeys: Set<string> = new Set(GOBLIN_GUARD_IMAGE_OPTIONS.map(option => option.key))
const goblinThiefImageKeys: Set<string> = new Set(GOBLIN_THIEF_IMAGE_OPTIONS.map(option => option.key))
const goblinMageImageKeys: Set<string> = new Set(GOBLIN_MAGE_IMAGE_OPTIONS.map(option => option.key))
const goblinWarriorImageKeys: Set<string> = new Set(GOBLIN_WARRIOR_IMAGE_OPTIONS.map(option => option.key))

export function getGoblinImageOptionsForJob(job: GoblinJob | undefined): GoblinImageOption[] {
  switch (job) {
    case 'guard':
      return GOBLIN_GUARD_IMAGE_OPTIONS
    case 'thief':
      return GOBLIN_THIEF_IMAGE_OPTIONS
    case 'mage':
      return GOBLIN_MAGE_IMAGE_OPTIONS
    case 'warrior':
      return GOBLIN_WARRIOR_IMAGE_OPTIONS
    default:
      return []
  }
}

export function hasGoblinImageOptionsForJob(job: GoblinJob | undefined): boolean {
  return getGoblinImageOptionsForJob(job).length > 0
}

export function getGoblinDisplayImageScale(goblin: Pick<Goblin, 'avatar' | 'job'>): number {
  const imageName = getGoblinImageKey(goblin.avatar)

  if (goblin.job === 'warrior') {
    if (imageName === 'goblin_warrior') return 1.18
    return 1.28
  }

  if (goblin.job === 'guard') {
    if (imageName === 'goblin_guard') return 1.18
    return 1.35
  }

  if (goblin.job === 'thief') {
    return 1.18
  }

  if (goblin.job === 'mage') {
    if (imageName === 'goblin_mage') return 1
    return 1.18
  }

  return 1
}

// デフォルト画像
const defaultGoblinImage = require('../../../assets/goblin/goblin.png')

export function getGoblinImageKey(avatarPath: string | undefined): string | null {
  if (!avatarPath) return null
  const match = avatarPath.match(/\/([^/]+)\.png$/)
  return match ? match[1] : null
}

/**
 * アバターパスからゴブリン画像を取得
 * @param avatarPath - ゴブリンのavatarパス (例: "/src/assets/goblin/goblin.png")
 * @returns ImageSourcePropType
 */
export function getGoblinImage(avatarPath: string | undefined): ImageSourcePropType {
  if (!avatarPath) {
    return defaultGoblinImage
  }

  const imageName = getGoblinImageKey(avatarPath)
  if (imageName && imageName in goblinImages) {
    return goblinImages[imageName]
  }

  return defaultGoblinImage
}

/**
 * 種族名からゴブリン画像を取得
 * @param race - ゴブリンの種族名
 * @returns ImageSourcePropType
 */
export function getGoblinImageByRace(race: string): ImageSourcePropType {
  if (normalizeGoblinRaceId(race) === 'founder') {
    return goblinImages.marku
  }

  const variant = getGoblinVariantByRace(normalizeGoblinRaceId(race))
  if (variant && variant.imageKey in goblinImages) {
    return goblinImages[variant.imageKey]
  }

  return goblinImages.goblin
}

/**
 * 表示用のゴブリン画像を取得
 * 純ゴブリンはジョブに応じた画像を優先して表示する
 */
export function getGoblinDisplayImage(goblin: Pick<Goblin, 'avatar' | 'race' | 'job' | 'raceId'>): ImageSourcePropType {
  if (normalizeGoblinRaceId(goblin.raceId ?? goblin.race) === 'founder') {
    return goblinImages.marku
  }

  if (isBaseGoblinRaceId(goblin.raceId ?? goblin.race) && goblin.job) {
    switch (goblin.job) {
      case 'guard':
        {
          const imageName = getGoblinImageKey(goblin.avatar)
          if (imageName && goblinGuardImageKeys.has(imageName)) {
            return goblinImages[imageName]
          }
        }
        return goblinImages.goblin_guard_variant_b_heavy_tank
      case 'thief':
        {
          const imageName = getGoblinImageKey(goblin.avatar)
          if (imageName && goblinThiefImageKeys.has(imageName)) {
            return goblinImages[imageName]
          }
        }
        return goblinImages.goblin_thief
      case 'mage':
        {
          const imageName = getGoblinImageKey(goblin.avatar)
          if (imageName && goblinMageImageKeys.has(imageName)) {
            return goblinImages[imageName]
          }
        }
        return goblinImages.goblin_mage
      case 'warrior':
        {
          const imageName = getGoblinImageKey(goblin.avatar)
          if (imageName && goblinWarriorImageKeys.has(imageName)) {
            return goblinImages[imageName]
          }
        }
        return goblinImages.goblin_warrior_variant_b_heavy
      case 'cleric':
        return goblinImages.goblin_cleric
      case 'rider':
        return goblinImages.goblin_rider
    }
  }

  return getGoblinImage(goblin.avatar)
}

/**
 * 戦闘表示用のゴブリン画像を取得
 * 一部ジョブは通常表示と別の戦闘専用画像を持つ
 */
export function getGoblinBattleImage(goblin: Pick<Goblin, 'avatar' | 'race' | 'job' | 'raceId'>): ImageSourcePropType {
  if (normalizeGoblinRaceId(goblin.raceId ?? goblin.race) === 'lizardman') {
    return goblinImages.scale_goblin_battle
  }

  if (isBaseGoblinRaceId(goblin.raceId ?? goblin.race) && goblin.job === 'rider') {
    return goblinImages.goblin_rider_battle
  }

  return getGoblinDisplayImage(goblin)
}
