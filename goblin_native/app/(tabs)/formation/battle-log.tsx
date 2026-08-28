import { memo, useMemo, useEffect, useRef, useCallback } from 'react'
import { View, Text, Image, StyleSheet, ScrollView, FlatList, TouchableOpacity, type ImageSourcePropType } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { BattleLogEntry, BattleLogMeta, Goblin } from '@/shared/types'
import { BOTTOM_INFO_SPACING } from '@/shared/constants/layout'
import { getBattleLog, clearBattleLog } from '@/presentation/contexts/battleLogStore'
import { getGoblinBattleImage, getGoblinDisplayImageScale } from '@/shared/utils/goblinImages'
import { getEnemyImage } from '@/shared/utils/enemyImages'

export default function BattleLogScreen() {
  const { t } = useTranslation()
  const { logId } = useLocalSearchParams<{ logId?: string }>()
  const listRef = useRef<FlatList<BattleLogEntry>>(null)

  const stored = useMemo(() => {
    if (!logId) return null
    const raw = Array.isArray(logId) ? logId[0] : logId
    if (!raw) return null
    return getBattleLog(raw)
  }, [logId])

  const battleLog = stored?.log ?? null
  const meta = stored?.meta ?? null
  const partySnapshot = stored?.partySnapshot ?? []

  // ターン番号 → 先頭エントリのindex を対応付け、サイドバーからのジャンプに使う
  const turnIndexEntries = useMemo(() => {
    if (!battleLog) return []
    const entries: { turn: number; index: number }[] = []
    const seen = new Set<number>()
    battleLog.forEach((entry, index) => {
      if (entry.action !== 'turn_start' || seen.has(entry.turn)) return
      seen.add(entry.turn)
      entries.push({ turn: entry.turn, index })
    })
    return entries
  }, [battleLog])

  const scrollToTurn = useCallback((index: number) => {
    listRef.current?.scrollToIndex({ index, viewPosition: 0, viewOffset: 8, animated: true })
  }, [])

  const goblinMap = useMemo(() => {
    const map = new Map<string, Goblin>()
    for (const goblin of partySnapshot) {
      map.set(String(goblin.id), goblin)
    }
    return map
  }, [partySnapshot])

  const renderItem = useCallback(
    ({ item, index }: { item: BattleLogEntry; index: number }) => (
      <BattleLogRow entry={item} index={index} goblinMap={goblinMap} t={t} />
    ),
    [goblinMap, t],
  )

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
          testID="battle-log-back"
          accessibilityRole="button"
          accessibilityLabel={t('ui.formation.common.back')}
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
          <TouchableOpacity
            testID="battle-log-empty-back"
            accessibilityRole="button"
            accessibilityLabel={t('ui.formation.common.back')}
            style={styles.emptyBackButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back()
                return
              }
              router.replace('/formation/playback')
            }}
          >
            <Text style={styles.emptyBackButtonText}>{t('ui.formation.common.back')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {battleLog && (
        <View style={styles.logShell}>
          <FlatList
            ref={listRef}
            data={battleLog}
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyExtractor={(item, index) => `${item.action}-${item.turn}-${index}`}
            renderItem={renderItem}
            ListFooterComponent={meta ? <BattleResultSection meta={meta} /> : null}
            initialNumToRender={16}
            windowSize={11}
            removeClippedSubviews
            onScrollToIndexFailed={({ index, averageItemLength }) => {
              listRef.current?.scrollToOffset({ offset: averageItemLength * index, animated: true })
              setTimeout(() => {
                listRef.current?.scrollToIndex({ index, viewOffset: 8, animated: true })
              }, 60)
            }}
          />

          {turnIndexEntries.length > 0 && (
            <View style={styles.turnIndexContainer}>
              <ScrollView contentContainerStyle={styles.turnIndexContent} showsVerticalScrollIndicator={false}>
                {turnIndexEntries.map(({ turn, index }) => (
                  <TouchableOpacity
                    key={`turn-index-${turn}`}
                    testID={`battle-log-turn-${turn}`}
                    style={styles.turnIndexButton}
                    onPress={() => scrollToTurn(index)}
                    accessibilityRole="button"
                    accessibilityLabel={t('ui.formation.battleLog.turnStart', { turn })}
                  >
                    <Text style={styles.turnIndexText}>{turn}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  )
}

const BattleLogRow = memo(function BattleLogRow({
  entry,
  index,
  goblinMap,
  t,
}: {
  entry: BattleLogEntry
  index: number
  goblinMap: Map<string, Goblin>
  t: TFunction
}) {
  if (entry.action === 'turn_start' && entry.turnState) {
    const allyPartyEffects = entry.turnState.allyPartyEffects ?? []
    const enemyPartyEffects = entry.turnState.enemyPartyEffects ?? []
    return (
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{t('ui.formation.battleLog.turnStart', { turn: entry.turn })}</Text>
        <Text style={styles.sectionLabel}>{t('ui.formation.battleLog.allies')}</Text>
        {allyPartyEffects.length > 0 && (
          <Text style={styles.sectionText}>
            {t('ui.formation.battleLog.partyEffects', {
              effects: allyPartyEffects.map(effect => t(`ui.formation.battleLog.partyEffect.${effect}`)).join(' / '),
            })}
          </Text>
        )}
        {entry.turnState.allies.map(ally => (
          <Text key={ally.id} style={styles.sectionText}>
            {ally.name} {ally.currentHP}/{ally.maxHP} HP
          </Text>
        ))}
        <Text style={styles.sectionLabel}>{t('ui.formation.battleLog.enemies')}</Text>
        {enemyPartyEffects.length > 0 && (
          <Text style={styles.sectionText}>
            {t('ui.formation.battleLog.partyEffects', {
              effects: enemyPartyEffects.map(effect => t(`ui.formation.battleLog.partyEffect.${effect}`)).join(' / '),
            })}
          </Text>
        )}
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

  const isSpell = entry.action !== t('battle.normalAttack') && entry.action !== 'turn_start'
  const isHealingAction = entry.targets?.some(target => target.totalDamage < 0) ?? false
  const isBarrierAction = entry.actionEffect === 'barrier' || entry.action === t('entities.spell.shield_barrier')
  const isAttackUpAction = entry.actionEffect === 'attack_up' || entry.action === t('entities.spell.attack_up')
  const isMagicFieldAction = entry.actionEffect === 'magic_field'

  const allyGoblin = entry.isAlly ? goblinMap.get(entry.actorId) : undefined
  const actorImage = allyGoblin
    ? getGoblinBattleImage(allyGoblin)
    : getEnemyImage({ id: entry.actorId, name: entry.actorName }) ?? undefined
  const actorImageScale = allyGoblin
    ? getGoblinDisplayImageScale(allyGoblin)
    : getEnemyBattleLogImageScale(entry.actorId)

  if (entry.actionEffect === 'regen') {
    const healed = Math.abs(entry.targets?.[0]?.totalDamage ?? 0)
    return (
      <View style={styles.logCard}>
        <View style={styles.logHeader}>
          {actorImage && <BattleActorImage source={actorImage} scale={actorImageScale} />}
          <Text style={[styles.logText, styles.logHeaderText]}>
            {t('ui.formation.battleLog.regenSummary', { actor: entry.actorName, heal: healed })}
          </Text>
        </View>
      </View>
    )
  }

  if (entry.actionEffect === 'defend') {
    return (
      <View style={styles.logCard}>
        <View style={styles.logHeader}>
          {actorImage && <BattleActorImage source={actorImage} scale={actorImageScale} />}
          <View style={styles.logHeaderText}>
            <Text style={styles.logTitle}>
              {t('ui.formation.battleLog.defendTitle', { actor: entry.actorName, hp: entry.actorHP, maxHp: entry.actorMaxHP })}
            </Text>
          </View>
        </View>
      </View>
    )
  }

  if (isBarrierAction) {
    return (
      <View style={styles.logCard}>
        <View style={styles.logHeader}>
          {actorImage && <BattleActorImage source={actorImage} scale={actorImageScale} />}
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

  if (isAttackUpAction) {
    return (
      <View style={styles.logCard}>
        <View style={styles.logHeader}>
          {actorImage && <BattleActorImage source={actorImage} scale={actorImageScale} />}
          <View style={styles.logHeaderText}>
            <Text style={styles.logTitle}>
              {t('ui.formation.battleLog.attackUpTitle', { actor: entry.actorName, action: entry.action })}
            </Text>
            <Text style={styles.logText}>
              {t('ui.formation.battleLog.attackUpSummary')}
            </Text>
          </View>
        </View>
      </View>
    )
  }

  if (isMagicFieldAction) {
    return (
      <View style={styles.logCard}>
        <View style={styles.logHeader}>
          {actorImage && <BattleActorImage source={actorImage} scale={actorImageScale} />}
          <View style={styles.logHeaderText}>
            <Text style={styles.logTitle}>
              {t('ui.formation.battleLog.magicFieldTitle', { actor: entry.actorName, action: entry.action })}
            </Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.logCard}>
      <View style={styles.logHeader}>
        {actorImage && <BattleActorImage source={actorImage} scale={actorImageScale} />}
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
        <Text key={`target-${index}-${targetIndex}`} style={[styles.logText, actorImage ? styles.logTargetIndented : undefined]}>
          {target.totalDamage < 0
            ? t('ui.formation.battleLog.targetHealed', { row: target.targetRow, name: target.targetName, heal: Math.abs(target.totalDamage) })
            : target.piercingHitCount && target.defeated
            ? t('ui.formation.battleLog.targetPiercedDefeated', { row: target.targetRow, name: target.targetName, damage: target.totalDamage })
            : target.piercingHitCount
            ? t('ui.formation.battleLog.targetPierced', { row: target.targetRow, name: target.targetName, damage: target.totalDamage, count: target.hitCount })
            : target.defeated
            ? t('ui.formation.battleLog.targetDefeated', { row: target.targetRow, name: target.targetName, damage: target.totalDamage })
            : t('ui.formation.battleLog.targetHits', { row: target.targetRow, name: target.targetName, damage: target.totalDamage, count: target.hitCount })}
        </Text>
      ))}
    </View>
  )
})

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

function BattleActorImage({ source, scale }: { source: ImageSourcePropType; scale: number }) {
  return (
    <View style={styles.actorImageFrame}>
      <Image
        source={source}
        style={[styles.actorImage, { transform: [{ scale }] }]}
        resizeMode="contain"
      />
    </View>
  )
}

function getEnemyBattleLogImageScale(enemyId: string): number {
  if (enemyId.startsWith('B_')) return 1.05
  if (enemyId.startsWith('WFG') || enemyId.startsWith('CAT')) return 1.2
  return 1.14
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
    paddingBottom: BOTTOM_INFO_SPACING,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyBackButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#374151',
    borderRadius: 8,
  },
  emptyBackButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  logShell: {
    flex: 1,
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
  actorImageFrame: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  actorImage: {
    width: 42,
    height: 42,
    borderRadius: 6,
  },
  logHeaderText: {
    flex: 1,
  },
  logTargetIndented: {
    marginLeft: 58,
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
  turnIndexContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 28,
    justifyContent: 'center',
  },
  turnIndexContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  turnIndexButton: {
    width: 28,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  turnIndexText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
})
