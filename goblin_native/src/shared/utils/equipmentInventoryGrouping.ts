import type { EquipmentTemplate } from '@/shared/types'
import type { EquipmentInventoryFilterTarget } from './equipmentInventoryFilter'

export interface EquipmentInventoryVariantGroup extends EquipmentInventoryFilterTarget {
  key: string
  count: number
}

export interface EquipmentInventoryBaseGroup<TVariant extends EquipmentInventoryVariantGroup> {
  key: string
  template: EquipmentTemplate
  variants: TVariant[]
  matchedCount: number
  totalCount: number
}

/**
 * 完全一致スタックをベース装備単位にまとめる。
 * matchingVariants には現在のフィルターを通過したスタックだけを渡す。
 */
export function groupEquipmentVariantsByTemplate<TVariant extends EquipmentInventoryVariantGroup>(
  allVariants: readonly TVariant[],
  matchingVariants: readonly TVariant[],
): EquipmentInventoryBaseGroup<TVariant>[] {
  const totalCounts = new Map<string, number>()
  for (const variant of allVariants) {
    totalCounts.set(
      variant.template.id,
      (totalCounts.get(variant.template.id) ?? 0) + variant.count,
    )
  }

  const grouped = new Map<string, EquipmentInventoryBaseGroup<TVariant>>()
  for (const variant of matchingVariants) {
    const templateId = variant.template.id
    const existing = grouped.get(templateId)
    if (existing) {
      existing.variants.push(variant)
      existing.matchedCount += variant.count
      continue
    }

    grouped.set(templateId, {
      key: `base::${templateId}`,
      template: variant.template,
      variants: [variant],
      matchedCount: variant.count,
      totalCount: totalCounts.get(templateId) ?? variant.count,
    })
  }

  return [...grouped.values()]
}
