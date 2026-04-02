/**
 * SQLiteを使用した拠点状態リポジトリ実装
 * シングルトンテーブルで拠点の状態を管理
 */
import type { BaseState } from '../../shared/types'
import type { IBaseStateRepository } from '../../core/repositories/IBaseStateRepository'
import { getDatabase } from '../database'
import { BASE_RANK_CONFIGS } from '../../core/services/BaseRankSystem'

interface BaseStateRow {
  id: number
  capacity: number
  rank: number
  captured_dungeons_json: string
  current_max_parties: number
  current_max_goblins: number
  current_iv_bonus: number
  gold: number
  updated_at: string
}

const DEFAULT_BASE_STATE: BaseState = {
  capacity: 10,
  rank: 1,
  nextGoblinId: 1,
  capturedDungeons: [],
  currentMaxParties: 1,
  currentMaxGoblins: 10,
  currentIVBonus: 0,
  gold: 500,
}

export class SQLiteBaseStateRepository implements IBaseStateRepository {
  private static instance: SQLiteBaseStateRepository | null = null
  private cache: BaseState | null = null
  private initialized = false

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(): SQLiteBaseStateRepository {
    if (!SQLiteBaseStateRepository.instance) {
      SQLiteBaseStateRepository.instance = new SQLiteBaseStateRepository()
    }
    return SQLiteBaseStateRepository.instance
  }

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
        capturedDungeons: JSON.parse(row.captured_dungeons_json || '[]'),
        currentMaxParties: row.current_max_parties,
        currentMaxGoblins: row.current_max_goblins,
        currentIVBonus: row.current_iv_bonus,
        gold: row.gold,
      }
    } else {
      // 初期データがない場合は作成
      this.cache = DEFAULT_BASE_STATE
      await this.saveAsync(this.cache)
    }

    this.initialized = true
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
  }

  /**
   * 拠点のランクを上げる
   * @deprecated 代わりに BaseRankSystem.captureDungeon を使用してください
   */
  upgradeRank(): void {
    if (!this.cache) return

    const nextRank = this.cache.rank + 1
    const nextConfig = BASE_RANK_CONFIGS.find((c) => c.rank === nextRank)

    if (!nextConfig) {
      console.warn('[SQLiteBaseStateRepository] Cannot upgrade: max rank reached')
      return
    }

    const newState: BaseState = {
      ...this.cache,
      rank: nextRank,
      capacity: nextConfig.maxGoblins,
      currentMaxParties: nextConfig.maxParties,
      currentMaxGoblins: nextConfig.maxGoblins,
      currentIVBonus: nextConfig.ivBonus,
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
      `INSERT OR REPLACE INTO base_state (
        id, capacity, rank, captured_dungeons_json,
        current_max_parties, current_max_goblins, current_iv_bonus, gold, updated_at
      )
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        state.capacity,
        state.rank,
        JSON.stringify(state.capturedDungeons),
        state.currentMaxParties,
        state.currentMaxGoblins,
        state.currentIVBonus,
        state.gold,
      ]
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
}
