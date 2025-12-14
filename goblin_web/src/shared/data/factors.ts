import type { Factor } from '../types/Factor'

/**
 * 因子マスターデータ
 */
export const factorDatabase: Record<string, Factor> = {
  slime: {
    id: 'slime',
    name: 'スライム因子',
    description: 'スライムの特性を宿した因子。耐久性が増す。',
    inheritProbability: 0.3,  // 30%で引き継ぎ
    effects: [
      { type: 'stat_bonus', target: 'hp', value: 100 }
    ],
    variantConfig: {
      probability: 0.2,  // 因子引き継ぎ時20%で亜種化
      raceName: 'スライムゴブリン',
      avatar: '/src/assets/goblin/slime_goblin.png',
      additionalEffects: [
        { type: 'stat_bonus', target: 'def', value: 20 }
      ]
    }
  },
  forest: {
    id: 'forest',
    name: 'ウルフ因子',
    description: 'ウルフの特性を宿した因子。敏捷性が増す。',
    inheritProbability: 0.25,  // 25%で引き継ぎ
    effects: [
      { type: 'stat_bonus', target: 'spd', value: 30 },
      { type: 'stat_bonus', target: 'atk', value: 15 }
    ],
    variantConfig: {
      probability: 0.15,
      raceName: 'ウルフゴブリン',
      avatar: '/src/assets/goblin/wolf_goblin.png',
      additionalEffects: [
        { type: 'stat_bonus', target: 'spd', value: 20 }
      ]
    }
  },
}

/**
 * 因子IDから因子データを取得
 */
export function getFactor(factorId: string): Factor | undefined {
  return factorDatabase[factorId]
}

/**
 * 全因子のリストを取得
 */
export function getAllFactors(): Factor[] {
  return Object.values(factorDatabase)
}
