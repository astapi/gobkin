import { EQUIPMENT_TITLE_DEFS } from '../../shared/data/equipmentTitleConfig'
import { getEquipmentModDef } from '../../shared/data/equipmentModConfig'
import type {
  EquipmentAutoSellBulkFilter,
  EquipmentAutoSellKeepRule,
  EquipmentAutoSellModId,
  EquipmentAutoSellPolicy,
  EquipmentAutoSellSettings,
  EquipmentModCount,
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
const MOD_COUNTS = new Set<EquipmentModCount>([0, 1, 2])

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
    const definition = getEquipmentModDef(item as EquipmentModId)
    return definition?.slot === slot || definition?.legacySlots?.includes(slot) === true
  }))]
}

function normalizeTiers(value: unknown): EquipmentModTier[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is EquipmentModTier => (
    typeof item === 'number' && MOD_TIERS.has(item as EquipmentModTier)
  )))].sort((a, b) => a - b)
}

/** 旧形式の `modCount: 'all' | 1 | 2` も受け付けて配列へ寄せる。 */
function normalizeModCounts(value: unknown, legacyValue: unknown): EquipmentModCount[] {
  const source = Array.isArray(value)
    ? value
    : (legacyValue === 1 || legacyValue === 2 ? [legacyValue] : [])
  return [...new Set(source.filter((item): item is EquipmentModCount => (
    typeof item === 'number' && MOD_COUNTS.has(item as EquipmentModCount)
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
  const candidate = value as { mode?: unknown; keepRules?: unknown; sellRules?: unknown }
  if (candidate.mode !== 'keep_all' && candidate.mode !== 'sell_all' && candidate.mode !== 'rules') {
    return undefined
  }
  const keepRules = Array.isArray(candidate.keepRules)
    ? candidate.keepRules
      .map(normalizeRule)
      .filter((rule): rule is EquipmentAutoSellKeepRule => rule !== undefined && isRuleActive(rule))
    : []
  const sellRules = Array.isArray(candidate.sellRules)
    ? candidate.sellRules
      .map(normalizeRule)
      .filter((rule): rule is EquipmentAutoSellKeepRule => rule !== undefined && isRuleActive(rule))
    : []
  return {
    mode: candidate.mode,
    keepRules,
    ...(sellRules.length > 0 ? { sellRules } : {}),
  }
}

function normalizeBulkFilter(value: unknown): EquipmentAutoSellBulkFilter | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as {
    templateIds?: unknown
    titleIds?: unknown
    modCounts?: unknown
    modCount?: unknown
  }
  if (!Array.isArray(candidate.templateIds)) return undefined

  const templateIds = [...new Set(candidate.templateIds.filter((item): item is string => (
    typeof item === 'string' && item.length > 0
  )))].sort()
  if (templateIds.length === 0) return undefined

  return {
    templateIds,
    titleIds: normalizeTitleIds(candidate.titleIds),
    modCounts: normalizeModCounts(candidate.modCounts, candidate.modCount),
  }
}

function matchesBulkFilter(drop: TreasureDrop, filter: EquipmentAutoSellBulkFilter): boolean {
  if (!filter.templateIds.includes(drop.templateId)) return false
  if (!matchesSelection(filter.titleIds, drop.titleId ?? 'none')) return false
  const modCount = (Number(Boolean(drop.prefixMod)) + Number(Boolean(drop.suffixMod))) as EquipmentModCount
  return matchesSelection(filter.modCounts, modCount)
}

function bulkFilterKey(filter: EquipmentAutoSellBulkFilter): string {
  return JSON.stringify({
    templateIds: [...filter.templateIds].sort(),
    titleIds: [...filter.titleIds].sort(),
    modCounts: [...filter.modCounts].sort((a, b) => a - b),
  })
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
    const candidate = value as { policies?: unknown; bulkSellFilters?: unknown }
    if (!candidate.policies || typeof candidate.policies !== 'object' || Array.isArray(candidate.policies)) {
      return DEFAULT_EQUIPMENT_AUTO_SELL_SETTINGS
    }

    const policies: Record<string, EquipmentAutoSellPolicy> = {}
    for (const [templateId, policyValue] of Object.entries(candidate.policies)) {
      if (!templateId) continue
      const policy = normalizePolicy(policyValue)
      if (policy) policies[templateId] = policy
    }
    const bulkSellFilters = Array.isArray(candidate.bulkSellFilters)
      ? candidate.bulkSellFilters
        .map(normalizeBulkFilter)
        .filter((filter): filter is EquipmentAutoSellBulkFilter => filter !== undefined)
        .filter((filter, index, filters) => (
          filters.findIndex(candidateFilter => bulkFilterKey(candidateFilter) === bulkFilterKey(filter)) === index
        ))
      : []
    return {
      version: 1,
      policies,
      ...(bulkSellFilters.length > 0 ? { bulkSellFilters } : {}),
    }
  }

  /** 手動売却した装備と、称号・MOD・Tierまで完全一致する売却条件を作る。 */
  static createExactSellRule(equipment: Pick<
    TreasureDrop,
    'titleId' | 'prefixMod' | 'suffixMod'
  >): EquipmentAutoSellKeepRule {
    return {
      titleIds: [equipment.titleId ?? 'none'],
      prefixModIds: [equipment.prefixMod?.id ?? 'none'],
      prefixTiers: equipment.prefixMod ? [equipment.prefixMod.tier] : [],
      suffixModIds: [equipment.suffixMod?.id ?? 'none'],
      suffixTiers: equipment.suffixMod ? [equipment.suffixMod.tier] : [],
    }
  }

  /** 同じ完全一致条件を重複させず、既存設定へ追加する。 */
  static addExactSellRule(
    settings: EquipmentAutoSellSettings,
    equipment: Pick<TreasureDrop, 'templateId' | 'titleId' | 'prefixMod' | 'suffixMod'>,
  ): EquipmentAutoSellSettings {
    const normalized = this.normalizeSettings(settings)
    const currentPolicy = normalized.policies[equipment.templateId] ?? {
      mode: 'keep_all' as const,
      keepRules: [],
    }
    const nextRule = this.createExactSellRule(equipment)
    const sellRules = currentPolicy.sellRules ?? []
    const isDuplicate = sellRules.some(rule => matchesRule(equipment, rule))

    if (isDuplicate) return normalized

    return {
      ...normalized,
      policies: {
        ...normalized.policies,
        [equipment.templateId]: {
          ...currentPolicy,
          sellRules: [...sellRules, nextRule],
        },
      },
    }
  }

  /** 倉庫の一括売却に使った装備種・称号・MOD数を自動売却条件へ追加する。 */
  static addBulkSellFilter(
    settings: EquipmentAutoSellSettings,
    filter: EquipmentAutoSellBulkFilter,
  ): EquipmentAutoSellSettings {
    const normalized = this.normalizeSettings(settings)
    const nextFilter = normalizeBulkFilter(filter)
    if (!nextFilter) return normalized

    const currentFilters = normalized.bulkSellFilters ?? []
    const nextKey = bulkFilterKey(nextFilter)
    if (currentFilters.some(current => bulkFilterKey(current) === nextKey)) return normalized

    return {
      ...normalized,
      bulkSellFilters: [...currentFilters, nextFilter],
    }
  }

  /** 未設定は残す。詳細設定は、どの残す条件にも一致しない場合だけ売却する。 */
  static shouldAutoSell(drop: TreasureDrop, settings: EquipmentAutoSellSettings): boolean {
    if (settings.bulkSellFilters?.some(filter => matchesBulkFilter(drop, filter))) return true
    const policy = settings.policies[drop.templateId]
    if (!policy) return false
    if (policy.sellRules?.some(rule => matchesRule(drop, rule))) return true
    if (policy.mode === 'keep_all') return false
    if (policy.mode === 'sell_all') return true
    return !policy.keepRules.some(rule => matchesRule(drop, rule))
  }
}
