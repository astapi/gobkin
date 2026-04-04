/**
 * SQLiteを使用したパーティリポジトリ実装
 * DBから直接読み書きする設計
 */
import type { Party, PartyStatus, ExpeditionRequest } from '../../shared/types'
import type { IPartyRepository } from '../../core/repositories/IPartyRepository'
import { getDatabase } from '../database'

interface PartyRow {
  id: number
  name: string
  member_ids_json: string
  status: string | null
  dungeon_id: string | null
  target_floor: number | null
  return_policy: string | null
  created_at: string
  updated_at: string
}

export class SQLitePartyRepository implements IPartyRepository {
  private static instance: SQLitePartyRepository | null = null

  static getInstance(): SQLitePartyRepository {
    if (!SQLitePartyRepository.instance) {
      SQLitePartyRepository.instance = new SQLitePartyRepository()
    }
    return SQLitePartyRepository.instance
  }

  async getParties(): Promise<Party[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<PartyRow>('SELECT * FROM parties ORDER BY id')
    return rows.map(row => this.rowToParty(row))
  }

  async getParty(id: number): Promise<Party | null> {
    const db = await getDatabase()
    const row = await db.getFirstAsync<PartyRow>('SELECT * FROM parties WHERE id = ?', [id])
    return row ? this.rowToParty(row) : null
  }

  async saveParty(party: Party): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      `INSERT OR REPLACE INTO parties
       (id, name, member_ids_json, status, dungeon_id, target_floor, return_policy, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        party.id,
        party.name,
        JSON.stringify(party.memberIds),
        party.status ?? 'idle',
        party.dungeonId ?? null,
        party.targetFloor ?? null,
        party.returnPolicy ?? null,
      ]
    )
  }

  async deleteParty(id: number): Promise<void> {
    const db = await getDatabase()
    await db.runAsync('DELETE FROM parties WHERE id = ?', [id])
  }

  async updatePartyStatus(id: number, status: PartyStatus): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      "UPDATE parties SET status = ?, updated_at = datetime('now') WHERE id = ?",
      [status, id]
    )
  }

  async getPartiesByStatus(status: PartyStatus): Promise<Party[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<PartyRow>('SELECT * FROM parties WHERE status = ? ORDER BY id', [status])
    return rows.map(row => this.rowToParty(row))
  }

  async updateDungeonSettings(id: number, dungeonId: string): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      "UPDATE parties SET dungeon_id = ?, updated_at = datetime('now') WHERE id = ?",
      [dungeonId, id]
    )
  }

  async updateFloorTarget(id: number, targetFloor: number | null): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      "UPDATE parties SET target_floor = ?, updated_at = datetime('now') WHERE id = ?",
      [targetFloor, id]
    )
  }

  async updateReturnPolicy(id: number, returnPolicy: ExpeditionRequest['returnPolicy']): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      "UPDATE parties SET return_policy = ?, updated_at = datetime('now') WHERE id = ?",
      [returnPolicy, id]
    )
  }

  private rowToParty(row: PartyRow): Party {
    return {
      id: row.id,
      name: row.name,
      memberIds: JSON.parse(row.member_ids_json),
      status: (row.status as PartyStatus) ?? undefined,
      dungeonId: row.dungeon_id ?? undefined,
      targetFloor: row.target_floor ?? undefined,
      returnPolicy: (row.return_policy as ExpeditionRequest['returnPolicy']) ?? undefined,
    }
  }
}
