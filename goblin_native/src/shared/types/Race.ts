export const GOBLIN_RACE_IDS = [
  'goblin',
  'founder',
  'elder',
  'gale',
  'slime',
  'wolf',
  'orc',
  'undead',
  'hobgoblin',
  'dwarf',
  'elf',
  'harpy',
  'hobbit',
  'lizardman',
  'minotaur',
  'troll',
  'vampire',
  'dragon',
  'shadow',
] as const

export type GoblinRaceId = (typeof GOBLIN_RACE_IDS)[number]

const LEGACY_RACE_NAME_MAP: Record<string, GoblinRaceId> = {
  ゴブリン: 'goblin',
  始祖ゴブリン: 'founder',
  古強者ゴブリン: 'elder',
  疾風ゴブリン: 'gale',
  スライムゴブリン: 'slime',
  ウルフゴブリン: 'wolf',
  オークゴブリン: 'orc',
  アンデッドゴブリン: 'undead',
  ホブゴブリン: 'hobgoblin',
  ドワーフゴブリン: 'dwarf',
  アイアンゴブリン: 'dwarf',
  エルフゴブリン: 'elf',
  フェイゴブリン: 'elf',
  スカイゴブリン: 'harpy',
  スクラッパーゴブリン: 'hobbit',
  スケイルゴブリン: 'lizardman',
  ゴズゴブリン: 'minotaur',
  トロルゴブリン: 'troll',
  ヴァンプゴブリン: 'vampire',
  ドラゴンゴブリン: 'dragon',
  シャドウゴブリン: 'shadow',
}

const RACE_ID_TO_LEGACY_NAME: Record<GoblinRaceId, string> = {
  goblin: 'ゴブリン',
  founder: '始祖ゴブリン',
  elder: '古強者ゴブリン',
  gale: '疾風ゴブリン',
  slime: 'スライムゴブリン',
  wolf: 'ウルフゴブリン',
  orc: 'オークゴブリン',
  undead: 'アンデッドゴブリン',
  hobgoblin: 'ホブゴブリン',
  dwarf: 'アイアンゴブリン',
  elf: 'フェイゴブリン',
  harpy: 'スカイゴブリン',
  hobbit: 'スクラッパーゴブリン',
  lizardman: 'スケイルゴブリン',
  minotaur: 'ゴズゴブリン',
  troll: 'トロルゴブリン',
  vampire: 'ヴァンプゴブリン',
  dragon: 'ドラゴンゴブリン',
  shadow: 'シャドウゴブリン',
}

export function isGoblinRaceId(value: string): value is GoblinRaceId {
  return (GOBLIN_RACE_IDS as readonly string[]).includes(value)
}

export function normalizeGoblinRaceId(value?: string | null): GoblinRaceId {
  if (!value) return 'goblin'
  if (isGoblinRaceId(value)) return value
  return LEGACY_RACE_NAME_MAP[value] ?? 'goblin'
}

export function isBaseGoblinRaceId(value: string): boolean {
  const raceId = normalizeGoblinRaceId(value)
  return raceId === 'goblin' || raceId === 'founder'
}

export function getLegacyRaceName(raceId: GoblinRaceId): string {
  return RACE_ID_TO_LEGACY_NAME[raceId]
}
