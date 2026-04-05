import { useMemo, useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { useDungeonProgress } from '@/presentation/hooks/useDungeonProgress'
import { useExpeditionService } from '@/presentation/hooks/useExpeditionService'
import { getGoblinImage } from '@/shared/utils/goblinImages'
import { areasData } from '@/shared/data'
import { ModStatCalculator } from '@/core/services/ModStatCalculator'
import type { ExpeditionRecord, Goblin, TimelineEvent } from '@/shared/types'

export default function ExpeditionResultScreen() {
  const { expeditionId } = useLocalSearchParams<{ expeditionId?: string }>()

  const { dungeons, progress, markDungeonCleared, markUnlockNotified } = useDungeonProgress()
  const {
    expeditionRecords,
    getExpeditionById,
    refreshExpeditions,
    isLoading: isExpeditionLoading,
  } = useExpeditionService()
  const [hasRetriedLoad, setHasRetriedLoad] = useState(false)
  const [expeditionRecord, setExpeditionRecord] = useState<ExpeditionRecord | null>(null)

  useEffect(() => {
    if (!expeditionId) return
    void (async () => {
      const byId = await getExpeditionById(expeditionId)
      if (byId) {
        setExpeditionRecord(byId)
      } else {
        const fromList = expeditionRecords.find(record => record.id === expeditionId) ?? null
        setExpeditionRecord(fromList)
      }
    })()
  }, [expeditionId, getExpeditionById, expeditionRecords])

  useEffect(() => {
    if (!expeditionId || isExpeditionLoading || expeditionRecord || hasRetriedLoad) return
    void refreshExpeditions()
    setHasRetriedLoad(true)
  }, [expeditionId, expeditionRecord, hasRetriedLoad, isExpeditionLoading, refreshExpeditions])

  const replay = expeditionRecord?.replay ?? null

  const dungeon = useMemo(() => {
    const id = expeditionRecord?.dungeonId
    return id ? dungeons.find(d => d.id === id) : null
  }, [dungeons, expeditionRecord?.dungeonId])

  const partySnapshot = replay?.meta.partySnapshot ?? []

  // 遠征終了時のHP計算（全戦闘のallyHPDeltaを累積）
  const endHpMap = useMemo(() => {
    if (!replay || partySnapshot.length === 0) return new Map<number, number>()

    const hpValues = partySnapshot.map(g => ModStatCalculator.calculate(g).hp)

    for (const event of replay.events) {
      if ((event.type === 'battle' || event.type === 'boss') && event.combat.allyHPDelta) {
        event.combat.allyHPDelta.forEach((delta, idx) => {
          hpValues[idx] = Math.max(0, hpValues[idx] + delta)
        })
      }
    }

    const map = new Map<number, number>()
    partySnapshot.forEach((g, idx) => map.set(g.id, hpValues[idx]))
    return map
  }, [replay, partySnapshot])

  // 保存済みのレベルアップ情報を読み取り
  const levelUpMap = useMemo(() => {
    const map = new Map<number, { oldLevel: number; newLevel: number }>()
    if (!replay?.summary.memberLevelUps) return map

    for (const entry of replay.summary.memberLevelUps) {
      map.set(entry.goblinId, { oldLevel: entry.oldLevel, newLevel: entry.newLevel })
    }
    return map
  }, [replay])

  const getResultText = () => {
    if (!replay) return ''
    if (replay.summary.casualties.length === replay.meta.party.length) {
      return 'パーティは全滅しました。'
    }
    return 'パーティは帰還しました。'
  }

  const getHeaderText = () => {
    if (!replay) return ''
    const area = areasData.find(a => a.id === replay.meta.areaId)
    if (replay.summary.success && replay.summary.maxFloorReached === area?.floors) {
      return 'ダンジョンを踏破しました。'
    }
    if (replay.summary.success) {
      return '目標階層を突破しました。'
    }
    return '帰還しました。'
  }

  const isSuccess = replay?.summary.success ?? false
  const expGained = replay?.summary.xpGained ?? 0
  const goldGained = replay?.summary.goldGained ?? 0
  const treasureDrops = replay?.summary.treasureDrops ?? []

  useEffect(() => {
    if (!replay || !dungeon) return
    const cleared = replay.summary.success && replay.summary.maxFloorReached >= dungeon.floors
    if (cleared && !dungeon.cleared) {
      void markDungeonCleared(dungeon, true)
    }
  }, [dungeon, markDungeonCleared, replay])

  const area = replay ? areasData.find(a => a.id === replay.meta.areaId) : dungeon
  const unlockNext = area?.unlockNext
  const nextAreaName = unlockNext
    ? areasData.find(a => a.id === unlockNext)?.name || unlockNext
    : null
  const [showUnlockNotice, setShowUnlockNotice] = useState(false)

  useEffect(() => {
    if (!unlockNext || !isSuccess) return
    const nextProgress = progress[unlockNext]
    if (!nextProgress || !nextProgress.unlocked) return
    if (nextProgress.unlockNotified) return
    setShowUnlockNotice(true)
    void markUnlockNotified(unlockNext)
  }, [unlockNext, isSuccess, progress, markUnlockNotified])

  const handleBackToList = useCallback(() => {
    router.replace('/formation')
  }, [])

  if (expeditionId && (isExpeditionLoading || (!expeditionRecord && !hasRetriedLoad))) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!expeditionRecord || !replay) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>遠征結果が見つかりません</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.navBack}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>遠征結果</Text>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>
            {dungeon?.name || '遠征'}: {getHeaderText()}
          </Text>
          <Text style={styles.headerSubtitle}>{getResultText()}</Text>
        </View>

        <View style={styles.section}>
          {partySnapshot.map(goblin => {
            const maxHp = ModStatCalculator.calculate(goblin).hp
            const currentHp = endHpMap.get(goblin.id) ?? maxHp
            const levelUp = levelUpMap.get(goblin.id)
            const dead = currentHp === 0

            return (
              <View key={goblin.id} style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Image
                    source={getGoblinImage(goblin.avatar)}
                    style={[styles.memberAvatarImage, dead && styles.memberAvatarDead]}
                  />
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {goblin.name}
                    <Text style={styles.memberHp}> ({currentHp}/{maxHp})</Text>
                  </Text>
                  {levelUp && (
                    <Text style={styles.levelUpText}>
                      Lv{levelUp.oldLevel} → Lv{levelUp.newLevel}
                    </Text>
                  )}
                </View>
              </View>
            )
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.summaryText}>経験値 {expGained.toLocaleString()} XP</Text>
          <Text style={styles.summaryText}>{goldGained.toLocaleString()} Gold を獲得</Text>
        </View>

        {treasureDrops.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>獲得アイテム</Text>
            {treasureDrops.map((drop, idx) => (
              <Text key={idx} style={styles.summaryText}>{drop.name}</Text>
            ))}
          </View>
        )}

        {nextAreaName && isSuccess && showUnlockNotice && (
          <View style={styles.section}>
            <Text style={styles.summaryText}>次のエリア「{nextAreaName}」が解放されました</Text>
          </View>
        )}

        <View style={styles.bottomSection}>
          <TouchableOpacity style={styles.menuButton} onPress={handleBackToList}>
            <Text style={styles.menuButtonText}>メニューに戻る</Text>
          </TouchableOpacity>
        </View>
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
    fontSize: 14,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
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
    color: '#374151',
  },
  navTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  navSpacer: {
    width: 60,
  },
  headerSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarImage: {
    width: '100%',
    height: '100%',
  },
  memberAvatarDead: {
    opacity: 0.5,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  memberHp: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
  },
  levelUpText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
    marginTop: 2,
  },
  summaryText: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 6,
  },
  bottomSection: {
    padding: 16,
    backgroundColor: '#F3F4F6',
  },
  menuButton: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  menuButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
