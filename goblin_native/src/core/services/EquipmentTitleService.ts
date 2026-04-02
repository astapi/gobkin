import type { EquipmentTitleId, EquipmentTitleInstance } from '../../shared/types/EquipmentTitle'
import { EQUIPMENT_TITLE_DEFS } from '../../shared/data/equipmentTitleConfig'

/**
 * 装備の称号を抽選するサービス
 *
 * 各称号の重み = baseWeight × multiplier^power
 * 「称号なし」(power=0)は固定重みで、倍率が上がると相対的に確率が下がる。
 */
export class EquipmentTitleService {
  /**
   * 称号を抽選する
   * @param titleMultiplier 称号付与倍率（1〜99）
   * @param rng 乱数生成関数（0〜1）
   * @returns 称号インスタンス（称号なしの場合も返す）
   */
  static rollTitle(titleMultiplier: number, rng: () => number): EquipmentTitleInstance {
    const m = Math.max(1, Math.min(99, titleMultiplier))

    // 各称号の重みを計算
    const weights = EQUIPMENT_TITLE_DEFS.map(def => ({
      def,
      weight: def.power === 0
        ? def.baseWeight // 固定重み（称号なし）
        : def.baseWeight * Math.pow(m, def.power),
    }))

    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0)
    const roll = rng() * totalWeight

    let cumulative = 0
    for (const { def, weight } of weights) {
      cumulative += weight
      if (roll < cumulative) {
        return {
          titleId: def.id,
          titleName: def.name,
        }
      }
    }

    // フォールバック（到達しないはず）
    return { titleId: 'none', titleName: '' }
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
