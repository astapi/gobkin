import type { EquipmentTemplate } from '../types/Equipment'
import equipmentPoolJson from './equipmentPool.json'

interface EquipmentPoolData {
  version: string
  templates: EquipmentTemplate[]
}

const data = equipmentPoolJson as EquipmentPoolData

// コメント行を除外し、IDで高速検索するためのマップを構築
const templates = data.templates.filter((t) => t.id !== undefined)
const templateMap = new Map<string, EquipmentTemplate>(
  templates.map((t) => [t.id, t])
)

/**
 * 全装備テンプレートを取得
 */
export function getEquipmentTemplates(): EquipmentTemplate[] {
  return templates
}

/**
 * IDから装備テンプレートを取得
 */
export function getEquipmentTemplate(id: string): EquipmentTemplate | undefined {
  return templateMap.get(id)
}

/**
 * 拠点ランクで購入可能な装備を取得
 */
export function getShopEquipment(baseRank: number): EquipmentTemplate[] {
  return templates.filter(
    (t) => t.unlockRank !== undefined && t.unlockRank <= baseRank
  )
}

/**
 * ダンジョンレベルに対応する装備テンプレートを取得
 */
export function getEquipmentByDungeonLevel(dungeonLevel: number): EquipmentTemplate[] {
  return templates.filter(
    (t) =>
      t.dropLevelMin !== undefined &&
      t.dropLevelMax !== undefined &&
      dungeonLevel >= t.dropLevelMin &&
      dungeonLevel <= t.dropLevelMax
  )
}

/**
 * 装備プールのバージョン情報を取得
 */
export function getEquipmentPoolVersion(): string {
  return data.version
}
