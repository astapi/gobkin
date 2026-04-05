import { useMemo, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import type { BattleLogEntry, BattleLogMeta } from '@/shared/types'
import { getBattleLog, clearBattleLog } from '@/presentation/contexts/battleLogStore'

export default function BattleLogScreen() {
  const { logId } = useLocalSearchParams<{ logId?: string }>()

  const stored = useMemo(() => {
    if (!logId) return null
    const raw = Array.isArray(logId) ? logId[0] : logId
    if (!raw) return null
    return getBattleLog(raw)
  }, [logId])

  const battleLog = stored?.log ?? null
  const meta = stored?.meta ?? null

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

            const isSpell = entry.action !== '通常攻撃' && entry.action !== 'turn_start'

            return (
              <View key={`log-${index}`} style={styles.logCard}>
                <Text style={styles.logTitle}>
                  {isSpell
                    ? `${entry.actorName}の${entry.action}（${entry.actorHP}/${entry.actorMaxHP}HP）`
                    : `${entry.actorName}の${entry.attackCount}回攻撃（${entry.actorHP}/${entry.actorMaxHP}HP）`
                  }
                </Text>
                <Text style={styles.logText}>
                  {isSpell
                    ? `[列${entry.actorRow}] ${entry.actorName}の${entry.action}！${entry.hitCount}体にヒット！`
                    : `[列${entry.actorRow}] ${entry.actorName}の攻撃！${entry.hitCount}回ヒット！`
                  }
                </Text>
                {entry.targets?.map((target, targetIndex) => (
                  <Text key={`target-${targetIndex}`} style={styles.logText}>
                    [列{target.targetRow}] {target.targetName}に {target.totalDamage}ダメージ{target.defeated ? 'を与えて倒した！' : `(${target.hitCount}回)`}
                  </Text>
                ))}
              </View>
            )
          })}

          {meta && <BattleResultSection meta={meta} />}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function BattleResultSection({ meta }: { meta: BattleLogMeta }) {
  const outcomeText = meta.outcome === 'win' ? '戦いに勝利した！' : '戦いに敗北した...'

  return (
    <View style={styles.resultCard}>
      <Text style={styles.resultTitle}>{outcomeText}</Text>

      {meta.outcome === 'win' && (
        <>
          <Text style={styles.resultSummary}>
            経験値 {meta.xpGained} と {meta.goldGained} gold を手に入れました。
          </Text>

          <Text style={styles.resultLabel}>＜獲得経験値＞</Text>
          {meta.members.map((member, index) => (
            <Text key={`xp-${index}`} style={styles.resultText}>
              Exp +{member.xpEach} {member.name} ({member.xpEach} x {member.expMultiplier}倍)
            </Text>
          ))}
        </>
      )}

      <Text style={styles.resultLabel}> </Text>
      {meta.members.map((member, index) => (
        <Text key={`status-${index}`} style={styles.resultText}>
          ({member.currentHP}/{member.maxHP}) {member.name} Lv{member.level}
        </Text>
      ))}
    </View>
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
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  resultSummary: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 10,
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 6,
    marginBottom: 2,
  },
  resultText: {
    fontSize: 12,
    color: '#374151',
    marginTop: 2,
  },
})
