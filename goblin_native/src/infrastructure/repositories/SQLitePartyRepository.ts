/**
 * SQLiteを使用したパーティリポジトリ実装
 * 内部キャッシュを使用して同期的なインターフェースを提供
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
  private cache: Map<number, Party> = new Map()
  private initialized = false
  private onDataChangeCallback: (() => void) | null = null

  /**
   * リポジトリを初期化し、DBからデータをロード
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    await this.loadFromDatabase()
    this.initialized = true
  }

  /**
   * DBからデータを再読み込み
   */
  async reload(): Promise<void> {
    await this.loadFromDatabase()
  }

  /**
   * DBからデータをロードしてキャッシュを更新
   */
  private async loadFromDatabase(): Promise<void> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<PartyRow>('SELECT * FROM parties ORDER BY id')

    this.cache.clear()
    for (const row of rows) {
      const party = this.rowToParty(row)
      this.cache.set(party.id, party)
    }
  }

  /**
   * データ変更時のコールバックを設定
   */
  setOnDataChange(callback: () => void): void {
    this.onDataChangeCallback = callback
  }

  /**
   * 全パーティを取得
   */
  getParties(): Party[] {
    return Array.from(this.cache.values())
  }

  /**
   * 指定IDのパーティを取得
   */
  getParty(id: number): Party | null {
    return this.cache.get(id) ?? null
  }

  /**
   * パーティを保存（新規作成または更新）
   */
  saveParty(party: Party): void {
    this.cache.set(party.id, party)

    this.savePartyAsync(party).catch(err => {
      console.error('[SQLitePartyRepository] Failed to save party:', err)
    })

    this.notifyDataChange()
  }

  /**
   * パーティを削除
   */
  deleteParty(id: number): void {
    this.cache.delete(id)

    this.deletePartyAsync(id).catch(err => {
      console.error('[SQLitePartyRepository] Failed to delete party:', err)
    })

    this.notifyDataChange()
  }

  /**
   * パーティのステータスを更新
   */
  updatePartyStatus(id: number, status: PartyStatus): void {
    const party = this.cache.get(id)
    if (!party) return

    const updated = { ...party, status }
    this.saveParty(updated)
  }

  /**
   * 指定ステータスのパーティ一覧を取得
   */
  getPartiesByStatus(status: PartyStatus): Party[] {
    return Array.from(this.cache.values()).filter(p => p.status === status)
  }

  /**
   * ダンジョン設定を更新
   */
  updateDungeonSettings(id: number, dungeonId: string): void {
    const party = this.cache.get(id)
    if (!party) return

    const updated = { ...party, dungeonId }
    this.saveParty(updated)
  }

  /**
   * 目標階層を更新
   */
  updateFloorTarget(id: number, targetFloor: number | null): void {
    const party = this.cache.get(id)
    if (!party) return

    const updated = { ...party, targetFloor }
    this.saveParty(updated)
  }

  /**
   * 帰還ポリシーを更新
   */
  updateReturnPolicy(id: number, returnPolicy: ExpeditionRequest['returnPolicy']): void {
    const party = this.cache.get(id)
    if (!party) return

    const updated = { ...party, returnPolicy }
    this.saveParty(updated)
  }

  // --- Private methods ---

  private async savePartyAsync(party: Party): Promise<void> {
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

  private async deletePartyAsync(id: number): Promise<void> {
    const db = await getDatabase()
    await db.runAsync('DELETE FROM parties WHERE id = ?', [id])
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

  private notifyDataChange(): void {
    if (this.onDataChangeCallback) {
      this.onDataChangeCallback()
    }
  }
}
