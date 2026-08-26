/**
 * SQLiteを使用した拠点状態リポジトリ実装
 * DBから直接読み書きする設計
 */
import type { BaseState } from '../../shared/types'
import type { IBaseStateRepository } from '../../core/repositories/IBaseStateRepository'
import { getDatabase } from '../database'

interface BaseStateRow {
  id: number
  capacity: number
  rank: number
  captured_dungeons_json: string
  current_max_parties: number
  current_max_goblins: number
  gold: number
  next_goblin_id: number
  updated_at: string
}

const DEFAULT_BASE_STATE: BaseState = {
  capacity: 10,
  rank: 1,
  nextGoblinId: 1,
  capturedDungeons: [],
  currentMaxParties: 1,
  currentMaxGoblins: 10,
  gold: 500,
}

export class SQLiteBaseStateRepository implements IBaseStateRepository {
  private static instance: SQLiteBaseStateRepository | null = null

  static getInstance(): SQLiteBaseStateRepository {
    if (!SQLiteBaseStateRepository.instance) {
      SQLiteBaseStateRepository.instance = new SQLiteBaseStateRepository()
    }
    return SQLiteBaseStateRepository.instance
  }

  async getBaseState(): Promise<BaseState | null> {
    const db = await getDatabase()
    const row = await db.getFirstAsync<BaseStateRow>(
      'SELECT * FROM base_state WHERE id = 1'
    )

    if (!row) return null

    return {
      capacity: row.capacity,
      rank: row.rank,
      nextGoblinId: row.next_goblin_id,
      capturedDungeons: JSON.parse(row.captured_dungeons_json || '[]'),
      currentMaxParties: row.current_max_parties,
      currentMaxGoblins: row.current_max_goblins,
      gold: row.gold,
    }
  }

  async saveBaseState(state: BaseState): Promise<void> {
    const db = await getDatabase()
    // next_goblin_id はカウンター専用カラムなので、ここでは触らない
    // getAndIncrementNextGoblinId() のみがアトミックに更新する
    await db.runAsync(
      `UPDATE base_state SET
        capacity = ?, rank = ?, captured_dungeons_json = ?,
        current_max_parties = ?, current_max_goblins = ?,
        gold = ?, updated_at = datetime('now')
       WHERE id = 1`,
      [
        state.capacity,
        state.rank,
        JSON.stringify(state.capturedDungeons),
        state.currentMaxParties,
        state.currentMaxGoblins,
        state.gold,
      ]
    )
  }

  async ensureInitialized(): Promise<void> {
    const db = await getDatabase()
    const row = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM base_state WHERE id = 1'
    )
    if (!row) {
      await db.runAsync(
        `INSERT INTO base_state (
          id, capacity, rank, captured_dungeons_json,
          current_max_parties, current_max_goblins, gold,
          next_goblin_id
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
        [
          DEFAULT_BASE_STATE.capacity,
          DEFAULT_BASE_STATE.rank,
          JSON.stringify(DEFAULT_BASE_STATE.capturedDungeons),
          DEFAULT_BASE_STATE.currentMaxParties,
          DEFAULT_BASE_STATE.currentMaxGoblins,
          DEFAULT_BASE_STATE.gold,
          DEFAULT_BASE_STATE.nextGoblinId ?? 1,
        ]
      )
    }
  }

  /**
   * 次のゴブリンIDをアトミックにインクリメントして返す
   * UPDATE ... RETURNING により +1 と採番値の取得を 1 文で行い、
   * 並行実行時の同一IDの二重採番を防ぐ（採番されたIDは更新後の値-1）
   */
  async getAndIncrementNextGoblinId(): Promise<number> {
    const db = await getDatabase()

    const row = await db.getFirstAsync<{ next_goblin_id: number }>(
      'UPDATE base_state SET next_goblin_id = next_goblin_id + 1 WHERE id = 1 RETURNING next_goblin_id'
    )

    return (row?.next_goblin_id ?? 2) - 1
  }
}
