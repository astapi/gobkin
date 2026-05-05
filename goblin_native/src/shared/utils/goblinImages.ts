import { ImageSourcePropType } from 'react-native'
import type { Goblin } from '@/shared/types'
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
  goblin_thief: require('../../../assets/goblin/goblin_thief_variant_b_treasure.png'),
  goblin_thief_original: require('../../../assets/goblin/goblin_thief_original.png'),
  goblin_thief_variant_a_speed: require('../../../assets/goblin/goblin_thief_variant_a_speed.png'),
  goblin_thief_variant_b_treasure: require('../../../assets/goblin/goblin_thief_variant_b_treasure.png'),
  goblin_thief_variant_c_assassin: require('../../../assets/goblin/goblin_thief_variant_c_assassin.png'),
  goblin_thief_variant_d_gold_snatcher: require('../../../assets/goblin/goblin_thief_variant_d_gold_snatcher.png'),
  goblin_mage: require('../../../assets/goblin/goblin_mage.png'),
  goblin_warrior: require('../../../assets/goblin/goblin_warrior.png'),
  goblin_cleric: require('../../../assets/goblin/goblin_cleric.png'),
  goblin_rider: require('../../../assets/goblin/goblin_rider.png'),
  goblin_rider_battle: require('../../../assets/goblin/goblin_rider_battle.png'),
}

export const GOBLIN_THIEF_IMAGE_OPTIONS = [
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
] as const

const goblinThiefImageKeys: Set<string> = new Set(GOBLIN_THIEF_IMAGE_OPTIONS.map(option => option.key))

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
        return goblinImages.goblin_guard
      case 'thief':
        {
          const imageName = getGoblinImageKey(goblin.avatar)
          if (imageName && goblinThiefImageKeys.has(imageName)) {
            return goblinImages[imageName]
          }
        }
        return goblinImages.goblin_thief
      case 'mage':
        return goblinImages.goblin_mage
      case 'warrior':
        return goblinImages.goblin_warrior
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
