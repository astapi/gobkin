import type { ModInstance } from '../../shared/types/Mod'
import {
  getModTemplates,
  getModConfig,
  getModTemplate,
} from '../../shared/data/modPoolLoader'

/**
 * Mod生成サービス
 * シード値ベースの乱数でModを生成する
 */
export class ModGeneratorService {
  private rng: () => number

  constructor(seed: number) {
    this.rng = this.createSeededRandom(seed)
  }

  /**
   * シード値ベースの乱数生成器を作成
   */
  private createSeededRandom(seed: number): () => number {
    let state = seed
    return () => {
      state = (state * 1664525 + 1013904223) % 0x100000000
      return (state >>> 0) / 0x100000000
    }
  }

  /**
   * 指定範囲の整数を生成
   */
  private intInRange(min: number, max: number): number {
    return Math.floor(this.rng() * (max - min + 1)) + min
  }

  /**
   * ゴブリン生成時にModを付与する（0〜4個）
   */
  generateMods(individualValue: number): ModInstance[] {
    const config = getModConfig()
    const modCount = this.intInRange(config.minMods, config.maxMods)

    if (modCount === 0) {
      return []
    }

    const mods: ModInstance[] = []
    const usedGroups = new Set<string>()

    for (let i = 0; i < modCount; i++) {
      const mod = this.rollSingleMod(individualValue, usedGroups)
      if (mod) {
        mods.push(mod)
        const template = getModTemplate(mod.templateId)
        if (template) {
          usedGroups.add(template.group)
        }
      }
    }

    return mods
  }

  /**
   * 単一Modの抽選
   */
  private rollSingleMod(
    individualValue: number,
    excludeGroups: Set<string>
  ): ModInstance | null {
    const allTemplates = getModTemplates()

    // 1. 個体値を満たし、グループが未使用のModのみ候補に
    const candidates = allTemplates.filter(
      (t) =>
        t.requiredIndividual <= individualValue && !excludeGroups.has(t.group)
    )

    if (candidates.length === 0) return null

    // 2. Weight に基づいて抽選
    const totalWeight = candidates.reduce((sum, t) => sum + t.weight, 0)
    let roll = this.rng() * totalWeight

    for (const template of candidates) {
      roll -= template.weight
      if (roll <= 0) {
        // 3. 値をロール
        const value = this.intInRange(
          template.valueRange[0],
          template.valueRange[1]
        )
        return { templateId: template.id, value }
      }
    }

    return null
  }

  /**
   * シードを生成する（外部から呼び出し可能）
   */
  static generateSeed(): number {
    return Math.floor(Math.random() * 0x7fffffff)
  }
}
