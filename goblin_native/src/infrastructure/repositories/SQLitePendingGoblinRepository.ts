/**
 * SQLiteを使用した待機中ゴブリンリポジトリ実装
 * 拠点で受け入れ待ちのゴブリンを管理
 */
import type { Goblin } from '../../shared/types'
import type { IPendingGoblinRepository } from '../../core/repositories/IPendingGoblinRepository'
import { getDatabase } from '../database'

interface PendingGoblinRow {
  id: number
  name: string
  race: string
  level: number
  experience: number
  avatar: string
  stats_json: string
  effective_stats_json: string | null
  factors_json: string | null
  variant_factor_id: string | null
  individual_value: number | null
  mods_json: string | null
  created_at: string
}

export class SQLitePendingGoblinRepository implements IPendingGoblinRepository {
  private static instance: SQLitePendingGoblinRepository | null = null
  private cache: Map<number, Goblin> = new Map()
  private initialized = false

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(): SQLitePendingGoblinRepository {
    if (!SQLitePendingGoblinRepository.instance) {
      SQLitePendingGoblinRepository.instance = new SQLitePendingGoblinRepository()
    }
    return SQLitePendingGoblinRepository.instance
  }

  /**
   * リポジトリを初期化し、DBからデータをロード
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    const db = await getDatabase()
    const rows = await db.getAllAsync<PendingGoblinRow>(
      'SELECT * FROM pending_goblins ORDER BY created_at DESC'
    )

    this.cache.clear()
    for (const row of rows) {
      const goblin = this.rowToGoblin(row)
      this.cache.set(goblin.id, goblin)
    }

    this.initialized = true
  }

  /**
   * 待機中の全ゴブリンを取得
   */
  getPendingGoblins(): Goblin[] {
    return Array.from(this.cache.values())
  }

  /**
   * 待機中ゴブリンを追加
   */
  addPendingGoblin(goblin: Goblin): void {
    this.cache.set(goblin.id, goblin)

    this.addAsync(goblin).catch(err => {
      console.error('[SQLitePendingGoblinRepository] Failed to add:', err)
    })
  }

  /**
   * 待機中ゴブリンを削除（受け入れ時）
   */
  removePendingGoblin(id: number): void {
    this.cache.delete(id)

    this.removeAsync(id).catch(err => {
      console.error('[SQLitePendingGoblinRepository] Failed to remove:', err)
    })
  }

  /**
   * 全待機中ゴブリンをクリア
   */
  clearPendingGoblins(): void {
    this.cache.clear()

    this.clearAsync().catch(err => {
      console.error('[SQLitePendingGoblinRepository] Failed to clear:', err)
    })
  }

  // --- Private methods ---

  private async addAsync(goblin: Goblin): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      `INSERT OR REPLACE INTO pending_goblins
       (id, name, race, level, experience, avatar, stats_json,
        effective_stats_json, factors_json, variant_factor_id,
        individual_value, mods_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        goblin.id,
        goblin.name,
        goblin.race,
        goblin.level,
        goblin.experience,
        goblin.avatar,
        JSON.stringify(goblin.stats),
        goblin.effectiveStats ? JSON.stringify(goblin.effectiveStats) : null,
        goblin.factors ? JSON.stringify(goblin.factors) : null,
        goblin.variantFactorId ?? null,
        goblin.individualValue ?? 1,
        goblin.mods ? JSON.stringify(goblin.mods) : null,
      ]
    )
  }

  private async removeAsync(id: number): Promise<void> {
    const db = await getDatabase()
    await db.runAsync('DELETE FROM pending_goblins WHERE id = ?', [id])
  }

  private async clearAsync(): Promise<void> {
    const db = await getDatabase()
    await db.runAsync('DELETE FROM pending_goblins')
  }

  private rowToGoblin(row: PendingGoblinRow): Goblin {
    return {
      id: row.id,
      name: row.name,
      race: row.race,
      level: row.level,
      experience: row.experience,
      avatar: row.avatar,
      stats: JSON.parse(row.stats_json),
      effectiveStats: row.effective_stats_json
        ? JSON.parse(row.effective_stats_json)
        : undefined,
      factors: row.factors_json
        ? JSON.parse(row.factors_json)
        : undefined,
      variantFactorId: row.variant_factor_id ?? undefined,
      individualValue: row.individual_value ?? undefined,
      mods: row.mods_json
        ? JSON.parse(row.mods_json)
        : undefined,
    }
  }
}
