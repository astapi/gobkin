import { EQUIPMENT_TITLE_DEFS } from '../../shared/data/equipmentTitleConfig'
import { getEquipmentModDef } from '../../shared/data/equipmentModConfig'
import type {
  EquipmentAutoSellKeepRule,
  EquipmentAutoSellModId,
  EquipmentAutoSellPolicy,
  EquipmentAutoSellSettings,
  EquipmentModId,
  EquipmentModTier,
  EquipmentTitleId,
  TreasureDrop,
} from '../../shared/types'

export const DEFAULT_EQUIPMENT_AUTO_SELL_SETTINGS: EquipmentAutoSellSettings = {
  version: 1,
  policies: {},
}

const TITLE_IDS = new Set<EquipmentTitleId>(EQUIPMENT_TITLE_DEFS.map(definition => definition.id))
const MOD_TIERS = new Set<EquipmentModTier>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

function normalizeTitleIds(value: unknown): EquipmentTitleId[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is EquipmentTitleId => (
    typeof item === 'string' && TITLE_IDS.has(item as EquipmentTitleId)
  )))]
}

function normalizeModIds(value: unknown, slot: 'prefix' | 'suffix'): EquipmentAutoSellModId[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is EquipmentAutoSellModId => {
    if (item === 'none') return true
    if (typeof item !== 'string') return false
    return getEquipmentModDef(item as EquipmentModId)?.slot === slot
  }))]
}

function normalizeTiers(value: unknown): EquipmentModTier[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is EquipmentModTier => (
    typeof item === 'number' && MOD_TIERS.has(item as EquipmentModTier)
  )))].sort((a, b) => a - b)
}

function normalizeRule(value: unknown): EquipmentAutoSellKeepRule | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Partial<Record<keyof EquipmentAutoSellKeepRule, unknown>>
  return {
    titleIds: normalizeTitleIds(candidate.titleIds),
    prefixModIds: normalizeModIds(candidate.prefixModIds, 'prefix'),
    prefixTiers: normalizeTiers(candidate.prefixTiers),
    suffixModIds: normalizeModIds(candidate.suffixModIds, 'suffix'),
    suffixTiers: normalizeTiers(candidate.suffixTiers),
  }
}

function isRuleActive(rule: EquipmentAutoSellKeepRule): boolean {
  return rule.titleIds.length > 0
    || rule.prefixModIds.length > 0
    || rule.prefixTiers.length > 0
    || rule.suffixModIds.length > 0
    || rule.suffixTiers.length > 0
}

function normalizePolicy(value: unknown): EquipmentAutoSellPolicy | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as { mode?: unknown; keepRules?: unknown }
  if (candidate.mode !== 'keep_all' && candidate.mode !== 'sell_all' && candidate.mode !== 'rules') {
    return undefined
  }
  const keepRules = Array.isArray(candidate.keepRules)
    ? candidate.keepRules
      .map(normalizeRule)
      .filter((rule): rule is EquipmentAutoSellKeepRule => rule !== undefined && isRuleActive(rule))
    : []
  return { mode: candidate.mode, keepRules }
}

function matchesSelection<T>(selection: readonly T[], actual: T): boolean {
  return selection.length === 0 || selection.includes(actual)
}

function matchesRule(drop: TreasureDrop, rule: EquipmentAutoSellKeepRule): boolean {
  const titleId = drop.titleId ?? 'none'
  const prefixId = drop.prefixMod?.id ?? 'none'
  const suffixId = drop.suffixMod?.id ?? 'none'

  return matchesSelection(rule.titleIds, titleId)
    && matchesSelection(rule.prefixModIds, prefixId)
    && (rule.prefixTiers.length === 0 || (
      drop.prefixMod !== undefined && rule.prefixTiers.includes(drop.prefixMod.tier)
    ))
    && matchesSelection(rule.suffixModIds, suffixId)
    && (rule.suffixTiers.length === 0 || (
      drop.suffixMod !== undefined && rule.suffixTiers.includes(drop.suffixMod.tier)
    ))
}

export class EquipmentAutoSellService {
  static createEmptyRule(): EquipmentAutoSellKeepRule {
    return {
      titleIds: [],
      prefixModIds: [],
      prefixTiers: [],
      suffixModIds: [],
      suffixTiers: [],
    }
  }

  static normalizeSettings(value: unknown): EquipmentAutoSellSettings {
    if (!value || typeof value !== 'object') return DEFAULT_EQUIPMENT_AUTO_SELL_SETTINGS
    const candidate = value as { policies?: unknown }
    if (!candidate.policies || typeof candidate.policies !== 'object' || Array.isArray(candidate.policies)) {
      return DEFAULT_EQUIPMENT_AUTO_SELL_SETTINGS
    }

    const policies: Record<string, EquipmentAutoSellPolicy> = {}
    for (const [templateId, policyValue] of Object.entries(candidate.policies)) {
      if (!templateId) continue
      const policy = normalizePolicy(policyValue)
      if (policy) policies[templateId] = policy
    }
    return { version: 1, policies }
  }

  /** 未設定は残す。詳細設定は、どの残す条件にも一致しない場合だけ売却する。 */
  static shouldAutoSell(drop: TreasureDrop, settings: EquipmentAutoSellSettings): boolean {
    const policy = settings.policies[drop.templateId]
    if (!policy || policy.mode === 'keep_all') return false
    if (policy.mode === 'sell_all') return true
    return !policy.keepRules.some(rule => matchesRule(drop, rule))
  }
}
