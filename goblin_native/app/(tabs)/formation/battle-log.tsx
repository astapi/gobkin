import { useMemo, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import type { BattleLogEntry } from '@/shared/types'
import { getBattleLog, clearBattleLog } from '@/presentation/contexts/battleLogStore'

export default function BattleLogScreen() {
  const { logId } = useLocalSearchParams<{ logId?: string }>()

  const battleLog = useMemo<BattleLogEntry[] | null>(() => {
    if (!logId) return null
    const raw = Array.isArray(logId) ? logId[0] : logId
    if (!raw) return null
    return getBattleLog(raw)
  }, [logId])

  useEffect(() => {
    const raw = Array.isArray(logId) ? logId[0] : logId
    if (!raw) return undefined
    return () => {
      clearBattleLog(raw)
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
          <Text style={styles.navBack}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>戦闘ログ</Text>
        <View style={styles.navSpacer} />
      </View>

      {!battleLog && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>戦闘ログを読み込めませんでした。</Text>
        </View>
      )}

      {battleLog && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {battleLog.map((entry, index) => {
            if (entry.action === 'turn_start' && entry.turnState) {
              return (
                <View key={`turn-${entry.turn}-${index}`} style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Turn {entry.turn} 開始</Text>
                  <Text style={styles.sectionLabel}>味方:</Text>
                  {entry.turnState.allies.map(ally => (
                    <Text key={ally.id} style={styles.sectionText}>
                      {ally.name} {ally.currentHP}/{ally.maxHP} HP
                    </Text>
                  ))}
                  <Text style={styles.sectionLabel}>敵:</Text>
                  {entry.turnState.enemies.map((enemy, enemyIndex) => (
                    <Text key={`${enemy.id}-${enemyIndex}`} style={styles.sectionText}>
                      {enemy.name} {enemy.currentHP}/{enemy.maxHP} HP
                    </Text>
                  ))}
                </View>
              )
            }

            if (entry.action === 'turn_start') {
              return null
            }

            return (
              <View key={`log-${index}`} style={styles.logCard}>
                <Text style={styles.logTitle}>
                  {entry.actorName}の攻撃 ({entry.actorHP ?? 0}HP)
                </Text>
                <Text style={styles.logText}>{entry.actorName}の{entry.action}！</Text>
                {entry.targetName && typeof entry.damage === 'number' && (
                  <Text style={styles.logText}>
                    {entry.targetName}に{entry.damage}ダメージを与え{entry.targetDefeated ? '倒した！' : 'た！'}
                  </Text>
                )}
              </View>
            )
          })}
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
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 12,
    gap: 10,
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
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 6,
  },
  sectionText: {
    fontSize: 12,
    color: '#374151',
    marginTop: 2,
  },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  logTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  logText: {
    fontSize: 12,
    color: '#374151',
    marginTop: 2,
  },
})
