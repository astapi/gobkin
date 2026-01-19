import type { Goblin } from '../types'
import { factorDatabase } from '../data/factors'

const DEFAULT_AVATAR = '/src/assets/goblin/goblin.png'

const raceAvatarMap: Record<string, string> = {
  'ホブゴブリン': '/src/assets/goblin/hobgoblin.png',
  'ウルフゴブリン': '/src/assets/goblin/wolf_goblin.png',
  'スライムゴブリン': '/src/assets/goblin/slime_goblin.png',
  'オークゴブリン': '/src/assets/goblin/orc_goblin.png',
  'ゴブリン': DEFAULT_AVATAR,
}

export const getGoblinAvatar = (goblin?: Goblin | null): string => {
  if (!goblin) {
    return DEFAULT_AVATAR
  }

  if (goblin.avatar && goblin.avatar !== DEFAULT_AVATAR) {
    return goblin.avatar
  }

  if (goblin.variantFactorId) {
    const variantAvatar = factorDatabase[goblin.variantFactorId]?.variantConfig?.avatar
    if (variantAvatar) {
      return variantAvatar
    }
  }

  if (goblin.race && goblin.race in raceAvatarMap) {
    return raceAvatarMap[goblin.race]
  }

  return goblin.avatar ?? DEFAULT_AVATAR
}
