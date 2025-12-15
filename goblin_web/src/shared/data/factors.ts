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
  wolf: {
    id: 'wolf',
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
  orc: {
    id: 'orc',
    name: 'オーク因子',
    description: 'オークの特性を宿した因子。攻撃力と防御力が増す。',
    inheritProbability: 0.2,  // 20%で引き継ぎ
    effects: [
      { type: 'stat_bonus', target: 'atk', value: 25 },
      { type: 'stat_bonus', target: 'def', value: 20 }
    ],
    variantConfig: {
      probability: 0.1,  // 因子引き継ぎ時10%で亜種化
      raceName: 'オークゴブリン',
      avatar: '/src/assets/goblin/orc_goblin.png',
      additionalEffects: [
        { type: 'stat_bonus', target: 'hp', value: 50 },
        { type: 'stat_bonus', target: 'atk', value: 10 }
      ]
    }
  },
  hobgoblin: {
    id: 'hobgoblin',
    name: 'ホブゴブリン因子',
    description: '上位ゴブリンの特性を宿した因子。全能力が底上げされる。',
    inheritProbability: 0.25,  // 25%で引き継ぎ
    effects: [
      { type: 'stat_bonus', target: 'atk', value: 15 },
      { type: 'stat_bonus', target: 'def', value: 10 },
      { type: 'stat_bonus', target: 'spd', value: 10 }
    ],
    variantConfig: {
      probability: 0.2,  // 因子引き継ぎ時20%で亜種化
      raceName: 'ホブゴブリン',
      avatar: '/src/assets/goblin/hobgoblin.png',
      additionalEffects: [
        { type: 'stat_bonus', target: 'hp', value: 30 },
        { type: 'stat_bonus', target: 'atk', value: 10 }
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
