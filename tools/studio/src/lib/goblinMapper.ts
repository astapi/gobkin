import type { BackupDocument } from './backup'

export interface BackupGoblinStats {
  hp: number
  atk: number
  magicAtk?: number
  def: number
  magicDef?: number
  attackCount: number
  accuracy: number
  evasion: number
  magicHeal?: number
  criticalRate?: number
}

export interface BackupGoblin {
  id: number
  name: string
  race: string
  raceId?: string
  job?: string
  level: number
  experience: number
  avatar: string
  stats: BackupGoblinStats
  effectiveStats?: BackupGoblinStats
  currentHp?: number
  factors?: string[]
  variantFactorId?: string
  individualValue?: number
  mods?: unknown[]
  skills: unknown[]
  spells?: unknown[]
  battleActionPolicy?: unknown
}

export interface BackupEquipment {
  id: string
  templateId: string
  slotIndex: number
  goblinId: number | null
  titleId?: string
  titleName?: string
}

export interface BackupParty {
  id: number
  name: string
  memberIds: number[]
  status?: string
  dungeonId?: string
  dungeonTier?: number
  targetFloor?: number | null
  returnPolicy?: string
  goldMultiplier?: number
  rareMultiplier?: number
  titleMultiplier?: number
}

export interface BackupExtract {
  goblins: BackupGoblin[]
  equipmentByGoblin: Map<number, BackupEquipment[]>
  equipmentAll: BackupEquipment[]
  parties: BackupParty[]
  rawBackup: BackupDocument
}

export function extractBackup(doc: BackupDocument): BackupExtract {
  const goblinRows = doc.tables.goblins ?? []
  const equipmentRows = doc.tables.equipment ?? []
  const partyRows = doc.tables.parties ?? []

  const goblins = goblinRows
    .map(rowToBackupGoblin)
    .filter((g): g is BackupGoblin => g !== null)

  const equipmentAll = equipmentRows
    .map(rowToBackupEquipment)
    .filter((e): e is BackupEquipment => e !== null)

  const equipmentByGoblin = new Map<number, BackupEquipment[]>()
  for (const eq of equipmentAll) {
    if (eq.goblinId === null) continue
    const list = equipmentByGoblin.get(eq.goblinId) ?? []
    list.push(eq)
    equipmentByGoblin.set(eq.goblinId, list)
  }

  const parties = partyRows
    .map(rowToBackupParty)
    .filter((p): p is BackupParty => p !== null)

  goblins.sort((a, b) => a.id - b.id)
  parties.sort((a, b) => a.id - b.id)
  return { goblins, equipmentByGoblin, equipmentAll, parties, rawBackup: doc }
}

function rowToBackupGoblin(row: Record<string, unknown>): BackupGoblin | null {
  const id = toNumber(row.id)
  if (id === null) return null
  const name = toStringOrUndef(row.name) ?? ''
  const race = toStringOrUndef(row.race) ?? ''
  return {
    id,
    name,
    race,
    raceId: toStringOrUndef(row.race_id),
    job: toStringOrUndef(row.job_id),
    level: toNumber(row.level) ?? 1,
    experience: toNumber(row.experience) ?? 0,
    avatar: toStringOrUndef(row.avatar) ?? '',
    stats: parseJsonAs<BackupGoblinStats>(row.stats_json) ?? {
      hp: 0,
      atk: 0,
      def: 0,
      attackCount: 1,
      accuracy: 0,
      evasion: 0,
    },
    effectiveStats: parseJsonAs<BackupGoblinStats>(row.effective_stats_json) ?? undefined,
    currentHp: toNumber(row.current_hp) ?? undefined,
    factors: parseJsonAs<string[]>(row.factors_json) ?? undefined,
    variantFactorId: toStringOrUndef(row.variant_factor_id),
    individualValue: toNumber(row.individual_value) ?? undefined,
    mods: parseJsonAs<unknown[]>(row.mods_json) ?? undefined,
    skills: parseJsonAs<unknown[]>(row.skills_json) ?? [],
    battleActionPolicy:
      parseJsonAs<unknown>(row.battle_action_policy_json) ?? undefined,
  }
}

function rowToBackupEquipment(row: Record<string, unknown>): BackupEquipment | null {
  const id = toStringOrUndef(row.id)
  const templateId = toStringOrUndef(row.template_id)
  if (!id || !templateId) return null
  return {
    id,
    templateId,
    slotIndex: toNumber(row.slot_index) ?? -1,
    goblinId: toNumber(row.goblin_id),
    titleId: toStringOrUndef(row.title_id),
    titleName: toStringOrUndef(row.title_name),
  }
}

function rowToBackupParty(row: Record<string, unknown>): BackupParty | null {
  const id = toNumber(row.id)
  if (id === null) return null
  const name = toStringOrUndef(row.name) ?? `Party ${id}`
  const memberIds = parseJsonAs<unknown[]>(row.member_ids_json)
  const normalizedMemberIds = Array.isArray(memberIds)
    ? memberIds.map(toNumber).filter((n): n is number => n !== null)
    : []
  return {
    id,
    name,
    memberIds: normalizedMemberIds,
    status: toStringOrUndef(row.status),
    dungeonId: toStringOrUndef(row.dungeon_id),
    dungeonTier: toNumber(row.dungeon_tier) ?? undefined,
    targetFloor:
      row.target_floor === null ? null : toNumber(row.target_floor) ?? undefined,
    returnPolicy: toStringOrUndef(row.return_policy),
    goldMultiplier: toNumber(row.gold_multiplier) ?? undefined,
    rareMultiplier: toNumber(row.rare_multiplier) ?? undefined,
    titleMultiplier: toNumber(row.title_multiplier) ?? undefined,
  }
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function toStringOrUndef(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value
  return undefined
}

function parseJsonAs<T>(value: unknown): T | null {
  if (typeof value !== 'string' || value === '') return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}
