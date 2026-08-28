import type { GoblinRaceId } from '../types/Race'

export type NamedGoblinSeedStats = {
  hp: number
  atk: number
  def: number
  attackCount: number
  accuracy: number
  evasion: number
}

/**
 * ストーリー読了報酬で加入するネームド固有種ユニットの種データ。
 * `founderGoblin.ts`（マルク）の形式を一般化したもの。
 * `key` は stories.json の `{ type: 'named_goblin', value: <key> }` と対応する。
 */
export type NamedGoblinSeed = {
  key: string
  name: string
  race: string
  raceId: GoblinRaceId
  level: number
  experience: number
  avatar: string
  stats: NamedGoblinSeedStats
  defaultSkillIds: string[]
}

export const namedGoblinSeeds: Record<string, NamedGoblinSeed> = {
  // ギド: 群れ最古参の前衛タンク。story_after_forest 読了で序盤に加入する。
  gido: {
    key: 'gido',
    name: 'ギド',
    race: '古強者ゴブリン',
    raceId: 'elder',
    level: 1,
    experience: 0,
    avatar: '/src/assets/goblin/gido.png',
    stats: {
      hp: 90,
      atk: 10,
      def: 16,
      attackCount: 1,
      accuracy: 120,
      evasion: 8,
    },
    defaultSkillIds: ['cover_low_hp_ally', 'physical_reduction_10'],
  },
  // ラグ: 初代ウルフライダーの高速アタッカー。story_after_wolf_grassland 読了で中盤に加入する。
  ragu: {
    key: 'ragu',
    name: 'ラグ',
    race: '疾風ゴブリン',
    raceId: 'gale',
    level: 20,
    experience: 0,
    avatar: '/src/assets/goblin/ragu.png',
    stats: {
      hp: 210,
      atk: 60,
      def: 30,
      attackCount: 3,
      accuracy: 155,
      evasion: 85,
    },
    defaultSkillIds: ['attack_count_up_2', 'evasion_up_40'],
  },
}

export function getNamedGoblinSeed(key: string): NamedGoblinSeed | undefined {
  return namedGoblinSeeds[key]
}

export function getNamedGoblinSeedByRaceId(raceId: GoblinRaceId): NamedGoblinSeed | undefined {
  return Object.values(namedGoblinSeeds).find((seed) => seed.raceId === raceId)
}

/**
 * `{ type: 'named_goblin_skill', value: <skillId> }` 報酬で付与する固有スキルと、
 * その付与対象のネームド固有種（seed key）の対応表。
 * 例: 「ギドの遺志」(`gido_no_ishi`) はギド (`gido`) に付与する。
 */
export const namedGoblinSkillRewardTargets: Record<string, string> = {
  gido_no_ishi: 'gido',
}

/** named_goblin_skill 報酬のスキルidから、付与対象のネームド固有種の種データを解決する。 */
export function getNamedGoblinSeedBySkillReward(skillId: string): NamedGoblinSeed | undefined {
  const key = namedGoblinSkillRewardTargets[skillId]
  return key ? namedGoblinSeeds[key] : undefined
}
