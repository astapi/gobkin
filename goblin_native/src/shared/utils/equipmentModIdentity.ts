import type { EquipmentModRoll } from '../types/Equipment'
import type { EquipmentTitleId } from '../types/EquipmentTitle'

export type EquipmentModIdentity = {
  templateId: string
  titleId?: EquipmentTitleId
  prefixMod?: EquipmentModRoll
  suffixMod?: EquipmentModRoll
}

export function getEquipmentModSignature(
  item: Pick<EquipmentModIdentity, 'prefixMod' | 'suffixMod'>,
): string {
  const prefix = item.prefixMod ? `${item.prefixMod.id}:t${item.prefixMod.tier}` : 'none'
  const suffix = item.suffixMod ? `${item.suffixMod.id}:t${item.suffixMod.tier}` : 'none'
  return `${prefix}|${suffix}`
}

export function getEquipmentStackKey(item: EquipmentModIdentity): string {
  return `${item.templateId}::${item.titleId ?? 'none'}::${getEquipmentModSignature(item)}`
}

export function isSameEquipmentStack(a: EquipmentModIdentity, b: EquipmentModIdentity): boolean {
  return getEquipmentStackKey(a) === getEquipmentStackKey(b)
}
