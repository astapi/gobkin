import { useState, useCallback, useMemo, useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image, ScrollView } from 'react-native'
import { router, useLocalSearchParams, Stack } from 'expo-router'
import { usePartyStore } from '@/presentation/stores/usePartyStore'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { getGoblinDisplayImage } from '@/shared/utils/goblinImages'
import { GoblinCard } from '@/presentation/components/GoblinCard'
import type { Goblin, Party } from '@/shared/types'

const MAX_PARTY_SIZE = 6

interface SlotProps {
  label: string
  goblin?: Goblin
  isEmpty: boolean
  isSelected: boolean
  onPress: () => void
  onRemove?: () => void
}

function PartySlot({ label, goblin, isEmpty, isSelected, onPress, onRemove }: SlotProps) {
  if (isEmpty || !goblin) {
    return (
      <TouchableOpacity
        style={[styles.slotContainer, isSelected && styles.slotSelected]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.slotLabelBadge}>
          <Text style={styles.slotLabelText}>{label}</Text>
        </View>
        <View style={styles.emptySlot}>
          <Text style={styles.emptySlotPlus}>+</Text>
          <Text style={styles.emptySlotText}>空き</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity
      style={[styles.slotContainer, styles.filledSlot, isSelected && styles.slotSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.slotLabelBadge}>
        <Text style={styles.slotLabelText}>{label}</Text>
      </View>
      <Image source={getGoblinDisplayImage(goblin)} style={styles.slotAvatar} />
      <Text style={styles.slotName} numberOfLines={1}>{goblin.name}</Text>
      <Text style={styles.slotLevel}>Lv.{goblin.level}</Text>
      {onRemove && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={(e) => {
            e.stopPropagation?.()
            onRemove()
          }}
        >
          <Text style={styles.removeButtonText}>x</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}

function getSlotLabel(index: number): string {
  return `${index + 1}`
}

export default function PartyEditScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>()
  const parties = usePartyStore((state) => state.parties)
  const partiesLoading = usePartyStore((state) => state.isLoading)
  const updateMembers = usePartyStore((state) => state.updateMembers)
  const getPartyById = usePartyStore((state) => state.getPartyById)
  const refreshParties = usePartyStore((state) => state.refresh)
  const goblins = useGoblinStore((state) => state.goblins)
  const goblinsLoading = useGoblinStore((state) => state.isLoading)
  const [retryCount, setRetryCount] = useState(0)
  const [party, setParty] = useState<Party | null>(null)

  useEffect(() => {
    if (!partyId) {
      setParty(null)
      return
    }
    void getPartyById(parseInt(partyId, 10)).then(p => setParty(p)).catch(() => setParty(null))
  }, [partyId, parties, getPartyById])

  // パーティが見つからない場合にリトライ
  useEffect(() => {
    if (!party && !partiesLoading && partyId && retryCount < 5) {
      const timer = setTimeout(() => {
        void refreshParties()
        setRetryCount(prev => prev + 1)
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [party, partiesLoading, partyId, retryCount, refreshParties])

  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([])
  const [memberIdsInitialized, setMemberIdsInitialized] = useState(false)

  // パーティが取得されたらメンバーIDsを初期化
  useEffect(() => {
    if (party && !memberIdsInitialized) {
      setSelectedMemberIds(party.memberIds)
      setMemberIdsInitialized(true)
    }
  }, [party, memberIdsInitialized])
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null)

  // 他のパーティに所属しているゴブリンIDを取得
  const assignedToOtherParty = useMemo(() => {
    const ids = new Set<number>()
    parties.forEach(p => {
      if (p.id !== parseInt(partyId || '0', 10)) {
        p.memberIds.forEach(id => ids.add(id))
      }
    })
    return ids
  }, [parties, partyId])

  // 6スロット分の配列を作成
  const slots = useMemo(() => {
    const result: (Goblin | undefined)[] = []
    for (let i = 0; i < MAX_PARTY_SIZE; i++) {
      const memberId = selectedMemberIds[i]
      const goblin = memberId !== undefined ? goblins.find(g => g.id === memberId) : undefined
      result.push(goblin)
    }
    return result
  }, [selectedMemberIds, goblins])

  // 利用可能なゴブリン（他パーティに所属していないもの）
  const availableGoblins = useMemo(() => {
    return goblins.filter(g => !assignedToOtherParty.has(g.id))
  }, [goblins, assignedToOtherParty])

  const handleSlotPress = useCallback((index: number) => {
    if (selectedSlotIndex !== null && selectedSlotIndex !== index) {
      const sourceMemberId = selectedMemberIds[selectedSlotIndex]
      const targetMemberId = selectedMemberIds[index]

      if (sourceMemberId !== undefined && targetMemberId !== undefined) {
        setSelectedMemberIds(prev => {
          const newIds = [...prev]
          const temp = newIds[selectedSlotIndex]
          newIds[selectedSlotIndex] = newIds[index]
          newIds[index] = temp
          return newIds
        })
        setSelectedSlotIndex(null)
        return
      }
    }

    setSelectedSlotIndex(prev => prev === index ? null : index)
  }, [selectedMemberIds, selectedSlotIndex])

  const handleRemoveMember = useCallback((index: number) => {
    setSelectedMemberIds(prev => {
      const newIds = [...prev]
      newIds.splice(index, 1)
      return newIds
    })
    if (selectedSlotIndex === index) {
      setSelectedSlotIndex(null)
    }
  }, [selectedSlotIndex])

  const handleGoblinSelect = useCallback((goblin: Goblin) => {
    // 既にこのパーティに所属している場合は削除
    if (selectedMemberIds.includes(goblin.id)) {
      setSelectedMemberIds(prev => prev.filter(id => id !== goblin.id))
      return
    }

    // 他パーティに所属している場合は選択不可
    if (assignedToOtherParty.has(goblin.id)) {
      return
    }

    // スロットが選択されている場合はそのスロットに追加
    if (selectedSlotIndex !== null) {
      setSelectedMemberIds(prev => {
        const newIds = [...prev]
        // 既存メンバーの場合は入れ替え
        if (selectedSlotIndex < newIds.length) {
          newIds[selectedSlotIndex] = goblin.id
        } else {
          // 空きスロットの場合は追加
          newIds.push(goblin.id)
        }
        return newIds
      })
      setSelectedSlotIndex(null)
    } else {
      // スロット未選択の場合は末尾に追加（上限チェック）
      if (selectedMemberIds.length >= MAX_PARTY_SIZE) {
        return
      }
      setSelectedMemberIds(prev => [...prev, goblin.id])
    }
  }, [selectedMemberIds, selectedSlotIndex, assignedToOtherParty])

  const handleSave = useCallback(async () => {
    if (!partyId) return
    await updateMembers(parseInt(partyId, 10), selectedMemberIds)
    router.back()
  }, [partyId, selectedMemberIds, updateMembers])

  // ローディング中またはパーティ取得のリトライ中、またはメンバーID初期化待ち
  if (partiesLoading || goblinsLoading || (!party && retryCount < 5) || (party && !memberIdsInitialized)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
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
    <>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.headerButton}>キャンセル</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={handleSave}>
              <Text style={[styles.headerButton, styles.headerButtonPrimary]}>保存</Text>
            </TouchableOpacity>
          ),
          title: 'メンバー編集',
        }}
      />
      <ScrollView style={styles.container}>
        {/* パーティメンバースロット */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>パーティメンバー（最大{MAX_PARTY_SIZE}人）</Text>
          <Text style={styles.sectionDescription}>
            スロットを選んでから別の編成済みスロットをタップすると、隊列を入れ替えられます。
          </Text>
          <View style={styles.slotsGrid}>
            {slots.map((goblin, index) => (
              <PartySlot
                key={index}
                label={getSlotLabel(index)}
                goblin={goblin}
                isEmpty={!goblin}
                isSelected={selectedSlotIndex === index}
                onPress={() => handleSlotPress(index)}
                onRemove={goblin ? () => handleRemoveMember(index) : undefined}
              />
            ))}
          </View>
        </View>

        {/* 利用可能なゴブリン */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>利用可能なゴブリン</Text>
          {availableGoblins.length === 0 ? (
            <View style={styles.emptyGoblins}>
              <Text style={styles.emptyGoblinsText}>利用可能なゴブリンがいません</Text>
            </View>
          ) : (
            <View style={styles.goblinList}>
              {availableGoblins.map(goblin => (
                <GoblinCard
                  key={goblin.id}
                  goblin={goblin}
                  onPress={() => handleGoblinSelect(goblin)}
                  isAssigned={selectedMemberIds.includes(goblin.id)}
                  isAssignedElsewhere={assignedToOtherParty.has(goblin.id)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </>
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
    backgroundColor: '#F3F4F6',
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
    backgroundColor: '#F3F4F6',
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
  headerButton: {
    fontSize: 16,
    color: '#374151',
    paddingHorizontal: 8,
  },
  headerButtonPrimary: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 18,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  slotContainer: {
    width: '30%',
    aspectRatio: 1.0,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    position: 'relative',
  },
  filledSlot: {
    borderStyle: 'solid',
    borderColor: '#E5E7EB',
  },
  slotSelected: {
    borderColor: '#3B82F6',
    borderStyle: 'solid',
    backgroundColor: '#EFF6FF',
  },
  emptySlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotPlus: {
    fontSize: 32,
    color: '#9CA3AF',
    lineHeight: 36,
  },
  emptySlotText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  slotLabelBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
  },
  slotLabelText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4B5563',
  },
  slotAvatar: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginBottom: 4,
  },
  slotName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
  slotLevel: {
    fontSize: 10,
    color: '#6B7280',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  emptyGoblins: {
    padding: 32,
    alignItems: 'center',
  },
  emptyGoblinsText: {
    fontSize: 14,
    color: '#6B7280',
  },
  goblinList: {
    gap: 8,
  },
})
