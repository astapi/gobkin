export const GOBLIN_RACE_IDS = [
  'goblin',
  'slime',
  'wolf',
  'orc',
  'undead',
  'hobgoblin',
  'dwarf',
  'elf',
  'lizardman',
  'troll',
  'shadow',
] as const

export type GoblinRaceId = (typeof GOBLIN_RACE_IDS)[number]

const LEGACY_RACE_NAME_MAP: Record<string, GoblinRaceId> = {
  ゴブリン: 'goblin',
  スライムゴブリン: 'slime',
  ウルフゴブリン: 'wolf',
  オークゴブリン: 'orc',
  アンデッドゴブリン: 'undead',
  ホブゴブリン: 'hobgoblin',
  ドワーフゴブリン: 'dwarf',
  エルフゴブリン: 'elf',
  スケイルゴブリン: 'lizardman',
  トロルゴブリン: 'troll',
  シャドウゴブリン: 'shadow',
}

const RACE_ID_TO_LEGACY_NAME: Record<GoblinRaceId, string> = {
  goblin: 'ゴブリン',
  slime: 'スライムゴブリン',
  wolf: 'ウルフゴブリン',
  orc: 'オークゴブリン',
  undead: 'アンデッドゴブリン',
  hobgoblin: 'ホブゴブリン',
  dwarf: 'ドワーフゴブリン',
  elf: 'エルフゴブリン',
  lizardman: 'スケイルゴブリン',
  troll: 'トロルゴブリン',
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

export function getLegacyRaceName(raceId: GoblinRaceId): string {
  return RACE_ID_TO_LEGACY_NAME[raceId]
}
