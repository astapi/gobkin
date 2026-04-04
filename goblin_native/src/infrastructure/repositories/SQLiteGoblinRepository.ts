/**
 * SQLiteを使用したゴブリンリポジトリ実装
 * DBから直接読み書きする設計
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
  private static instance: SQLiteGoblinRepository | null = null

  static getInstance(): SQLiteGoblinRepository {
    if (!SQLiteGoblinRepository.instance) {
      SQLiteGoblinRepository.instance = new SQLiteGoblinRepository()
    }
    return SQLiteGoblinRepository.instance
  }

  async getGoblins(): Promise<Goblin[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<GoblinRow>('SELECT * FROM goblins ORDER BY id')
    return rows.map(row => this.rowToGoblin(row))
  }

  async getGoblin(id: number): Promise<Goblin | null> {
    const db = await getDatabase()
    const row = await db.getFirstAsync<GoblinRow>('SELECT * FROM goblins WHERE id = ?', [id])
    return row ? this.rowToGoblin(row) : null
  }

  async saveGoblin(goblin: Goblin): Promise<void> {
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

  async deleteGoblin(id: number): Promise<void> {
    const db = await getDatabase()
    await db.runAsync('DELETE FROM goblins WHERE id = ?', [id])
  }

  async updateGoblinStats(id: number, stats: GoblinStats): Promise<void> {
    const goblin = await this.getGoblin(id)
    if (!goblin) return

    await this.saveGoblin({ ...goblin, stats })
  }

  async updateGoblinLevel(id: number, level: number): Promise<void> {
    const goblin = await this.getGoblin(id)
    if (!goblin) return

    await this.saveGoblin({ ...goblin, level })
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
}
