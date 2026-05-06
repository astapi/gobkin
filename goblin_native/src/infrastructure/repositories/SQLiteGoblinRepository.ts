/**
 * SQLiteを使用したゴブリンリポジトリ実装
 * DBから直接読み書きする設計
 */
import type { Goblin, GoblinJob, GoblinStats } from '../../shared/types'
import type { IGoblinRepository } from '../../core/repositories/IGoblinRepository'
import { getDatabase } from '../database'
import { normalizeGoblinJobSkills } from '../../shared/data/goblinJobs'
import { syncGoblinDerivedStats } from '../../shared/utils/goblinStats'
import { GoblinStatCalculator } from '../../core/services/GoblinStatCalculator'
import { normalizeGoblinRaceId } from '../../shared/types/Race'
import { normalizeBattleActionPolicy } from '../../shared/utils/battleActionPolicy'

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
  current_hp: number | null
  effective_stats_json: string | null
  factors_json: string | null
  variant_factor_id: string | null
  individual_value: number | null
  skills_json: string
  battle_action_policy_json: string | null
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
      effectiveStats: normalizedGoblin.effectiveStats ?? GoblinStatCalculator.calculate(normalizedGoblin),
    }
    const db = await getDatabase()
    await db.runAsync(
      `INSERT OR REPLACE INTO goblins
       (id, name, race, race_id, level, experience, avatar, stats_json,
        current_hp, effective_stats_json, factors_json, variant_factor_id, job_id,
        individual_value, skills_json, battle_action_policy_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        persistedGoblin.id,
        persistedGoblin.name,
        persistedGoblin.race,
        normalizeGoblinRaceId(persistedGoblin.raceId ?? persistedGoblin.race),
        persistedGoblin.level,
        persistedGoblin.experience,
        persistedGoblin.avatar,
        JSON.stringify(persistedGoblin.stats),
        persistedGoblin.currentHp ?? null,
        persistedGoblin.effectiveStats ? JSON.stringify(persistedGoblin.effectiveStats) : null,
        persistedGoblin.factors ? JSON.stringify(persistedGoblin.factors) : null,
        persistedGoblin.variantFactorId ?? null,
        persistedGoblin.job ?? null,
        persistedGoblin.individualValue ?? 1,
        JSON.stringify(persistedGoblin.skills),
        persistedGoblin.battleActionPolicy
          ? JSON.stringify(normalizeBattleActionPolicy(persistedGoblin.battleActionPolicy))
          : null,
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

  async updateGoblinCurrentHp(id: number, currentHp: number | null): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      `UPDATE goblins SET current_hp = ?, updated_at = datetime('now') WHERE id = ?`,
      [currentHp === null ? null : Math.max(0, Math.floor(currentHp)), id]
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
      currentHp: row.current_hp ?? undefined,
      effectiveStats: row.effective_stats_json
        ? JSON.parse(row.effective_stats_json)
        : undefined,
      factors: row.factors_json
        ? JSON.parse(row.factors_json)
        : undefined,
      variantFactorId: row.variant_factor_id ?? undefined,
      individualValue: row.individual_value ?? undefined,
      skills: JSON.parse(row.skills_json),
      battleActionPolicy: row.battle_action_policy_json
        ? normalizeBattleActionPolicy(JSON.parse(row.battle_action_policy_json))
        : undefined,
    })

    const normalizedGoblin = syncGoblinDerivedStats(goblin)
    return {
      ...normalizedGoblin,
      effectiveStats: normalizedGoblin.effectiveStats ?? GoblinStatCalculator.calculate(normalizedGoblin),
    }
  }
}
