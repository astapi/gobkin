import { useEffect, useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { clearLevelUpLog, getLevelUpLog } from '@/presentation/contexts/levelUpLogStore'

export default function LevelUpLogScreen() {
  const { t } = useTranslation()
  const { logId } = useLocalSearchParams<{ logId?: string }>()

  const stored = useMemo(() => {
    if (!logId) return null
    const raw = Array.isArray(logId) ? logId[0] : logId
    if (!raw) return null
    return getLevelUpLog(raw)
  }, [logId])

  useEffect(() => {
    const raw = Array.isArray(logId) ? logId[0] : logId
    if (!raw) return undefined
    return () => {
      clearLevelUpLog(raw)
    }
  }, [logId])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back()
              return
            }
            router.replace('/formation/playback')
          }}
        >
          <Text style={styles.navBack}>← {t('ui.formation.common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{t('ui.formation.levelUpLog.title')}</Text>
        <View style={styles.navSpacer} />
      </View>

      {!stored && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{t('ui.formation.levelUpLog.loadFailed')}</Text>
        </View>
      )}

      {stored && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {stored.levelUps.map((levelUp, index) => (
            <View key={`${levelUp.memberName}-${index}`} style={styles.card}>
              <Text style={styles.memberName}>{levelUp.memberName}</Text>
              <Text style={styles.levelLine}>Lv{levelUp.oldLevel} → {levelUp.newLevel}</Text>

              <View style={styles.statList}>
                {levelUp.statChanges.map(change => (
                  <View key={change.key} style={styles.statRow}>
                    <Text style={styles.statName}>{t(`ui.stat.${change.key}`)}</Text>
                    <Text style={styles.statValue}>{change.oldValue} → {change.newValue}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  navBack: {
    fontSize: 14,
    color: '#4B5563',
  },
  navTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  navSpacer: {
    width: 60,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 12,
    gap: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  levelLine: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
  },
  statList: {
    marginTop: 10,
    gap: 6,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statName: {
    fontSize: 14,
    color: '#374151',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
})
