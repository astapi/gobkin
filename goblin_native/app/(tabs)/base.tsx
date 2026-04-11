import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useBaseStore, selectRank, selectMaxParties, selectMaxGoblins, selectIvBonus } from '@/presentation/stores/useBaseStore'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { getBaseLocationName } from '@/shared/i18n/entityLocalization'

export default function BaseManagementScreen() {
  const { t } = useTranslation()
  const baseLoading = useBaseStore((state) => state.isLoading)
  const rank = useBaseStore(selectRank)
  const maxParties = useBaseStore(selectMaxParties)
  const maxGoblins = useBaseStore(selectMaxGoblins)
  const ivBonus = useBaseStore(selectIvBonus)
  const goblins = useGoblinStore((state) => state.goblins)
  const baseLocationName = getBaseLocationName(rank) || t('ui.base.locationUnknown')

  if (baseLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>{t('ui.common.loading')}</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.screenTitle}>{t('ui.base.title')}</Text>
        <Text style={styles.screenLead}>{t('ui.base.lead')}</Text>

        <View style={styles.heroCard}>
          <StatusRow label={t('ui.base.rankLabel')} value={t('ui.base.rankValue', { rank })} />
          <StatusRow label={t('ui.base.locationLabel')} value={baseLocationName} />
          <StatusRow label={t('ui.base.capacityLabel')} value={t('ui.base.capacityValue', { current: goblins.length, max: maxGoblins })} />
          <StatusRow label={t('ui.base.maxPartiesLabel')} value={t('ui.base.maxPartiesValue', { maxParties })} />
          <StatusRow label={t('ui.base.ivBonusLabel')} value={t('ui.base.ivBonusValue', { ivBonus })} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('ui.base.menuTitle')}</Text>

          <TouchableOpacity style={styles.menuButton} onPress={() => router.push('/base/upgrade')}>
            <View style={styles.menuButtonTextGroup}>
              <Text style={styles.menuButtonTitle}>{t('ui.base.upgradeTitle')}</Text>
              <Text style={styles.menuButtonDescription}>{t('ui.base.upgradeDescription')}</Text>
            </View>
            <Text style={styles.menuButtonArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuButton} onPress={() => router.push('/base/training')}>
            <View style={styles.menuButtonTextGroup}>
              <Text style={styles.menuButtonTitle}>{t('ui.base.trainingTitle')}</Text>
              <Text style={styles.menuButtonDescription}>{t('ui.base.trainingDescription')}</Text>
            </View>
            <Text style={styles.menuButtonArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuButton} onPress={() => router.push('/base/healing')}>
            <View style={styles.menuButtonTextGroup}>
              <Text style={styles.menuButtonTitle}>{t('ui.base.healingTitle')}</Text>
              <Text style={styles.menuButtonDescription}>{t('ui.base.healingDescription')}</Text>
            </View>
            <Text style={styles.menuButtonArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 88,
    gap: 16,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  screenLead: {
    fontSize: 13,
    lineHeight: 20,
    color: '#6B7280',
    marginTop: -10,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statusLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  statusValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    flexShrink: 1,
    textAlign: 'right',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  menuButtonTextGroup: {
    flex: 1,
    gap: 4,
  },
  menuButtonTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  menuButtonDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
  },
  menuButtonArrow: {
    fontSize: 26,
    lineHeight: 26,
    color: '#9CA3AF',
  },
})
