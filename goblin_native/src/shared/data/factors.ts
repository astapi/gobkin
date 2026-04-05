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
  undead: {
    id: 'undead',
    name: 'アンデッド因子',
    description: 'アンデッドの特性を宿した因子。生命力と耐毒性が増す。',
    inheritProbability: 0.2,
    effects: [
      { type: 'stat_bonus', target: 'hp', value: 80 },
      { type: 'stat_bonus', target: 'def', value: 15 }
    ],
    variantConfig: {
      probability: 0.15,
      raceName: 'アンデッドゴブリン',
      avatar: '/src/assets/goblin/undead_goblin.png',
      additionalEffects: [
        { type: 'stat_bonus', target: 'hp', value: 40 },
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
  dwarf: {
    id: 'dwarf',
    name: 'ドワーフ因子',
    description: 'ドワーフの特性を宿した因子。防御力と耐久性が大幅に増す。',
    inheritProbability: 0.2,
    effects: [
      { type: 'stat_bonus', target: 'def', value: 30 },
      { type: 'stat_bonus', target: 'hp', value: 60 }
    ],
    variantConfig: {
      probability: 0.1,
      raceName: 'ドワーフゴブリン',
      avatar: '/src/assets/goblin/dwarf_goblin.png',
      additionalEffects: [
        { type: 'stat_bonus', target: 'def', value: 20 },
        { type: 'stat_bonus', target: 'atk', value: 15 }
      ]
    }
  },
  elf: {
    id: 'elf',
    name: 'エルフ因子',
    description: 'エルフの特性を宿した因子。敏捷性と精神力が増す。',
    inheritProbability: 0.2,
    effects: [
      { type: 'stat_bonus', target: 'spd', value: 35 },
      { type: 'stat_bonus', target: 'def', value: 15 }
    ],
    variantConfig: {
      probability: 0.1,
      raceName: 'エルフゴブリン',
      avatar: '/src/assets/goblin/elf_goblin.png',
      additionalEffects: [
        { type: 'stat_bonus', target: 'spd', value: 20 },
        { type: 'stat_bonus', target: 'atk', value: 10 }
      ]
    }
  },
  lizardman: {
    id: 'lizardman',
    name: 'リザードマン因子',
    description: 'リザードマンの特性を宿した因子。全体的な耐性とHPが増す。',
    inheritProbability: 0.15,
    effects: [
      { type: 'stat_bonus', target: 'hp', value: 70 },
      { type: 'stat_bonus', target: 'def', value: 20 },
      { type: 'stat_bonus', target: 'atk', value: 10 }
    ],
    variantConfig: {
      probability: 0.1,
      raceName: 'リザードゴブリン',
      avatar: '/src/assets/goblin/lizard_goblin.png',
      additionalEffects: [
        { type: 'stat_bonus', target: 'def', value: 15 },
        { type: 'stat_bonus', target: 'spd', value: 10 }
      ]
    }
  },
  troll: {
    id: 'troll',
    name: 'トロル因子',
    description: 'トロルの特性を宿した因子。HPが大幅に増し、防御力も上がる。',
    inheritProbability: 0.15,
    effects: [
      { type: 'stat_bonus', target: 'hp', value: 150 },
      { type: 'stat_bonus', target: 'def', value: 15 }
    ],
    variantConfig: {
      probability: 0.08,
      raceName: 'トロルゴブリン',
      avatar: '/src/assets/goblin/troll_goblin.png',
      additionalEffects: [
        { type: 'stat_bonus', target: 'hp', value: 80 },
        { type: 'stat_bonus', target: 'atk', value: 20 }
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
