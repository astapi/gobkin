import type { IGoblinBirthSlotRepository } from '../../core/repositories'
import type { GoblinBirthSlot, GoblinBirthSourceSnapshot } from '../../shared/types'
import { getDatabase } from '../database'

interface GoblinBirthSlotRow {
  slot_index: number
  source_goblin_id: number
  is_active: number
  cycle_started_at: string | null
  next_birth_at: string | null
  source_snapshots_json: string
}

export class SQLiteGoblinBirthSlotRepository implements IGoblinBirthSlotRepository {
  private static instance: SQLiteGoblinBirthSlotRepository | null = null

  static getInstance(): SQLiteGoblinBirthSlotRepository {
    if (!SQLiteGoblinBirthSlotRepository.instance) {
      SQLiteGoblinBirthSlotRepository.instance = new SQLiteGoblinBirthSlotRepository()
    }
    return SQLiteGoblinBirthSlotRepository.instance
  }

  async getAll(): Promise<GoblinBirthSlot[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<GoblinBirthSlotRow>(
      'SELECT * FROM goblin_birth_slots ORDER BY slot_index',
    )
    return rows.map((row) => this.rowToSlot(row))
  }

  async save(slot: GoblinBirthSlot): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      `INSERT INTO goblin_birth_slots (
        slot_index, source_goblin_id, is_active,
        cycle_started_at, next_birth_at, source_snapshots_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(slot_index) DO UPDATE SET
        source_goblin_id = excluded.source_goblin_id,
        is_active = excluded.is_active,
        cycle_started_at = excluded.cycle_started_at,
        next_birth_at = excluded.next_birth_at,
        source_snapshots_json = excluded.source_snapshots_json,
        updated_at = excluded.updated_at`,
      [
        slot.slotIndex,
        slot.sourceGoblinId,
        slot.isActive ? 1 : 0,
        slot.cycleStartedAt ?? null,
        slot.nextBirthAt ?? null,
        JSON.stringify(slot.sourceSnapshots),
      ],
    )
  }

  async remove(slotIndex: number): Promise<void> {
    const db = await getDatabase()
    await db.runAsync('DELETE FROM goblin_birth_slots WHERE slot_index = ?', [slotIndex])
  }

  private rowToSlot(row: GoblinBirthSlotRow): GoblinBirthSlot {
    let sourceSnapshots: GoblinBirthSourceSnapshot[] = []
    try {
      const parsed = JSON.parse(row.source_snapshots_json) as unknown
      if (Array.isArray(parsed)) {
        sourceSnapshots = parsed.filter((value): value is GoblinBirthSourceSnapshot => (
          typeof value === 'object' &&
          value !== null &&
          typeof (value as GoblinBirthSourceSnapshot).goblinId === 'number' &&
          Array.isArray((value as GoblinBirthSourceSnapshot).factors)
        ))
        sourceSnapshots = sourceSnapshots.map((snapshot) => ({
          goblinId: snapshot.goblinId,
          plusValue: typeof snapshot.plusValue === 'number' ? snapshot.plusValue : 0,
          factors: snapshot.factors,
        }))
      }
    } catch {
      sourceSnapshots = []
    }

    return {
      slotIndex: row.slot_index,
      sourceGoblinId: row.source_goblin_id,
      isActive: row.is_active === 1,
      cycleStartedAt: row.cycle_started_at ?? undefined,
      nextBirthAt: row.next_birth_at ?? undefined,
      sourceSnapshots,
    }
  }
}
