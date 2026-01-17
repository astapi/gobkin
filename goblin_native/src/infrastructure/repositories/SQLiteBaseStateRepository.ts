/**
 * SQLiteを使用した拠点状態リポジトリ実装
 * シングルトンテーブルで拠点の状態を管理
 */
import type { BaseState } from '../../shared/types'
import type { IBaseStateRepository } from '../../core/repositories/IBaseStateRepository'
import { getDatabase } from '../database'

interface BaseStateRow {
  id: number
  capacity: number
  rank: number
  updated_at: string
}

const DEFAULT_BASE_STATE: BaseState = {
  capacity: 8,
  rank: 1,
  nextGoblinId: 1,
}

export class SQLiteBaseStateRepository implements IBaseStateRepository {
  private cache: BaseState | null = null
  private initialized = false
  private onDataChangeCallback: (() => void) | null = null

  /**
   * リポジトリを初期化し、DBからデータをロード
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    const db = await getDatabase()
    const row = await db.getFirstAsync<BaseStateRow>(
      'SELECT * FROM base_state WHERE id = 1'
    )

    if (row) {
      this.cache = {
        capacity: row.capacity,
        rank: row.rank,
        nextGoblinId: await this.getNextGoblinId(),
      }
    } else {
      // 初期データがない場合は作成
      this.cache = DEFAULT_BASE_STATE
      await this.saveAsync(this.cache)
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
   * 拠点状態を取得
   */
  getBaseState(): BaseState | null {
    return this.cache
  }

  /**
   * 拠点状態を保存
   */
  saveBaseState(state: BaseState): void {
    this.cache = state

    this.saveAsync(state).catch(err => {
      console.error('[SQLiteBaseStateRepository] Failed to save:', err)
    })

    this.notifyDataChange()
  }

  /**
   * 拠点のランクを上げる
   */
  upgradeRank(): void {
    if (!this.cache) return

    const newState: BaseState = {
      ...this.cache,
      rank: this.cache.rank + 1,
      capacity: this.cache.capacity + 4, // ランクアップごとに容量+4
    }

    this.saveBaseState(newState)
  }

  /**
   * 次のゴブリンIDを取得して更新
   */
  getAndIncrementNextGoblinId(): number {
    if (!this.cache) return 1

    const nextId = this.cache.nextGoblinId ?? 1
    this.cache.nextGoblinId = nextId + 1
    this.saveBaseState(this.cache)
    return nextId
  }

  // --- Private methods ---

  private async saveAsync(state: BaseState): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      `INSERT OR REPLACE INTO base_state (id, capacity, rank, updated_at)
       VALUES (1, ?, ?, datetime('now'))`,
      [state.capacity, state.rank]
    )
  }

  private async getNextGoblinId(): Promise<number> {
    const db = await getDatabase()

    // goblins と pending_goblins の最大IDを取得
    const goblinMax = await db.getFirstAsync<{ max_id: number | null }>(
      'SELECT MAX(id) as max_id FROM goblins'
    )
    const pendingMax = await db.getFirstAsync<{ max_id: number | null }>(
      'SELECT MAX(id) as max_id FROM pending_goblins'
    )

    const maxGoblin = goblinMax?.max_id ?? 0
    const maxPending = pendingMax?.max_id ?? 0

    return Math.max(maxGoblin, maxPending) + 1
  }

  private notifyDataChange(): void {
    if (this.onDataChangeCallback) {
      this.onDataChangeCallback()
    }
  }
}
