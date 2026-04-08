/**
 * SQLiteを使用した待機中ゴブリンリポジトリ実装
 * 拠点で受け入れ待ちのゴブリンを管理
 */
import type { Goblin, GoblinJob } from '../../shared/types'
import type { IPendingGoblinRepository } from '../../core/repositories/IPendingGoblinRepository'
import { getDatabase } from '../database'
import { normalizeGoblinJobSkills } from '../../shared/data/goblinJobs'

interface PendingGoblinRow {
  id: number
  name: string
  race: string
  job_id: GoblinJob | null
  level: number
  experience: number
  avatar: string
  stats_json: string
  effective_stats_json: string | null
  factors_json: string | null
  variant_factor_id: string | null
  individual_value: number | null
  mods_json: string | null
  skills_json: string
  created_at: string
}

export class SQLitePendingGoblinRepository implements IPendingGoblinRepository {
  private static instance: SQLitePendingGoblinRepository | null = null

  static getInstance(): SQLitePendingGoblinRepository {
    if (!SQLitePendingGoblinRepository.instance) {
      SQLitePendingGoblinRepository.instance = new SQLitePendingGoblinRepository()
    }
    return SQLitePendingGoblinRepository.instance
  }

  async getPendingGoblins(): Promise<Goblin[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<PendingGoblinRow>(
      'SELECT * FROM pending_goblins ORDER BY created_at DESC'
    )
    return rows.map(row => this.rowToGoblin(row))
  }

  async addPendingGoblin(goblin: Goblin): Promise<void> {
    const normalizedGoblin = normalizeGoblinJobSkills(goblin)
    const db = await getDatabase()
    await db.runAsync(
      `INSERT OR REPLACE INTO pending_goblins
       (id, name, race, level, experience, avatar, stats_json,
        effective_stats_json, factors_json, variant_factor_id, job_id,
        individual_value, mods_json, skills_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        normalizedGoblin.id,
        normalizedGoblin.name,
        normalizedGoblin.race,
        normalizedGoblin.level,
        normalizedGoblin.experience,
        normalizedGoblin.avatar,
        JSON.stringify(normalizedGoblin.stats),
        normalizedGoblin.effectiveStats ? JSON.stringify(normalizedGoblin.effectiveStats) : null,
        normalizedGoblin.factors ? JSON.stringify(normalizedGoblin.factors) : null,
        normalizedGoblin.variantFactorId ?? null,
        normalizedGoblin.job ?? null,
        normalizedGoblin.individualValue ?? 1,
        normalizedGoblin.mods ? JSON.stringify(normalizedGoblin.mods) : null,
        JSON.stringify(normalizedGoblin.skills),
      ]
    )
  }

  async removePendingGoblin(id: number): Promise<void> {
    const db = await getDatabase()
    await db.runAsync('DELETE FROM pending_goblins WHERE id = ?', [id])
  }

  async clearPendingGoblins(): Promise<void> {
    const db = await getDatabase()
    await db.runAsync('DELETE FROM pending_goblins')
  }

  private rowToGoblin(row: PendingGoblinRow): Goblin {
    return normalizeGoblinJobSkills({
      id: row.id,
      name: row.name,
      race: row.race,
      job: row.job_id ?? undefined,
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
      skills: JSON.parse(row.skills_json),
    })
  }
}
