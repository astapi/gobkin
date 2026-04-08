import { ImageSourcePropType } from 'react-native'
import type { Goblin } from '@/shared/types'

// ゴブリン画像のマッピング
const goblinImages: Record<string, ImageSourcePropType> = {
  goblin: require('../../../assets/goblin/goblin.png'),
  hobgoblin: require('../../../assets/goblin/hobgoblin.png'),
  wolf_goblin: require('../../../assets/goblin/wolf_goblin.png'),
  slime_goblin: require('../../../assets/goblin/slime_goblin.png'),
  goblin_guard: require('../../../assets/goblin/goblin_guard.png'),
  goblin_thief: require('../../../assets/goblin/goblin_thief.png'),
  goblin_mage: require('../../../assets/goblin/goblin_mage.png'),
  goblin_warrior: require('../../../assets/goblin/goblin_warrior.png'),
}

// デフォルト画像
const defaultGoblinImage = require('../../../assets/goblin/goblin.png')

/**
 * アバターパスからゴブリン画像を取得
 * @param avatarPath - ゴブリンのavatarパス (例: "/src/assets/goblin/goblin.png")
 * @returns ImageSourcePropType
 */
export function getGoblinImage(avatarPath: string | undefined): ImageSourcePropType {
  if (!avatarPath) {
    return defaultGoblinImage
  }

  // パスからファイル名を抽出 (例: "goblin.png" -> "goblin")
  const match = avatarPath.match(/\/([^/]+)\.png$/)
  if (match) {
    const imageName = match[1]
    if (imageName in goblinImages) {
      return goblinImages[imageName]
    }
  }

  return defaultGoblinImage
}

/**
 * 種族名からゴブリン画像を取得
 * @param race - ゴブリンの種族名
 * @returns ImageSourcePropType
 */
export function getGoblinImageByRace(race: string): ImageSourcePropType {
  switch (race) {
    case 'ホブゴブリン':
      return goblinImages.hobgoblin
    case 'ウルフゴブリン':
      return goblinImages.wolf_goblin
    case 'スライムゴブリン':
      return goblinImages.slime_goblin
    case 'ゴブリン':
    default:
      return goblinImages.goblin
  }
}

/**
 * 表示用のゴブリン画像を取得
 * 純ゴブリンはジョブに応じた画像を優先して表示する
 */
export function getGoblinDisplayImage(goblin: Pick<Goblin, 'avatar' | 'race' | 'job'>): ImageSourcePropType {
  if (goblin.race === 'ゴブリン' && goblin.job) {
    switch (goblin.job) {
      case 'guard':
        return goblinImages.goblin_guard
      case 'thief':
        return goblinImages.goblin_thief
      case 'mage':
        return goblinImages.goblin_mage
      case 'warrior':
        return goblinImages.goblin_warrior
    }
  }

  return getGoblinImage(goblin.avatar)
}
