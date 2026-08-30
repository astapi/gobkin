import type { EquipmentTitleDef, EquipmentTitleId, EquipmentTitleInstance } from '../../shared/types/EquipmentTitle'
import { EQUIPMENT_TITLE_DEFS } from '../../shared/data/equipmentTitleConfig'
import { getEquipmentTitleLabel } from '../../shared/i18n/entityLocalization'
import { getDungeonTierTitleRollCount, type DungeonTier } from '../../shared/types/DungeonTier'

const ROLLABLE_TITLE_DEFS: EquipmentTitleDef[] = EQUIPMENT_TITLE_DEFS.filter(def => def.rollWeight > 0)
const ROLLABLE_TOTAL_WEIGHT = ROLLABLE_TITLE_DEFS.reduce((sum, def) => sum + def.rollWeight, 0)

/**
 * 装備の称号を抽選するサービス
 *
 * 抽選フロー:
 *   1. 付与判定: `運乱数 > 100 - (effectiveTitleMultiplier × 30 + titleBonusPercent)` を満たせば称号あり
 *   2. あり判定の場合のみ、Tier 別の判定回数だけ rollWeight でテーブル抽選し、
 *      その中で rank が最も高い称号を採用する
 */
export class EquipmentTitleService {
  /**
   * 称号を抽選する
   * @param titleMultiplier 称号付与倍率（パーティ倍率 × スキル × どんぐり 等。1 でデフォルト）
   * @param luckRoll 運乱数（LuckRoller.rollLuckValue で得た値）
   * @param tier ダンジョン Tier（判定回数に使用）
   * @param rng 乱数生成関数（0〜1）
   * @param titleBonusPercent 称号付与率への加算（パーセントポイント）
   * @returns 称号インスタンス（称号なしの場合も返す）
   */
  static rollTitle(
    titleMultiplier: number,
    luckRoll: number,
    tier: DungeonTier,
    rng: () => number,
    titleBonusPercent: number = 0,
  ): EquipmentTitleInstance {
    const m = titleMultiplier > 0 ? titleMultiplier : 1
    const threshold = 100 - (m * 30 + Math.max(0, titleBonusPercent))

    // 1) 付与判定
    if (!(luckRoll > threshold)) {
      return this.buildInstance('none')
    }

    // 2) Tier 別の判定回数だけ引いて rank 最大を採用
    const rollCount = getDungeonTierTitleRollCount(tier)
    let best: EquipmentTitleDef | null = null
    for (let i = 0; i < rollCount; i++) {
      const rolled = this.pickByWeight(rng)
      if (best === null || rolled.rank > best.rank) {
        best = rolled
      }
    }

    return this.buildInstance(best ? best.id : 'none')
  }

  /** rollWeight に従って 1 つ抽選する */
  private static pickByWeight(rng: () => number): EquipmentTitleDef {
    const roll = rng() * ROLLABLE_TOTAL_WEIGHT
    let cumulative = 0
    for (const def of ROLLABLE_TITLE_DEFS) {
      cumulative += def.rollWeight
      if (roll < cumulative) return def
    }
    return ROLLABLE_TITLE_DEFS[ROLLABLE_TITLE_DEFS.length - 1]
  }

  private static buildInstance(titleId: EquipmentTitleId): EquipmentTitleInstance {
    return { titleId, titleName: getEquipmentTitleLabel(titleId) }
  }

  /**
   * 称号IDから定義を取得
   */
  static getTitleDef(titleId: EquipmentTitleId) {
    return EQUIPMENT_TITLE_DEFS.find(def => def.id === titleId)
  }

  /**
   * 称号付き装備名を生成
   * 例: "伝説の" + "ミスリルソード" → "伝説のミスリルソード"
   */
  static formatTitledName(titleName: string, equipmentName: string): string {
    if (!titleName) return equipmentName
    return `${titleName}${equipmentName}`
  }
}
