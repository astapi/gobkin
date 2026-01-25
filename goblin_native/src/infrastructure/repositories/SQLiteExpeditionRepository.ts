/**
 * SQLiteを使用した遠征記録リポジトリ実装
 * 内部キャッシュを使用して同期的なインターフェースを提供
 */
import type { ExpeditionRecord, ExpeditionReplay, ExpeditionRequest } from '../../shared/types'
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
  created_at: string
  updated_at: string
}

export interface IExpeditionRepository {
  getAll(): ExpeditionRecord[]
  getById(id: string): ExpeditionRecord | null
  getByPartyId(partyId: number): ExpeditionRecord[]
  getOngoing(): ExpeditionRecord[]
  save(record: ExpeditionRecord): void
  delete(id: string): void
  complete(id: string, replay: ExpeditionReplay): void
}

export class SQLiteExpeditionRepository implements IExpeditionRepository {
  private static instance: SQLiteExpeditionRepository | null = null
  private cache: Map<string, ExpeditionRecord> = new Map()
  private initialized = false
  private onDataChangeCallback: (() => void) | null = null

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(): SQLiteExpeditionRepository {
    if (!SQLiteExpeditionRepository.instance) {
      SQLiteExpeditionRepository.instance = new SQLiteExpeditionRepository()
    }
    return SQLiteExpeditionRepository.instance
  }

  /**
   * リポジトリを初期化し、DBからデータをロード
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    const db = await getDatabase()
    const rows = await db.getAllAsync<ExpeditionRow>(
      'SELECT * FROM expeditions ORDER BY created_at DESC'
    )

    this.cache.clear()
    for (const row of rows) {
      const record = this.rowToRecord(row)
      this.cache.set(record.id, record)
    }

    this.initialized = true
  }

  /**
   * データ変更時のコールバックを設定
   */
  setOnDataChange(callback: () => void): void {
    this.onDataChangeCallback = callback
  }

  /**
   * 全遠征記録を取得
   */
  getAll(): ExpeditionRecord[] {
    return Array.from(this.cache.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  /**
   * 指定IDの遠征記録を取得
   */
  getById(id: string): ExpeditionRecord | null {
    return this.cache.get(id) ?? null
  }

  /**
   * 指定パーティの遠征記録を取得
   */
  getByPartyId(partyId: number): ExpeditionRecord[] {
    return Array.from(this.cache.values())
      .filter(r => r.partyId === partyId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  /**
   * 進行中の遠征記録を取得
   */
  getOngoing(): ExpeditionRecord[] {
    return Array.from(this.cache.values()).filter(r => r.status === 'ongoing')
  }

  /**
   * 遠征記録を保存
   */
  save(record: ExpeditionRecord): void {
    this.cache.set(record.id, record)

    this.saveAsync(record).catch(err => {
      console.error('[SQLiteExpeditionRepository] Failed to save:', err)
    })

    this.notifyDataChange()
  }

  /**
   * 遠征記録を削除
   */
  delete(id: string): void {
    this.cache.delete(id)

    this.deleteAsync(id).catch(err => {
      console.error('[SQLiteExpeditionRepository] Failed to delete:', err)
    })

    this.notifyDataChange()
  }

  /**
   * 遠征を完了状態にする
   */
  complete(id: string, replay: ExpeditionReplay): void {
    const record = this.cache.get(id)
    if (!record) return

    const updated: ExpeditionRecord = {
      ...record,
      status: replay.summary.success ? 'completed' : 'failed',
      returnTime: new Date(),
      replay,
      updatedAt: new Date(),
    }

    this.save(updated)
  }

  // --- Private methods ---

  private async saveAsync(record: ExpeditionRecord): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      `INSERT INTO expeditions
       (id, party_id, party_name, dungeon_id, dungeon_name, start_time, return_time,
        status, return_policy, replay_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
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
      ]
    )
  }

  private async deleteAsync(id: string): Promise<void> {
    const db = await getDatabase()
    await db.runAsync('DELETE FROM expeditions WHERE id = ?', [id])
  }

  private rowToRecord(row: ExpeditionRow): ExpeditionRecord {
    return {
      id: row.id,
      userId: '', // SQLite版ではローカルユーザーのみ
      partyId: row.party_id,
      partyName: row.party_name,
      dungeonId: row.dungeon_id,
      dungeonName: row.dungeon_name,
      startTime: new Date(row.start_time),
      returnTime: row.return_time ? new Date(row.return_time) : null,
      status: row.status as ExpeditionRecord['status'],
      returnPolicy: row.return_policy as ExpeditionRequest['returnPolicy'],
      replay: row.replay_json ? JSON.parse(row.replay_json) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }
  }

  private notifyDataChange(): void {
    if (this.onDataChangeCallback) {
      this.onDataChangeCallback()
    }
  }
}
