import { useMemo, useEffect } from 'react'
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import type { BattleLogEntry, BattleLogMeta, Goblin } from '@/shared/types'
import { getBattleLog, clearBattleLog } from '@/presentation/contexts/battleLogStore'
import { getGoblinDisplayImage } from '@/shared/utils/goblinImages'
import { getEnemyImage } from '@/shared/utils/enemyImages'

export default function BattleLogScreen() {
  const { t } = useTranslation()
  const { logId } = useLocalSearchParams<{ logId?: string }>()

  const stored = useMemo(() => {
    if (!logId) return null
    const raw = Array.isArray(logId) ? logId[0] : logId
    if (!raw) return null
    return getBattleLog(raw)
  }, [logId])

  const battleLog = stored?.log ?? null
  const meta = stored?.meta ?? null
  const partySnapshot = stored?.partySnapshot ?? []

  const goblinMap = useMemo(() => {
    const map = new Map<string, Goblin>()
    for (const goblin of partySnapshot) {
      map.set(String(goblin.id), goblin)
    }
    return map
  }, [partySnapshot])

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
          <Text style={styles.navBack}>← {t('ui.formation.common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{t('ui.formation.battleLog.title')}</Text>
        <View style={styles.navSpacer} />
      </View>

      {!battleLog && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{t('ui.formation.battleLog.loadFailed')}</Text>
        </View>
      )}

      {battleLog && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {battleLog.map((entry, index) => {
            if (entry.action === 'turn_start' && entry.turnState) {
              return (
                <View key={`turn-${entry.turn}-${index}`} style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>{t('ui.formation.battleLog.turnStart', { turn: entry.turn })}</Text>
                  <Text style={styles.sectionLabel}>{t('ui.formation.battleLog.allies')}</Text>
                  {entry.turnState.allies.map(ally => (
                    <Text key={ally.id} style={styles.sectionText}>
                      {ally.name} {ally.currentHP}/{ally.maxHP} HP{ally.shieldBarrierActive ? ` (${t('ui.formation.battleLog.shieldBarrierStatus')})` : ''}
                    </Text>
                  ))}
                  <Text style={styles.sectionLabel}>{t('ui.formation.battleLog.enemies')}</Text>
                  {entry.turnState.enemies.map((enemy, enemyIndex) => (
                    <Text key={`${enemy.id}-${enemyIndex}`} style={styles.sectionText}>
                      {enemy.name} {enemy.currentHP}/{enemy.maxHP} HP{enemy.shieldBarrierActive ? ` (${t('ui.formation.battleLog.shieldBarrierStatus')})` : ''}
                    </Text>
                  ))}
                </View>
              )
            }

            if (entry.action === 'turn_start') {
              return null
            }

            const isSpell = entry.action !== t('battle.normalAttack') && entry.action !== 'turn_start'
            const isHealingAction = entry.targets?.some(target => target.totalDamage < 0) ?? false
            const isBarrierAction = entry.actionEffect === 'barrier' || entry.action === t('entities.spell.shield_barrier')

            const allyGoblin = entry.isAlly ? goblinMap.get(entry.actorId) : undefined
            const actorImage = allyGoblin
              ? getGoblinDisplayImage(allyGoblin)
              : getEnemyImage({ id: entry.actorId, name: entry.actorName }) ?? undefined

            if (entry.actionEffect === 'regen') {
              const healed = Math.abs(entry.targets?.[0]?.totalDamage ?? 0)
              return (
                <View key={`log-${index}`} style={styles.logCard}>
                  <View style={styles.logHeader}>
                    {actorImage && <Image source={actorImage} style={styles.actorImage} />}
                    <Text style={[styles.logText, styles.logHeaderText]}>
                      {t('ui.formation.battleLog.regenSummary', { actor: entry.actorName, heal: healed })}
                    </Text>
                  </View>
                </View>
              )
            }

            if (isBarrierAction) {
              return (
                <View key={`log-${index}`} style={styles.logCard}>
                  <View style={styles.logHeader}>
                    {actorImage && <Image source={actorImage} style={styles.actorImage} />}
                    <View style={styles.logHeaderText}>
                      <Text style={styles.logTitle}>
                        {t('ui.formation.battleLog.spellTitle', { actor: entry.actorName, action: entry.action, hp: entry.actorHP, maxHp: entry.actorMaxHP })}
                      </Text>
                      <Text style={styles.logText}>
                        {t('ui.formation.battleLog.shieldBarrierSummary')}
                      </Text>
                    </View>
                  </View>
                </View>
              )
            }

            return (
              <View key={`log-${index}`} style={styles.logCard}>
                <View style={styles.logHeader}>
                  {actorImage && <Image source={actorImage} style={styles.actorImage} />}
                  <View style={styles.logHeaderText}>
                    <Text style={styles.logTitle}>
                      {isSpell
                        ? t('ui.formation.battleLog.spellTitle', { actor: entry.actorName, action: entry.action, hp: entry.actorHP, maxHp: entry.actorMaxHP })
                        : t('ui.formation.battleLog.attackTitle', { actor: entry.actorName, count: entry.attackCount, hp: entry.actorHP, maxHp: entry.actorMaxHP })
                      }
                    </Text>
                    <Text style={styles.logText}>
                      {isHealingAction
                        ? t('ui.formation.battleLog.healSummary', { row: entry.actorRow, actor: entry.actorName, action: entry.action, count: entry.hitCount })
                        : isSpell
                        ? t('ui.formation.battleLog.spellSummary', { row: entry.actorRow, actor: entry.actorName, action: entry.action, count: entry.hitCount })
                        : entry.isCritical
                        ? t('ui.formation.battleLog.attackCriticalSummary', { row: entry.actorRow, actor: entry.actorName, count: entry.hitCount })
                        : t('ui.formation.battleLog.attackSummary', { row: entry.actorRow, actor: entry.actorName, count: entry.hitCount })
                      }
                    </Text>
                  </View>
                </View>
                {entry.targets?.map((target, targetIndex) => (
                  <Text key={`target-${targetIndex}`} style={[styles.logText, actorImage ? styles.logTargetIndented : undefined]}>
                    {target.totalDamage < 0
                      ? t('ui.formation.battleLog.targetHealed', { row: target.targetRow, name: target.targetName, heal: Math.abs(target.totalDamage) })
                      : target.defeated
                      ? t('ui.formation.battleLog.targetDefeated', { row: target.targetRow, name: target.targetName, damage: target.totalDamage })
                      : t('ui.formation.battleLog.targetHits', { row: target.targetRow, name: target.targetName, damage: target.totalDamage, count: target.hitCount })}
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
  const { t } = useTranslation()
  const outcomeText = meta.outcome === 'win' ? t('ui.formation.battleLog.outcomeWin') : t('ui.formation.battleLog.outcomeLose')

  return (
    <View style={styles.resultCard}>
      <Text style={styles.resultTitle}>{outcomeText}</Text>

      {meta.outcome === 'win' && (
        <>
          <Text style={styles.resultSummary}>
            {t('ui.formation.battleLog.rewardSummary', { xp: meta.xpGained, gold: meta.goldGained })}
          </Text>

          <Text style={styles.resultLabel}>{t('ui.formation.battleLog.gainedXp')}</Text>
          {meta.members.map((member, index) => (
            <View key={`xp-${index}`} style={styles.memberResult}>
              <Text style={styles.resultText}>
                {t('ui.formation.battleLog.xpLine', { totalXp: Math.floor(member.xpEach * member.expMultiplier), baseXp: member.xpEach, name: member.name, multiplier: member.expMultiplier })}
              </Text>
              {member.levelUp && (
                <Text style={styles.levelUpText}>
                  {t('ui.formation.battleLog.levelUpLine', { oldLevel: member.levelUp.oldLevel, newLevel: member.levelUp.newLevel })}
                </Text>
              )}
            </View>
          ))}
        </>
      )}

      <Text style={styles.resultLabel}> </Text>
      {meta.members.map((member, index) => (
        <Text key={`status-${index}`} style={styles.resultText}>
          {t('ui.formation.battleLog.memberLine', { hp: member.currentHP, maxHp: member.maxHP, name: member.name, level: member.level })}
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
  logHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  actorImage: {
    width: 28,
    height: 28,
    borderRadius: 6,
    marginTop: 2,
  },
  logHeaderText: {
    flex: 1,
  },
  logTargetIndented: {
    marginLeft: 36,
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
  memberResult: {
    marginBottom: 2,
  },
  levelUpText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
    marginTop: 2,
  },
})
