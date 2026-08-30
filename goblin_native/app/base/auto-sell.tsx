import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { equipmentAutoSellFilterRepository } from '@/presentation/di/repositories'
import {
  DEFAULT_EQUIPMENT_AUTO_SELL_SETTINGS,
  EquipmentAutoSellService,
} from '@/core/services/EquipmentAutoSellService'
import { EQUIPMENT_TITLE_DEFS } from '@/shared/data/equipmentTitleConfig'
import { EQUIPMENT_MOD_DEFS } from '@/shared/data/equipmentModConfig'
import { getEquipmentTemplates } from '@/shared/data/equipmentPoolLoader'
import { getEquipmentLabel, getEquipmentModLabel, getEquipmentTitleLabel } from '@/shared/i18n/entityLocalization'
import type {
  EquipmentAutoSellKeepRule,
  EquipmentAutoSellModId,
  EquipmentAutoSellMode,
  EquipmentAutoSellPolicy,
  EquipmentAutoSellSettings,
  EquipmentModTier,
  EquipmentTemplate,
  EquipmentTitleId,
} from '@/shared/types'

const MOD_TIERS: EquipmentModTier[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const MODE_OPTIONS: EquipmentAutoSellMode[] = ['keep_all', 'sell_all', 'rules']

function cloneRules(rules: EquipmentAutoSellKeepRule[]): EquipmentAutoSellKeepRule[] {
  return rules.map(rule => ({
    titleIds: [...rule.titleIds],
    prefixModIds: [...rule.prefixModIds],
    prefixTiers: [...rule.prefixTiers],
    suffixModIds: [...rule.suffixModIds],
    suffixTiers: [...rule.suffixTiers],
  }))
}

function isRuleActive(rule: EquipmentAutoSellKeepRule): boolean {
  return rule.titleIds.length > 0
    || rule.prefixModIds.length > 0
    || rule.prefixTiers.length > 0
    || rule.suffixModIds.length > 0
    || rule.suffixTiers.length > 0
}

function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter(item => item !== value)
    : [...values, value]
}

function defaultPolicy(): EquipmentAutoSellPolicy {
  return { mode: 'keep_all', keepRules: [] }
}

