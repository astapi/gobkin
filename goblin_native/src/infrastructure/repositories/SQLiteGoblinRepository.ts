/**
 * SQLiteを使用したゴブリンリポジトリ実装
 * 内部キャッシュを使用して同期的なインターフェースを提供
 */
import type { Goblin, GoblinStats } from '../../shared/types'
import type { IGoblinRepository } from '../../core/repositories/IGoblinRepository'
import { getDatabase } from '../database'

interface GoblinRow {
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
  updated_at: string
}

export class SQLiteGoblinRepository implements IGoblinRepository {
  private cache: Map<number, Goblin> = new Map()
  private initialized = false
  private onDataChangeCallback: (() => void) | null = null

  /**
   * リポジトリを初期化し、DBからデータをロード
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    const db = await getDatabase()
    const rows = await db.getAllAsync<GoblinRow>('SELECT * FROM goblins ORDER BY id')

    this.cache.clear()
    for (const row of rows) {
      const goblin = this.rowToGoblin(row)
      this.cache.set(goblin.id, goblin)
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
   * 全ゴブリンを取得
   */
  getGoblins(): Goblin[] {
    return Array.from(this.cache.values())
  }

  /**
   * 指定IDのゴブリンを取得
   */
  getGoblin(id: number): Goblin | null {
    return this.cache.get(id) ?? null
  }

  /**
   * ゴブリンを保存（新規作成または更新）
   */
  saveGoblin(goblin: Goblin): void {
    // キャッシュを即座に更新
    this.cache.set(goblin.id, goblin)

    // DBへの保存は非同期で実行
    this.saveGoblinAsync(goblin).catch(err => {
      console.error('[SQLiteGoblinRepository] Failed to save goblin:', err)
    })

    this.notifyDataChange()
  }

  /**
   * ゴブリンを削除
   */
  deleteGoblin(id: number): void {
    this.cache.delete(id)

    this.deleteGoblinAsync(id).catch(err => {
      console.error('[SQLiteGoblinRepository] Failed to delete goblin:', err)
    })

    this.notifyDataChange()
  }

  /**
   * ゴブリンのステータスを更新
   */
  updateGoblinStats(id: number, stats: GoblinStats): void {
    const goblin = this.cache.get(id)
    if (!goblin) return

    const updated = { ...goblin, stats }
    this.saveGoblin(updated)
  }

  /**
   * ゴブリンのレベルを更新
   */
  updateGoblinLevel(id: number, level: number): void {
    const goblin = this.cache.get(id)
    if (!goblin) return

    const updated = { ...goblin, level }
    this.saveGoblin(updated)
  }

  // --- Private methods ---

  private async saveGoblinAsync(goblin: Goblin): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      `INSERT OR REPLACE INTO goblins
       (id, name, race, level, experience, avatar, stats_json,
        effective_stats_json, factors_json, variant_factor_id,
        individual_value, mods_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
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

  private async deleteGoblinAsync(id: number): Promise<void> {
    const db = await getDatabase()
    await db.runAsync('DELETE FROM goblins WHERE id = ?', [id])
  }

  private rowToGoblin(row: GoblinRow): Goblin {
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

  private notifyDataChange(): void {
    if (this.onDataChangeCallback) {
      this.onDataChangeCallback()
    }
  }
}
