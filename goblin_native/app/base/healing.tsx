import { useCallback, useMemo, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useBaseStore, selectGold } from '@/presentation/stores/useBaseStore'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { getGoblinDisplayImage } from '@/shared/utils/goblinImages'
import { getEffectiveStats } from '@/shared/utils/goblinStats'
import { calculateHealingCost, isInjuredGoblin } from '@/shared/utils/healing'
import type { Goblin } from '@/shared/types'

export default function HealingScreen() {
  const { t } = useTranslation()
  const gold = useBaseStore(selectGold)
  const baseLoading = useBaseStore((state) => state.isLoading)
  const updateBaseState = useBaseStore((state) => state.updateBaseState)
  const goblins = useGoblinStore((state) => state.goblins)
  const goblinsLoading = useGoblinStore((state) => state.isLoading)
  const updateGoblinCurrentHp = useGoblinStore((state) => state.updateGoblinCurrentHp)
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set())
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)

  const injuredGoblins = useMemo(() => {
    return goblins.filter(isInjuredGoblin)
  }, [goblins])

  const totalCost = useMemo(() => {
    return injuredGoblins.reduce((sum, goblin) => sum + calculateHealingCost(goblin), 0)
  }, [injuredGoblins])

  const healGoblin = useCallback(async (goblin: Goblin) => {
    const cost = calculateHealingCost(goblin)
    if (gold < cost) {
      Alert.alert(t('ui.healing.insufficientGoldTitle'), t('ui.healing.insufficientGoldBody', { cost, gold }))
      return
    }

    try {
      setProcessingIds(prev => new Set(prev).add(goblin.id))
      await updateBaseState({ gold: gold - cost })
      await updateGoblinCurrentHp(goblin.id, getEffectiveStats(goblin).hp)
    } catch (error) {
      console.error('[Healing] Failed to heal goblin', error)
      Alert.alert(t('ui.healing.failedTitle'), t('ui.healing.failedBody'))
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev)
        next.delete(goblin.id)
        return next
      })
    }
  }, [gold, t, updateBaseState, updateGoblinCurrentHp])

  const healAll = useCallback(async () => {
    if (injuredGoblins.length === 0) return
    if (gold < totalCost) {
      Alert.alert(t('ui.healing.insufficientGoldTitle'), t('ui.healing.insufficientGoldBody', { cost: totalCost, gold }))
      return
    }

    try {
      setIsBulkProcessing(true)
      await updateBaseState({ gold: gold - totalCost })
      for (const goblin of injuredGoblins) {
        await updateGoblinCurrentHp(goblin.id, getEffectiveStats(goblin).hp)
      }
    } catch (error) {
      console.error('[Healing] Failed to heal all goblins', error)
      Alert.alert(t('ui.healing.failedTitle'), t('ui.healing.failedBody'))
    } finally {
      setIsBulkProcessing(false)
    }
  }, [gold, injuredGoblins, t, totalCost, updateBaseState, updateGoblinCurrentHp])

  if (baseLoading || goblinsLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>{t('ui.common.loading')}</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{t('ui.healing.title')}</Text>
          <Text style={styles.summaryLead}>{t('ui.healing.lead')}</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('ui.healing.goldLabel')}</Text>
            <Text style={styles.summaryValue}>{t('ui.healing.goldValue', { gold })}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('ui.healing.injuredLabel')}</Text>
            <Text style={styles.summaryValue}>{t('ui.healing.injuredValue', { count: injuredGoblins.length })}</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (injuredGoblins.length === 0 || gold < totalCost || isBulkProcessing) && styles.buttonDisabled,
            ]}
            onPress={() => void healAll()}
            disabled={injuredGoblins.length === 0 || gold < totalCost || isBulkProcessing}
          >
            <Text style={styles.primaryButtonText}>
              {isBulkProcessing ? t('ui.healing.processing') : t('ui.healing.healAllButton', { cost: totalCost })}
            </Text>
          </TouchableOpacity>
        </View>

        {injuredGoblins.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('ui.healing.empty')}</Text>
          </View>
        ) : (
          injuredGoblins.map((goblin) => {
            const maxHp = getEffectiveStats(goblin).hp
            const cost = calculateHealingCost(goblin)
            const processing = processingIds.has(goblin.id)
            const disabled = gold < cost || processing || isBulkProcessing

            return (
              <View key={goblin.id} style={styles.goblinCard}>
                <Image source={getGoblinDisplayImage(goblin)} style={styles.avatar} />
                <View style={styles.goblinInfo}>
                  <Text style={styles.goblinName}>{goblin.name}</Text>
                  <Text style={styles.goblinMeta}>{t('ui.healing.goblinMeta', { race: goblin.race, level: goblin.level })}</Text>
                  <Text style={styles.goblinHp}>{t('ui.healing.hpLine', { current: goblin.currentHp ?? maxHp, max: maxHp })}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.healButton, disabled && styles.buttonDisabled]}
                  onPress={() => void healGoblin(goblin)}
                  disabled={disabled}
                >
                  <Text style={styles.healButtonText}>
                    {processing ? t('ui.healing.processing') : t('ui.healing.healButton', { cost })}
                  </Text>
                </TouchableOpacity>
              </View>
            )
          })
        )}
      </ScrollView>
    </SafeAreaView>
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
    paddingBottom: 88,
    gap: 12,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  summaryLead: {
    fontSize: 13,
    lineHeight: 20,
    color: '#6B7280',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  primaryButton: {
    marginTop: 4,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },
  goblinCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 6,
  },
  goblinInfo: {
    flex: 1,
    gap: 3,
  },
  goblinName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  goblinMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  goblinHp: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '700',
  },
  healButton: {
    borderRadius: 8,
    backgroundColor: '#111827',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  healButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
})