export default function EquipmentAutoSellScreen() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<EquipmentAutoSellSettings>(DEFAULT_EQUIPMENT_AUTO_SELL_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [query, setQuery] = useState('')
  const [editingTemplate, setEditingTemplate] = useState<EquipmentTemplate | null>(null)
  const [draftRules, setDraftRules] = useState<EquipmentAutoSellKeepRule[]>([])
  const [activeRuleIndex, setActiveRuleIndex] = useState(0)

  useEffect(() => {
    void equipmentAutoSellFilterRepository.getSettings()
      .then(setSettings)
      .catch(() => {
        Alert.alert(t('ui.autoSell.errorTitle'), t('ui.autoSell.loadError'))
      })
      .finally(() => setLoading(false))
  }, [t])

  const templates = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return getEquipmentTemplates().filter(template => (
      normalizedQuery.length === 0
      || getEquipmentLabel(template).toLocaleLowerCase().includes(normalizedQuery)
    ))
  }, [query])

  const modeLabel = (mode: EquipmentAutoSellMode): string => {
    if (mode === 'keep_all') return t('ui.autoSell.keepAll')
    if (mode === 'sell_all') return t('ui.autoSell.sellAll')
    return t('ui.autoSell.rules')
  }

  const setPolicy = (templateId: string, nextPolicy: EquipmentAutoSellPolicy) => {
    setSettings(current => ({
      ...current,
      policies: { ...current.policies, [templateId]: nextPolicy },
    }))
    setDirty(true)
  }

  const clearBulkSellFilters = () => {
    setSettings(current => {
      const { bulkSellFilters: _removed, ...rest } = current
      return rest
    })
    setDirty(true)
  }

  const selectMode = (template: EquipmentTemplate, mode: EquipmentAutoSellMode) => {
    const currentPolicy = settings.policies[template.id] ?? defaultPolicy()
    if (mode === 'rules') {
      const rules = cloneRules(currentPolicy.keepRules)
      setEditingTemplate(template)
      setDraftRules(rules.length > 0 ? rules : [EquipmentAutoSellService.createEmptyRule()])
      setActiveRuleIndex(0)
      return
    }
    setPolicy(template.id, { ...currentPolicy, mode })
  }

  const saveSettings = async () => {
    try {
      setSaving(true)
      await equipmentAutoSellFilterRepository.saveSettings(settings)
      setDirty(false)
      Alert.alert(t('ui.autoSell.savedTitle'), t('ui.autoSell.savedBody'))
    } catch {
      Alert.alert(t('ui.autoSell.errorTitle'), t('ui.autoSell.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleBack = () => {
    if (!dirty) {
      router.back()
      return
    }
    Alert.alert(t('ui.autoSell.unsavedTitle'), t('ui.autoSell.unsavedBody'), [
      { text: t('ui.common.cancel'), style: 'cancel' },
      { text: t('ui.autoSell.discard'), style: 'destructive', onPress: () => router.back() },
    ])
  }

  const updateActiveRule = <K extends keyof EquipmentAutoSellKeepRule>(
    key: K,
    updater: (values: EquipmentAutoSellKeepRule[K]) => EquipmentAutoSellKeepRule[K],
  ) => {
    setDraftRules(current => current.map((rule, index) => (
      index === activeRuleIndex ? { ...rule, [key]: updater(rule[key]) } : rule
    )))
  }

  const saveRuleEditor = () => {
    if (!editingTemplate) return
    const activeRules = draftRules.filter(isRuleActive)
    if (activeRules.length === 0) {
      Alert.alert(t('ui.autoSell.ruleRequiredTitle'), t('ui.autoSell.ruleRequiredBody'))
      return
    }
    const currentPolicy = settings.policies[editingTemplate.id] ?? defaultPolicy()
    setPolicy(editingTemplate.id, { ...currentPolicy, mode: 'rules', keepRules: activeRules })
    setEditingTemplate(null)
  }

  const clearManualSellRules = (templateId: string) => {
    const currentPolicy = settings.policies[templateId] ?? defaultPolicy()
    setPolicy(templateId, {
      mode: currentPolicy.mode,
      keepRules: currentPolicy.keepRules,
    })
  }

  const addRule = () => {
    setDraftRules(current => [...current, EquipmentAutoSellService.createEmptyRule()])
    setActiveRuleIndex(draftRules.length)
  }

  const removeActiveRule = () => {
    setDraftRules(current => {
      if (current.length <= 1) return [EquipmentAutoSellService.createEmptyRule()]
      return current.filter((_, index) => index !== activeRuleIndex)
    })
    setActiveRuleIndex(index => Math.max(0, index - 1))
  }

  const activeRule = draftRules[activeRuleIndex]

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.helpText}>{t('ui.common.loading')}</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          testID="auto-sell-back"
          accessibilityRole="button"
          accessibilityLabel={t('ui.common.back')}
          onPress={handleBack}
          style={styles.headerButton}
        >
          <Text style={styles.backText}>‹ {t('ui.common.back')}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t('ui.autoSell.title')}</Text>
        <Pressable
          testID="auto-sell-save"
          accessibilityRole="button"
          accessibilityLabel={t('ui.common.save')}
          accessibilityState={{ disabled: !dirty || saving, busy: saving }}
          onPress={() => void saveSettings()}
          style={styles.headerButton}
          disabled={!dirty || saving}
        >
          <Text style={[styles.saveText, (!dirty || saving) && styles.disabledText]}>
            {saving ? t('ui.common.saving') : t('ui.common.save')}
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={templates}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={(
          <View style={styles.listHeader}>
            <Text style={styles.description}>{t('ui.autoSell.description')}</Text>
            <Text style={styles.warning}>{t('ui.autoSell.appliesFuture')}</Text>
            {(settings.bulkSellFilters?.length ?? 0) > 0 ? (
              <View style={styles.bulkSellFilterCard}>
                <Text style={styles.bulkSellFilterText}>
                  {t('ui.autoSell.bulkSellFilterCount', {
                    count: settings.bulkSellFilters?.length ?? 0,
                  })}
                </Text>
                <Pressable
                  testID="auto-sell-clear-bulk-filters"
                  accessibilityRole="button"
                  accessibilityLabel={t('ui.autoSell.clearBulkSellFilters')}
                  onPress={clearBulkSellFilters}
                >
                  <Text style={styles.clearManualSellRulesText}>
                    {t('ui.autoSell.clearBulkSellFilters')}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            <TextInput
              testID="auto-sell-search"
              accessibilityLabel={t('ui.autoSell.searchPlaceholder')}
              value={query}
              onChangeText={setQuery}
              placeholder={t('ui.autoSell.searchPlaceholder')}
              style={styles.searchInput}
              clearButtonMode="while-editing"
            />
          </View>
        )}
        renderItem={({ item }) => {
          const policy = settings.policies[item.id] ?? defaultPolicy()
          return (
            <View style={styles.itemCard}>
              <Text style={styles.itemName}>{getEquipmentLabel(item)}</Text>
              <View style={styles.modeRow}>
                {MODE_OPTIONS.map(mode => (
                  <TouchableOpacity
                    key={mode}
                    testID={`auto-sell-${item.id}-${mode}`}
                    accessibilityRole="radio"
                    accessibilityLabel={`${getEquipmentLabel(item)}、${modeLabel(mode)}`}
                    accessibilityState={{ checked: policy.mode === mode }}
                    style={[styles.modeButton, policy.mode === mode && styles.modeButtonSelected]}
                    onPress={() => selectMode(item, mode)}
                  >
                    <Text style={[styles.modeText, policy.mode === mode && styles.modeTextSelected]}>
                      {modeLabel(mode)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {policy.mode === 'rules' && (
                <Text style={styles.ruleCount}>
                  {t('ui.autoSell.ruleCount', { count: policy.keepRules.length })}
                </Text>
              )}
              {(policy.sellRules?.length ?? 0) > 0 && (
                <View style={styles.manualSellRuleRow}>
                  <Text style={styles.ruleCount}>
                    {t('ui.autoSell.manualSellRuleCount', { count: policy.sellRules?.length ?? 0 })}
                  </Text>
                  <Pressable
                    testID={`auto-sell-${item.id}-clear-sell-filters`}
                    accessibilityRole="button"
                    accessibilityLabel={t('ui.autoSell.clearManualSellRules')}
                    onPress={() => clearManualSellRules(item.id)}
                  >
                    <Text style={styles.clearManualSellRulesText}>
                      {t('ui.autoSell.clearManualSellRules')}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          )
        }}
      />

      <Modal
        visible={editingTemplate !== null}
        animationType="slide"
        onRequestClose={() => setEditingTemplate(null)}
      >
        <SafeAreaView accessibilityViewIsModal style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.header}>
            <Pressable
              testID="auto-sell-rule-cancel"
              accessibilityRole="button"
              accessibilityLabel={t('ui.common.cancel')}
              onPress={() => setEditingTemplate(null)}
              style={styles.headerButton}
            >
              <Text style={styles.backText}>{t('ui.common.cancel')}</Text>
            </Pressable>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {editingTemplate ? getEquipmentLabel(editingTemplate) : ''}
            </Text>
            <Pressable
              testID="auto-sell-rule-save"
              accessibilityRole="button"
              accessibilityLabel={t('ui.common.save')}
              onPress={saveRuleEditor}
              style={styles.headerButton}
            >
              <Text style={styles.saveText}>{t('ui.common.save')}</Text>
            </Pressable>
          </View>

          {activeRule && (
            <ScrollView contentContainerStyle={styles.editorContent}>
              <Text style={styles.description}>{t('ui.autoSell.ruleHelp')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ruleTabs}>
                {draftRules.map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    testID={`auto-sell-rule-${index}`}
                    accessibilityRole="tab"
                    accessibilityLabel={t('ui.autoSell.ruleNumber', { number: index + 1 })}
                    accessibilityState={{ selected: activeRuleIndex === index }}
                    style={[styles.ruleTab, activeRuleIndex === index && styles.ruleTabSelected]}
                    onPress={() => setActiveRuleIndex(index)}
                  >
                    <Text style={[styles.ruleTabText, activeRuleIndex === index && styles.modeTextSelected]}>
                      {t('ui.autoSell.ruleNumber', { number: index + 1 })}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  testID="auto-sell-rule-add"
                  accessibilityRole="button"
                  accessibilityLabel={t('ui.autoSell.addRule')}
                  style={styles.addRuleButton}
                  onPress={addRule}
                >
                  <Text style={styles.addRuleText}>＋ {t('ui.autoSell.addRule')}</Text>
                </TouchableOpacity>
              </ScrollView>

              <FilterSection title={t('ui.autoSell.titleCondition')} hint={t('ui.autoSell.unselectedAny')}>
                {EQUIPMENT_TITLE_DEFS.map(definition => (
                  <FilterChip
                    key={definition.id}
                    testID={`auto-sell-title-${definition.id}`}
                    label={definition.id === 'none' ? t('ui.autoSell.noTitle') : getEquipmentTitleLabel(definition.id)}
                    selected={activeRule.titleIds.includes(definition.id)}
                    onPress={() => updateActiveRule('titleIds', values => (
                      toggleValue(values, definition.id as EquipmentTitleId)
                    ))}
                  />
                ))}
              </FilterSection>

              <FilterSection title={t('ui.autoSell.prefixCondition')} hint={t('ui.autoSell.unselectedAny')}>
                <FilterChip
                  testID="auto-sell-prefix-none"
                  label={t('ui.autoSell.noMod')}
                  selected={activeRule.prefixModIds.includes('none')}
                  onPress={() => updateActiveRule('prefixModIds', values => toggleValue(values, 'none'))}
                />
                {EQUIPMENT_MOD_DEFS.filter(definition => definition.slot === 'prefix').map(definition => (
                  <FilterChip
                    key={definition.id}
                    testID={`auto-sell-prefix-${definition.id}`}
                    label={getEquipmentModLabel(definition.id)}
                    selected={activeRule.prefixModIds.includes(definition.id)}
                    onPress={() => updateActiveRule('prefixModIds', values => (
                      toggleValue(values, definition.id as EquipmentAutoSellModId)
                    ))}
                  />
                ))}
              </FilterSection>

              <TierSection
                testIDPrefix="auto-sell-prefix-tier"
                title={t('ui.autoSell.prefixTierCondition')}
                selected={activeRule.prefixTiers}
                onToggle={tier => updateActiveRule('prefixTiers', values => toggleValue(values, tier))}
                hint={t('ui.autoSell.unselectedAny')}
              />

              <FilterSection title={t('ui.autoSell.suffixCondition')} hint={t('ui.autoSell.unselectedAny')}>
                <FilterChip
                  testID="auto-sell-suffix-none"
                  label={t('ui.autoSell.noMod')}
                  selected={activeRule.suffixModIds.includes('none')}
                  onPress={() => updateActiveRule('suffixModIds', values => toggleValue(values, 'none'))}
                />
                {EQUIPMENT_MOD_DEFS.filter(definition => definition.slot === 'suffix').map(definition => (
                  <FilterChip
                    key={definition.id}
                    testID={`auto-sell-suffix-${definition.id}`}
                    label={getEquipmentModLabel(definition.id)}
                    selected={activeRule.suffixModIds.includes(definition.id)}
                    onPress={() => updateActiveRule('suffixModIds', values => (
                      toggleValue(values, definition.id as EquipmentAutoSellModId)
                    ))}
                  />
                ))}
              </FilterSection>

              <TierSection
                testIDPrefix="auto-sell-suffix-tier"
                title={t('ui.autoSell.suffixTierCondition')}
                selected={activeRule.suffixTiers}
                onToggle={tier => updateActiveRule('suffixTiers', values => toggleValue(values, tier))}
                hint={t('ui.autoSell.unselectedAny')}
              />

              <TouchableOpacity
                testID="auto-sell-rule-remove"
                accessibilityRole="button"
                accessibilityLabel={t('ui.autoSell.removeRule')}
                style={styles.removeRuleButton}
                onPress={removeActiveRule}
              >
                <Text style={styles.removeRuleText}>{t('ui.autoSell.removeRule')}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

function FilterSection({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <View style={styles.filterSection}>
      <View style={styles.filterHeading}>
        <Text style={styles.filterTitle}>{title}</Text>
        <Text style={styles.filterHint}>{hint}</Text>
      </View>
      <View style={styles.chipRow}>{children}</View>
    </View>
  )
}

function TierSection({
  testIDPrefix,
  title,
  selected,
  onToggle,
  hint,
}: {
  testIDPrefix: string
  title: string
  selected: EquipmentModTier[]
  onToggle: (tier: EquipmentModTier) => void
  hint: string
}) {
  return (
    <FilterSection title={title} hint={hint}>
      {MOD_TIERS.map(tier => (
        <FilterChip
          key={tier}
          testID={`${testIDPrefix}-${tier}`}
          label={`T${tier}`}
          selected={selected.includes(tier)}
          onPress={() => onToggle(tier)}
        />
      ))}
    </FilterSection>
  )
}

function FilterChip({
  testID,
  label,
  selected,
  onPress,
}: {
  testID: string
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      style={[styles.filterChip, selected && styles.filterChipSelected]}
      onPress={onPress}
    >
      <View style={[styles.filterCheckbox, selected && styles.filterCheckboxSelected]}>
        {selected ? <Text style={styles.filterCheckboxMark}>✓</Text> : null}
      </View>
      <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#F3F4F6' },
  header: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerButton: { minWidth: 68, paddingVertical: 8 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#1F2937' },
  backText: { color: '#4B5563', fontSize: 14 },
  saveText: { color: '#2563EB', textAlign: 'right', fontSize: 14, fontWeight: '700' },
  disabledText: { color: '#9CA3AF' },
  listContent: { padding: 12, paddingBottom: 40 },
  listHeader: { marginBottom: 12 },
  description: { color: '#4B5563', fontSize: 13, lineHeight: 19 },
  warning: { marginTop: 6, color: '#92400E', fontSize: 12, lineHeight: 18 },
  bulkSellFilterCard: { marginTop: 10, padding: 12, gap: 7, alignItems: 'flex-end', backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FDBA74', borderRadius: 9 },
  bulkSellFilterText: { alignSelf: 'stretch', color: '#9A3412', fontSize: 12, fontWeight: '700' },
  helpText: { color: '#6B7280', fontSize: 13 },
  searchInput: { marginTop: 12, height: 42, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, backgroundColor: '#FFFFFF', paddingHorizontal: 12, fontSize: 14, color: '#1F2937' },
  itemCard: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  itemName: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 10 },
  modeRow: { flexDirection: 'row', gap: 6 },
  modeButton: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#F9FAFB' },
  modeButtonSelected: { borderColor: '#2563EB', backgroundColor: '#DBEAFE' },
  modeText: { color: '#4B5563', fontSize: 12, fontWeight: '600' },
  modeTextSelected: { color: '#1D4ED8' },
  ruleCount: { marginTop: 8, color: '#6B7280', fontSize: 11, textAlign: 'right' },
  manualSellRuleRow: { marginTop: 8, gap: 6, alignItems: 'flex-end' },
  clearManualSellRulesText: { color: '#DC2626', fontSize: 12, fontWeight: '700' },
  editorContent: { padding: 16, paddingBottom: 48 },
  ruleTabs: { gap: 8, paddingVertical: 14 },
  ruleTab: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB' },
  ruleTabSelected: { backgroundColor: '#DBEAFE', borderColor: '#2563EB' },
  ruleTabText: { color: '#4B5563', fontSize: 12, fontWeight: '700' },
  addRuleButton: { paddingHorizontal: 12, paddingVertical: 9 },
  addRuleText: { color: '#2563EB', fontSize: 12, fontWeight: '700' },
  filterSection: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  filterHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  filterTitle: { color: '#1F2937', fontSize: 13, fontWeight: '700' },
  filterHint: { color: '#9CA3AF', fontSize: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 16, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#D1D5DB' },
  filterChipSelected: { backgroundColor: '#DBEAFE', borderColor: '#2563EB' },
  filterCheckbox: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 3, borderWidth: 1.5, borderColor: '#9CA3AF', backgroundColor: '#FFFFFF' },
  filterCheckboxSelected: { borderColor: '#2563EB', backgroundColor: '#2563EB' },
  filterCheckboxMark: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', lineHeight: 12 },
  filterChipText: { color: '#4B5563', fontSize: 12 },
  filterChipTextSelected: { color: '#1D4ED8', fontWeight: '700' },
  removeRuleButton: { marginTop: 6, paddingVertical: 12, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  removeRuleText: { color: '#DC2626', fontSize: 13, fontWeight: '700' },
})
