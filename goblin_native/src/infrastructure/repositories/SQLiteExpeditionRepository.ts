/**
 * SQLiteを使用した遠征記録リポジトリ実装
 * DBから直接読み書きする設計
 */
import type { ExpeditionRecord, ExpeditionMeta, ExpeditionReplay, ExpeditionRequest } from '../../shared/types'
import { getDatabase } from '../database'

interface ExpeditionRow {
  id: string
  party_id: number
  party_name: string
  dungeon_id: string
  dungeon_name: string
  start_time: string
  return_time: string | null
  status: string
  return_policy: string
  replay_json: string | null
  expedition_meta_json: string | null
  created_at: string
  updated_at: string
}

export interface IExpeditionRepository {
  getAll(): Promise<ExpeditionRecord[]>
  getById(id: string): Promise<ExpeditionRecord | null>
  getByPartyId(partyId: number): Promise<ExpeditionRecord[]>
  getOngoing(): Promise<ExpeditionRecord[]>
  save(record: ExpeditionRecord): Promise<void>
  updateReplay(id: string, replay: ExpeditionReplay): Promise<void>
  delete(id: string): Promise<void>
  complete(id: string, replay: ExpeditionReplay): Promise<boolean>
  pruneOldCompleted(max: number): Promise<number>
}

export const MAX_EXPEDITION_HISTORY = 50

export class SQLiteExpeditionRepository implements IExpeditionRepository {
  private static instance: SQLiteExpeditionRepository | null = null

  static getInstance(): SQLiteExpeditionRepository {
    if (!SQLiteExpeditionRepository.instance) {
      SQLiteExpeditionRepository.instance = new SQLiteExpeditionRepository()
    }
    return SQLiteExpeditionRepository.instance
  }

  async getAll(): Promise<ExpeditionRecord[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<ExpeditionRow>(
      'SELECT * FROM expeditions ORDER BY created_at DESC'
    )
    return rows.map(row => this.rowToRecord(row))
  }

  async getById(id: string): Promise<ExpeditionRecord | null> {
    const db = await getDatabase()
    const row = await db.getFirstAsync<ExpeditionRow>(
      'SELECT * FROM expeditions WHERE id = ?',
      [id]
    )
    return row ? this.rowToRecord(row) : null
  }

  async getByPartyId(partyId: number): Promise<ExpeditionRecord[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<ExpeditionRow>(
      'SELECT * FROM expeditions WHERE party_id = ? ORDER BY created_at DESC',
      [partyId]
    )
    return rows.map(row => this.rowToRecord(row))
  }

  async getOngoing(): Promise<ExpeditionRecord[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<ExpeditionRow>(
      "SELECT * FROM expeditions WHERE status = 'ongoing' ORDER BY created_at DESC"
    )
    return rows.map(row => this.rowToRecord(row))
  }

  async save(record: ExpeditionRecord): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      `INSERT INTO expeditions
       (id, party_id, party_name, dungeon_id, dungeon_name, start_time, return_time,
        status, return_policy, replay_json, expedition_meta_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
        party_id = excluded.party_id,
        party_name = excluded.party_name,
        dungeon_id = excluded.dungeon_id,
        dungeon_name = excluded.dungeon_name,
        start_time = excluded.start_time,
        return_time = excluded.return_time,
        status = excluded.status,
        return_policy = excluded.return_policy,
        replay_json = excluded.replay_json,
        expedition_meta_json = excluded.expedition_meta_json,
        updated_at = datetime('now')`,
      [
        record.id,
        record.partyId,
        record.partyName,
        record.dungeonId,
        record.dungeonName,
        record.startTime.toISOString(),
        record.returnTime?.toISOString() ?? null,
        record.status,
        record.returnPolicy,
        record.replay ? JSON.stringify(record.replay) : null,
        record.expeditionMeta ? JSON.stringify(record.expeditionMeta) : null,
      ]
    )
  }

  async updateReplay(id: string, replay: ExpeditionReplay): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      `UPDATE expeditions SET replay_json = ?, updated_at = datetime('now') WHERE id = ?`,
      [JSON.stringify(replay), id]
    )
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase()
    await db.runAsync('DELETE FROM expeditions WHERE id = ?', [id])
  }

  /**
   * 完了・失敗した遠征履歴を最大 max 件まで残し、古いものを削除する。
   * ongoing な遠征は対象外（進行中のものは必ず保持）。
   * @returns 削除された行数
   */
  async pruneOldCompleted(max: number): Promise<number> {
    if (max < 0) return 0
    const db = await getDatabase()
    const result = await db.runAsync(
      `DELETE FROM expeditions
       WHERE status != 'ongoing'
         AND id NOT IN (
           SELECT id FROM expeditions
           WHERE status != 'ongoing'
           ORDER BY created_at DESC
           LIMIT ?
         )`,
      [max]
    )
    return result.changes ?? 0
  }

  async complete(id: string, replay: ExpeditionReplay): Promise<boolean> {
    const db = await getDatabase()
    const status = replay.summary.success ? 'completed' : 'failed'
    const result = await db.runAsync(
      `UPDATE expeditions
       SET status = ?, return_time = ?, replay_json = ?, updated_at = datetime('now')
       WHERE id = ? AND status = 'ongoing'`,
      [status, new Date().toISOString(), JSON.stringify(replay), id]
    )
    return (result.changes ?? 0) > 0
  }

  private rowToRecord(row: ExpeditionRow): ExpeditionRecord {
    return {
      id: row.id,
      userId: '',
      partyId: row.party_id,
      partyName: row.party_name,
      dungeonId: row.dungeon_id,
      dungeonName: row.dungeon_name,
      startTime: new Date(row.start_time),
      returnTime: row.return_time ? new Date(row.return_time) : null,
      status: row.status as ExpeditionRecord['status'],
      returnPolicy: row.return_policy as ExpeditionRequest['returnPolicy'],
      replay: row.replay_json ? JSON.parse(row.replay_json) : undefined,
      expeditionMeta: row.expedition_meta_json ? JSON.parse(row.expedition_meta_json) as ExpeditionMeta : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }
  }
}
