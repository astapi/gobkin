import { useState, useCallback, useMemo, useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image, ScrollView } from 'react-native'
import { router, useLocalSearchParams, Stack } from 'expo-router'
import { usePartyService } from '@/presentation/hooks/usePartyService'
import { useGoblinService } from '@/presentation/hooks/useGoblinService'
import { getGoblinImage } from '@/shared/utils/goblinImages'
import { getFactorImage } from '@/shared/utils/factorImages'
import type { Goblin } from '@/shared/types'

const MAX_PARTY_SIZE = 6

interface SlotProps {
  goblin?: Goblin
  isEmpty: boolean
  isSelected: boolean
  onPress: () => void
  onRemove?: () => void
}

function PartySlot({ goblin, isEmpty, isSelected, onPress, onRemove }: SlotProps) {
  if (isEmpty || !goblin) {
    return (
      <TouchableOpacity
        style={[styles.slotContainer, isSelected && styles.slotSelected]}
        onPress={onPress}
        activeOpacity={0.7}
      >
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
      <Image source={getGoblinImage(goblin.avatar)} style={styles.slotAvatar} />
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

interface GoblinListItemProps {
  goblin: Goblin
  isAssigned: boolean
  isAssignedElsewhere: boolean
  onPress: () => void
}

function GoblinListItem({ goblin, isAssigned, isAssignedElsewhere }: GoblinListItemProps) {
  const FactorIcon1 = goblin.factors?.[0] ? getFactorImage(goblin.factors[0]) : null
  const FactorIcon2 = goblin.factors?.[1] ? getFactorImage(goblin.factors[1]) : null

  return (
    <View style={[
      styles.goblinItem,
      isAssigned && styles.goblinItemAssigned,
      isAssignedElsewhere && styles.goblinItemDisabled,
    ]}>
      <Image source={getGoblinImage(goblin.avatar)} style={styles.goblinAvatar} />
      <View style={styles.goblinInfo}>
        <Text style={[styles.goblinName, isAssignedElsewhere && styles.goblinNameDisabled]}>
          {goblin.name}
        </Text>
        <Text style={[styles.goblinRace, isAssignedElsewhere && styles.goblinRaceDisabled]}>
          {goblin.race}
        </Text>
        <Text style={[styles.goblinLevel, isAssignedElsewhere && styles.goblinLevelDisabled]}>
          Lv.{goblin.level}
        </Text>
        <View style={styles.factorIcons}>
          {FactorIcon1 && <FactorIcon1 width={20} height={20} />}
          {FactorIcon2 && <FactorIcon2 width={20} height={20} />}
        </View>
      </View>
      {isAssignedElsewhere && (
        <Text style={styles.assignedBadge}>他PT</Text>
      )}
      {isAssigned && !isAssignedElsewhere && (
        <View style={styles.checkmark}>
          <Text style={styles.checkmarkText}>v</Text>
        </View>
      )}
    </View>
  )
}

export default function PartyEditScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>()
  const { parties, isLoading: partiesLoading, updateMembers, getPartyById, refreshParties } = usePartyService()
  const { goblins, isLoading: goblinsLoading } = useGoblinService()
  const [retryCount, setRetryCount] = useState(0)

  const party = useMemo(() => {
    if (!partyId) return null
    try {
      return getPartyById(parseInt(partyId, 10))
    } catch {
      return null
    }
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
    setSelectedSlotIndex(prev => prev === index ? null : index)
  }, [])

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

  const handleSave = useCallback(() => {
    if (!partyId) return
    updateMembers(parseInt(partyId, 10), selectedMemberIds)
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
          <View style={styles.slotsGrid}>
            {slots.map((goblin, index) => (
              <PartySlot
                key={index}
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
                <TouchableOpacity
                  key={goblin.id}
                  onPress={() => handleGoblinSelect(goblin)}
                  activeOpacity={assignedToOtherParty.has(goblin.id) ? 1 : 0.7}
                >
                  <GoblinListItem
                    goblin={goblin}
                    isAssigned={selectedMemberIds.includes(goblin.id)}
                    isAssignedElsewhere={assignedToOtherParty.has(goblin.id)}
                    onPress={() => handleGoblinSelect(goblin)}
                  />
                </TouchableOpacity>
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
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  slotContainer: {
    width: '30%',
    aspectRatio: 0.85,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
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
  slotAvatar: {
    width: 48,
    height: 48,
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
  goblinItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  goblinItemAssigned: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  goblinItemDisabled: {
    backgroundColor: '#F9FAFB',
    opacity: 0.6,
  },
  goblinAvatar: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 12,
  },
  goblinInfo: {
    flex: 1,
  },
  goblinName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  goblinNameDisabled: {
    color: '#9CA3AF',
  },
  goblinRace: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  goblinRaceDisabled: {
    color: '#9CA3AF',
  },
  goblinLevel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  goblinLevelDisabled: {
    color: '#9CA3AF',
  },
  factorIcons: {
    flexDirection: 'row',
    gap: 4,
  },
  assignedBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
})
