/**
 * SQLiteを使用したゴブリンリポジトリ実装
 * DBから直接読み書きする設計
 */
import type { Goblin, GoblinJob, GoblinStats } from '../../shared/types'
import type { IGoblinRepository } from '../../core/repositories/IGoblinRepository'
import { getDatabase } from '../database'
import { normalizeGoblinJobSkills } from '../../shared/data/goblinJobs'
import { syncGoblinDerivedStats } from '../../shared/utils/goblinStats'
import { ModStatCalculator } from '../../core/services/ModStatCalculator'
import { normalizeGoblinRaceId } from '../../shared/types/Race'

interface GoblinRow {
  id: number
  name: string
  race: string
  race_id: string | null
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
    const normalizedGoblin = syncGoblinDerivedStats(normalizeGoblinJobSkills(goblin))
    const persistedGoblin: Goblin = {
      ...normalizedGoblin,
      effectiveStats: normalizedGoblin.effectiveStats ?? ModStatCalculator.calculate(normalizedGoblin),
    }
    const db = await getDatabase()
    await db.runAsync(
      `INSERT OR REPLACE INTO goblins
       (id, name, race, race_id, level, experience, avatar, stats_json,
        effective_stats_json, factors_json, variant_factor_id, job_id,
        individual_value, mods_json, skills_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        persistedGoblin.id,
        persistedGoblin.name,
        persistedGoblin.race,
        normalizeGoblinRaceId(persistedGoblin.raceId ?? persistedGoblin.race),
        persistedGoblin.level,
        persistedGoblin.experience,
        persistedGoblin.avatar,
        JSON.stringify(persistedGoblin.stats),
        persistedGoblin.effectiveStats ? JSON.stringify(persistedGoblin.effectiveStats) : null,
        persistedGoblin.factors ? JSON.stringify(persistedGoblin.factors) : null,
        persistedGoblin.variantFactorId ?? null,
        persistedGoblin.job ?? null,
        persistedGoblin.individualValue ?? 1,
        persistedGoblin.mods ? JSON.stringify(persistedGoblin.mods) : null,
        JSON.stringify(persistedGoblin.skills),
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

  async updateGoblinFactors(id: number, factors: string[], effectiveStats: GoblinStats): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      `UPDATE goblins SET factors_json = ?, effective_stats_json = ?, updated_at = datetime('now') WHERE id = ?`,
      [JSON.stringify(factors), JSON.stringify(effectiveStats), id]
    )
  }

  private rowToGoblin(row: GoblinRow): Goblin {
    const goblin = normalizeGoblinJobSkills({
      id: row.id,
      name: row.name,
      race: row.race,
      raceId: normalizeGoblinRaceId(row.race_id ?? row.race),
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

    const normalizedGoblin = syncGoblinDerivedStats(goblin)
    return {
      ...normalizedGoblin,
      effectiveStats: normalizedGoblin.effectiveStats ?? ModStatCalculator.calculate(normalizedGoblin),
    }
  }
}
