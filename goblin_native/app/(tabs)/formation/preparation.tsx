import { useState, useCallback, useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { usePartyService } from '@/presentation/hooks/usePartyService'
import { useGoblinService } from '@/presentation/hooks/useGoblinService'
import { useDungeonProgress } from '@/presentation/hooks/useDungeonProgress'
import type { ExpeditionRequest, Goblin, Dungeon } from '@/shared/types'

type ReturnPolicy = ExpeditionRequest['returnPolicy']

const RETURN_POLICIES: { value: ReturnPolicy; label: string; description: string }[] = [
  { value: 'never', label: '最後まで探索', description: '目標階に到達するまで探索を続けます' },
  { value: 'until_floor2', label: '2階で帰還', description: '2階に到達したら帰還します' },
  { value: 'until_floor3', label: '3階で帰還', description: '3階に到達したら帰還します' },
  { value: 'if_any_ko', label: '誰かが倒れたら', description: 'パーティの誰かが倒れたら帰還します' },
  { value: 'last_one', label: '最後の1人まで', description: '最後の1人になるまで探索を続けます' },
]

export default function ExpeditionPreparationScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>()
  const { parties, isLoading: partiesLoading, getPartyById, setDungeon, setReturnPolicy } = usePartyService()
  const { goblins, isLoading: goblinsLoading } = useGoblinService()
  const { dungeons, isLoading: dungeonsLoading } = useDungeonProgress()

  const party = useMemo(() => {
    if (!partyId) return null
    return getPartyById(parseInt(partyId, 10))
  }, [partyId, parties, getPartyById])

  const [selectedDungeonId, setSelectedDungeonId] = useState<string | undefined>(party?.dungeonId)
  const [selectedReturnPolicy, setSelectedReturnPolicy] = useState<ReturnPolicy>(party?.returnPolicy ?? 'never')

  const partyMembers = useMemo(() => {
    if (!party) return []
    return party.memberIds
      .map(id => goblins.find(g => g.id === id))
      .filter((g): g is Goblin => g !== undefined)
  }, [party, goblins])

  const unlockedDungeons = useMemo(() => {
    return dungeons.filter(d => d.unlocked)
  }, [dungeons])

  const selectedDungeon = useMemo(() => {
    return dungeons.find(d => d.id === selectedDungeonId)
  }, [dungeons, selectedDungeonId])

  const handleEditParty = useCallback(() => {
    router.push({
      pathname: '/formation/edit',
      params: { partyId },
    })
  }, [partyId])

  const handleSelectDungeon = useCallback((dungeon: Dungeon) => {
    setSelectedDungeonId(dungeon.id)
    if (partyId) {
      setDungeon(parseInt(partyId, 10), dungeon.id)
    }
  }, [partyId, setDungeon])

  const handleSelectReturnPolicy = useCallback((policy: ReturnPolicy) => {
    setSelectedReturnPolicy(policy)
    if (partyId) {
      setReturnPolicy(parseInt(partyId, 10), policy)
    }
  }, [partyId, setReturnPolicy])

  const handleStartExpedition = useCallback(() => {
    if (!selectedDungeonId) {
      Alert.alert('ダンジョンを選択してください', '遠征先のダンジョンを選択する必要があります')
      return
    }

    if (partyMembers.length === 0) {
      Alert.alert('メンバーがいません', 'パーティにメンバーを追加してください')
      return
    }

    // TODO: 遠征を開始し、プレイバック画面へ遷移
    router.push({
      pathname: '/formation/playback',
      params: {
        partyId,
        dungeonId: selectedDungeonId,
        returnPolicy: selectedReturnPolicy,
      },
    })
  }, [partyId, selectedDungeonId, selectedReturnPolicy, partyMembers.length])

  if (partiesLoading || goblinsLoading || dungeonsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    )
  }

  if (!party) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>パーティが見つかりません</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>戻る</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      {/* パーティメンバー */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{party.name}</Text>
        <View style={styles.card}>
          {partyMembers.length === 0 ? (
            <Text style={styles.emptyText}>メンバーがいません</Text>
          ) : (
            <View style={styles.membersGrid}>
              {partyMembers.map(member => (
                <View key={member.id} style={styles.memberItem}>
                  <View style={styles.memberIcon}>
                    <Text style={styles.memberIconText}>G</Text>
                  </View>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberLevel}>Lv.{member.level}</Text>
                </View>
              ))}
            </View>
          )}
          <TouchableOpacity style={styles.editButton} onPress={handleEditParty}>
            <Text style={styles.editButtonText}>メンバー編集</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ダンジョン選択 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ダンジョン選択</Text>
        <View style={styles.card}>
          {unlockedDungeons.length === 0 ? (
            <Text style={styles.emptyText}>解放済みのダンジョンがありません</Text>
          ) : (
            unlockedDungeons.map(dungeon => (
              <TouchableOpacity
                key={dungeon.id}
                style={[
                  styles.dungeonOption,
                  selectedDungeonId === dungeon.id && styles.dungeonSelected,
                ]}
                onPress={() => handleSelectDungeon(dungeon)}
              >
                <View style={styles.dungeonHeader}>
                  <Text style={styles.dungeonName}>{dungeon.name}</Text>
                  {dungeon.cleared && (
                    <View style={styles.clearedBadge}>
                      <Text style={styles.clearedText}>クリア済</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.dungeonInfo}>
                  階層: {dungeon.floors} | 難易度: {dungeon.difficulty || '?'}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      {/* 帰還ポリシー */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>帰還ポリシー</Text>
        <View style={styles.card}>
          {RETURN_POLICIES.map(policy => (
            <TouchableOpacity
              key={policy.value}
              style={[
                styles.policyOption,
                selectedReturnPolicy === policy.value && styles.policySelected,
              ]}
              onPress={() => handleSelectReturnPolicy(policy.value)}
            >
              <Text style={styles.policyName}>{policy.label}</Text>
              <Text style={styles.policyDescription}>{policy.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 遠征開始ボタン */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>戻る</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.startButton, (!selectedDungeonId || partyMembers.length === 0) && styles.startButtonDisabled]}
          onPress={handleStartExpedition}
          disabled={!selectedDungeonId || partyMembers.length === 0}
        >
          <Text style={styles.startButtonText}>遠征開始</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  errorText: {
    fontSize: 18,
    color: '#EF4444',
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  membersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 12,
  },
  memberItem: {
    alignItems: 'center',
    width: 70,
  },
  memberIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  memberIconText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  memberName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  memberLevel: {
    fontSize: 10,
    color: '#6B7280',
  },
  editButton: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  dungeonOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F3F4F6',
  },
  dungeonSelected: {
    backgroundColor: '#DBEAFE',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  dungeonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dungeonName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  clearedBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  clearedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dungeonInfo: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  policyOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F3F4F6',
  },
  policySelected: {
    backgroundColor: '#DBEAFE',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  policyName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  policyDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  startButton: {
    flex: 2,
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
