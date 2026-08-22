import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { usePartyStore } from '@/presentation/stores/usePartyStore'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { getEquipmentTemplate } from '@/shared/data/equipmentPoolLoader'
import { getEquipmentDisplayName } from '@/shared/i18n/entityLocalization'
import { BOTTOM_INFO_SPACING } from '@/shared/constants/layout'

export default function AutoExpeditionSummaryScreen() {
  const { t } = useTranslation()
  const { partyId } = useLocalSearchParams<{ partyId?: string }>()
  const numericPartyId = Number.parseInt(partyId ?? '', 10)
  const party = usePartyStore(state => state.parties.find(item => item.id === numericPartyId))
  const goblins = useGoblinStore(state => state.goblins)
  const summary = party?.autoExpeditionSummary

  const rewardItems = useMemo(() => (summary?.rewardItems ?? []).map(item => {
    const template = getEquipmentTemplate(item.templateId)
    const name = template
      ? getEquipmentDisplayName(item, template)
      : item.templateId
    return { ...item, name }
  }), [summary?.rewardItems])

  const equipmentCount = rewardItems.reduce((total, item) => total + item.count, 0)

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>‹ {t('ui.formation.common.back')}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t('ui.formation.autoSummary.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        testID="auto-expedition-summary"
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: BOTTOM_INFO_SPACING }]}
      >
        <Text style={styles.partyName}>{party?.name ?? ''}</Text>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('ui.formation.autoSummary.runCountLabel')}</Text>
          <Text style={styles.summaryValue}>
            {t('ui.formation.autoSummary.runCountValue', { count: summary?.runCount ?? 0 })}
          </Text>
        </View>

        {!summary || summary.runCount === 0 ? (
          <Text style={styles.emptyText}>{t('ui.formation.autoSummary.noRuns')}</Text>
        ) : (
          <>
            <OutcomeRow
              label={t('ui.formation.autoSummary.clears')}
              count={summary.clearCount ?? 0}
            />
            <OutcomeRow
              label={t('ui.formation.autoSummary.wipeouts')}
              count={summary.wipeoutCount ?? 0}
            />
            <OutcomeRow
              label={t('ui.formation.autoSummary.retreats')}
              count={summary.retreatCount ?? 0}
            />
            {summary.levelUps.length > 0 && (
              <View style={styles.levelUpBlock}>
                <Text style={styles.sectionTitle}>{t('ui.formation.autoSummary.levelUpsTitle')}</Text>
                {summary.levelUps.map(levelUp => {
                  const goblin = goblins.find(item => item.id === levelUp.goblinId)
                  return (
                    <View key={levelUp.goblinId} style={styles.levelUpRow}>
                      <Text style={styles.rowLabel}>{goblin?.name ?? `#${levelUp.goblinId}`}</Text>
                      <Text style={styles.levelUpValue}>
                        {t('ui.formation.autoSummary.levelUpValue', {
                          oldLevel: levelUp.oldLevel,
                          newLevel: levelUp.newLevel,
                        })}
                      </Text>
                    </View>
                  )
                })}
              </View>
            )}

            <SummaryRow label={t('ui.formation.autoSummary.xp')} value={summary.xpGained.toLocaleString()} />
            <SummaryRow label={t('ui.formation.autoSummary.gold')} value={`${summary.goldGained.toLocaleString()}G`} />
            <SummaryRow
              label={t('ui.formation.autoSummary.equipment')}
              value={t('ui.formation.autoSummary.itemCount', { count: equipmentCount })}
            />
            {rewardItems.map(item => (
              <View key={`${item.templateId}:${item.titleId ?? ''}`} style={styles.itemRow}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemCount}>×{item.count}</Text>
              </View>
            ))}
            {summary.factorCount > 0 && (
              <SummaryRow
                label={t('ui.formation.autoSummary.factors')}
                value={t('ui.formation.autoSummary.itemCount', { count: summary.factorCount })}
              />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  )
}

function OutcomeRow({ label, count }: { label: string; count: number }) {
  const { t } = useTranslation()
  if (count <= 0) return null
  return (
    <SummaryRow
      label={label}
      value={t('ui.formation.autoSummary.runCountValue', { count })}
    />
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D1D5DB',
  },
  backButton: { minWidth: 80, paddingVertical: 8 },
  backButtonText: { color: '#2563EB', fontSize: 16, fontWeight: '600' },
  headerTitle: { color: '#111827', fontSize: 18, fontWeight: '700' },
  headerSpacer: { width: 80 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 24 },
  partyName: { color: '#6B7280', fontSize: 14, marginBottom: 18 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 12,
  },
  summaryLabel: { color: '#111827', fontSize: 17 },
  summaryValue: { color: '#111827', fontSize: 17, fontWeight: '700' },
  emptyText: { color: '#6B7280', fontSize: 15, paddingTop: 20 },
  levelUpBlock: { paddingVertical: 12 },
  sectionTitle: { color: '#111827', fontSize: 17, fontWeight: '700', marginBottom: 4 },
  levelUpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 16,
  },
  rowLabel: { color: '#1F2937', fontSize: 15, fontWeight: '600' },
  levelUpValue: { color: '#16A34A', fontSize: 15, fontWeight: '700' },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingLeft: 16,
  },
  itemName: { color: '#4B5563', fontSize: 15, flex: 1 },
  itemCount: { color: '#4B5563', fontSize: 15 },
})
