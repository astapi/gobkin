import type { RaceDict } from '../../core/services/DamageCalculator';

export const races: RaceDict = {
  beast: {
    label: "魔獣"
  },
  bat: {
    label: "コウモリ",
    implies: [
      "beast"
    ]
  },
  construct: {
    label: "構築物",
    implies: [
      "demon_race"
    ]
  },
  dragon: {
    label: "ドラゴン",
    physicalResistancePercent: 50,
    penetrationResistancePercent: 50,
    criticalResistancePercent: 50,
    magicResistancePercent: 50
  },
  dwarf: {
    label: "ドワーフ",
    implies: [
      "human"
    ],
    physicalResistancePercent: 20,
    penetrationResistancePercent: 20,
    criticalResistancePercent: 20,
    magicResistancePercent: 0
  },
  elf: {
    label: "エルフ",
    implies: [
      "human"
    ],
    physicalResistancePercent: 5,
    penetrationResistancePercent: 5,
    criticalResistancePercent: 1,
    magicResistancePercent: 30
  },
  harpy: {
    label: "ハーピー",
    implies: [
      "beast"
    ],
    magicResistancePercent: 20
  },
  hobbit: {
    label: "ホビット",
    implies: [
      "human"
    ],
    physicalResistancePercent: 0,
    penetrationResistancePercent: 20,
    criticalResistancePercent: 10,
    magicResistancePercent: 10
  },
  hobgoblin: {
    label: "ホブゴブリン",
    implies: [
      "beast"
    ]
  },
  goblin: {
    label: "ゴブリン",
    implies: [
      "beast"
    ]
  },
  human: {
    label: "人間",
    physicalResistancePercent: 0,
    penetrationResistancePercent: 0,
    criticalResistancePercent: 0,
    magicResistancePercent: 0
  },
  insect: {
    label: "虫",
    implies: [
      "beast"
    ]
  },
  lizardman: {
    label: "リザードマン",
    implies: [
      "beast"
    ]
  },
  minotaur: {
    label: "ミノタウロス",
    implies: [
      "beast"
    ]
  },
  orc: {
    label: "オーク",
    implies: [
      "beast"
    ]
  },
  skeleton: {
    label: "スケルトン",
    implies: [
      "undead"
    ]
  },
  slime: {
    label: "スライム",
    implies: [
      "beast"
    ]
  },
  spider: {
    label: "スパイダー",
    implies: [
      "beast"
    ]
  },
  treant: {
    label: "トレント",
    implies: [
      "beast"
    ]
  },
  troll: {
    label: "トロル",
    implies: [
      "beast"
    ]
  },
  undead: {
    label: "アンデッド"
  },
  vampire: {
    label: "ヴァンパイア",
    implies: [
      "demon_race"
    ]
  },
  wolf: {
    label: "狼",
    implies: [
      "beast"
    ]
  },
  demon_race: {
    label: "魔族"
  }
};

export type RaceResistanceSet = {
  physicalResistancePercent: number
  penetrationResistancePercent: number
  criticalResistancePercent: number
  magicResistancePercent: number
}

const ZERO_RACE_RESISTANCE: RaceResistanceSet = {
  physicalResistancePercent: 0,
  penetrationResistancePercent: 0,
  criticalResistancePercent: 0,
  magicResistancePercent: 0,
}

export function getRaceResistanceTotals(raceTags: readonly string[]): RaceResistanceSet {
  return raceTags.reduce<RaceResistanceSet>(
    (acc, raceTag) => {
      const race = races[raceTag]
      if (!race) return acc
      return {
        physicalResistancePercent: acc.physicalResistancePercent + (race.physicalResistancePercent ?? 0),
        penetrationResistancePercent: acc.penetrationResistancePercent + (race.penetrationResistancePercent ?? 0),
        criticalResistancePercent: acc.criticalResistancePercent + (race.criticalResistancePercent ?? 0),
        magicResistancePercent: acc.magicResistancePercent + (race.magicResistancePercent ?? 0),
      }
    },
    { ...ZERO_RACE_RESISTANCE },
  )
}
