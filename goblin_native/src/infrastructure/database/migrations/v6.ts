import type * as SQLite from 'expo-sqlite'

const SKILL_ID_RENAMES: Record<string, string> = {
  slime_armor_mastery: 'armor_mastery_130',
  hobgoblin_inspire: 'inspire_150',
  hobgoblin_guts: 'survive_lethal_hp1',
  wolf_attack_count_up: 'attack_count_up_2',
  wolf_accuracy_boost: 'equipment_accuracy_200',
  wolf_additional_damage: 'additional_damage_13',
  goblin_job_guard_armor: 'armor_mastery_150',
  goblin_job_guard_wall: 'physical_reduction_5',
  goblin_job_guard_cover: 'cover_low_hp_ally',
  goblin_job_thief_initiative: 'action_order_150',
  goblin_job_thief_evasion: 'evasion_150',
  goblin_job_mage_fireball: 'grant_fireball',
  goblin_job_mage_magic_arrow: 'grant_magic_arrow',
  goblin_job_mage_blizzard: 'grant_blizzard',
  goblin_job_warrior_armor: 'armor_mastery_120',
  goblin_job_warrior_inspire: 'inspire_150',
  claw_sharp_attack_count_1: 'attack_count_up_1',
  claw_beast_attack_count_2: 'attack_count_up_2',
  claw_copper_attack_count_3: 'attack_count_up_3',
  claw_iron_attack_count_4: 'attack_count_up_4',
  claw_steel_attack_count_5: 'attack_count_up_5',
  claw_mithril_attack_count_6: 'attack_count_up_6',
  claw_royal_attack_count_7: 'attack_count_up_7',
  claw_kaiser_attack_count_8: 'attack_count_up_8',
  claw_ancient_attack_count_9: 'attack_count_up_9',
  claw_dragon_attack_count_10: 'attack_count_up_10',
  claw_adamant_attack_count_11: 'attack_count_up_11',
  armor_tattered_cloth_physical_reduction: 'physical_reduction_1',
  armor_leather_vest_physical_reduction: 'physical_reduction_2',
  armor_fur_vest_physical_reduction: 'physical_reduction_3',
  armor_armor_physical_reduction: 'physical_reduction_6',
  armor_mithril_physical_reduction: 'physical_reduction_7',
  armor_royal_physical_reduction: 'physical_reduction_8',
  armor_kaiser_physical_reduction: 'physical_reduction_9',
  armor_ancient_physical_reduction: 'physical_reduction_10',
  armor_dragon_physical_reduction: 'physical_reduction_11',
  armor_adamant_physical_reduction: 'physical_reduction_12',
}

function migrateSkillIds(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(migrateSkillIds)
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const record = value as Record<string, unknown>
  const migratedEntries = Object.entries(record).map(([key, nestedValue]) => [key, migrateSkillIds(nestedValue)])
  const migratedRecord = Object.fromEntries(migratedEntries)

  if (typeof migratedRecord.id === 'string' && migratedRecord.id in SKILL_ID_RENAMES) {
    migratedRecord.id = SKILL_ID_RENAMES[migratedRecord.id]
  }

  return migratedRecord
}

async function migrateJsonColumn(
  database: SQLite.SQLiteDatabase,
  table: string,
  idColumn: string,
  jsonColumn: string
): Promise<void> {
  const rows = await database.getAllAsync<Record<string, string | number | null>>(
    `SELECT ${idColumn}, ${jsonColumn} FROM ${table}`
  )

  for (const row of rows) {
    const rawValue = row[jsonColumn]
    if (typeof rawValue !== 'string' || rawValue.length === 0) continue

    try {
      const parsed = JSON.parse(rawValue)
      const migrated = migrateSkillIds(parsed)
      const nextValue = JSON.stringify(migrated)

      if (nextValue === rawValue) continue

      await database.runAsync(
        `UPDATE ${table} SET ${jsonColumn} = ? WHERE ${idColumn} = ?`,
        [nextValue, row[idColumn] as string | number]
      )
    } catch {
      // 既存データが壊れている場合は移行を継続する
    }
  }
}

export const migrateV6 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  await migrateJsonColumn(database, 'goblins', 'id', 'skills_json')
  await migrateJsonColumn(database, 'pending_goblins', 'id', 'skills_json')
  await migrateJsonColumn(database, 'expeditions', 'id', 'replay_json')
}
