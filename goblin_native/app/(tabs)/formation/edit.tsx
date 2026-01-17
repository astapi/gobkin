import { useState, useCallback, useMemo } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Alert } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { usePartyService } from '@/presentation/hooks/usePartyService'
import { useGoblinService } from '@/presentation/hooks/useGoblinService'
import type { Goblin } from '@/shared/types'

const MAX_PARTY_SIZE = 4

export default function PartyEditScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>()
  const { parties, isLoading: partiesLoading, updateMembers, getPartyById } = usePartyService()
  const { goblins, isLoading: goblinsLoading } = useGoblinService()

  const party = useMemo(() => {
    if (!partyId) return null
    return getPartyById(parseInt(partyId, 10))
  }, [partyId, parties, getPartyById])

  const [selectedIds, setSelectedIds] = useState<number[]>(() => party?.memberIds || [])
  const [partyName, setPartyName] = useState(() => party?.name || '')

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

  const handleToggleGoblin = useCallback((goblinId: number) => {
    setSelectedIds(prev => {
      if (prev.includes(goblinId)) {
        return prev.filter(id => id !== goblinId)
      }
      if (prev.length >= MAX_PARTY_SIZE) {
        Alert.alert('上限に達しています', `パーティメンバーは最大${MAX_PARTY_SIZE}人までです`)
        return prev
      }
      return [...prev, goblinId]
    })
  }, [])

  const handleSave = useCallback(() => {
    if (!partyId) return

    if (selectedIds.length === 0) {
      Alert.alert('メンバーを選択してください', 'パーティには最低1人のメンバーが必要です')
      return
    }

    updateMembers(parseInt(partyId, 10), selectedIds)
    router.back()
  }, [partyId, selectedIds, updateMembers])

  if (partiesLoading || goblinsLoading) {
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

  const renderGoblinItem = ({ item }: { item: Goblin }) => {
    const isSelected = selectedIds.includes(item.id)
    const isAssignedElsewhere = assignedToOtherParty.has(item.id)

    return (
      <TouchableOpacity
        style={[
          styles.goblinItem,
          isSelected && styles.goblinSelected,
          isAssignedElsewhere && styles.goblinDisabled,
        ]}
        onPress={() => !isAssignedElsewhere && handleToggleGoblin(item.id)}
        disabled={isAssignedElsewhere}
      >
        <View style={styles.goblinIcon}>
          <Text style={styles.goblinIconText}>G</Text>
        </View>
        <View style={styles.goblinInfo}>
          <Text style={[styles.goblinName, isAssignedElsewhere && styles.disabledText]}>
            {item.name}
          </Text>
          <Text style={[styles.goblinLevel, isAssignedElsewhere && styles.disabledText]}>
            Lv.{item.level} | HP:{item.stats.hp} ATK:{item.stats.atk}
          </Text>
          {isAssignedElsewhere && (
            <Text style={styles.assignedText}>他のパーティに所属中</Text>
          )}
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>パーティ編集</Text>
        <TextInput
          style={styles.nameInput}
          value={partyName}
          onChangeText={setPartyName}
          placeholder="パーティ名"
        />
      </View>

      <View style={styles.selectionInfo}>
        <Text style={styles.selectionText}>
          メンバー: {selectedIds.length} / {MAX_PARTY_SIZE}
        </Text>
      </View>

      {goblins.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>利用可能なゴブリンがいません</Text>
        </View>
      ) : (
        <FlatList
          data={goblins}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderGoblinItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>キャンセル</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>保存</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  header: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  nameInput: {
    fontSize: 16,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectionInfo: {
    padding: 16,
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  selectionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  listContent: {
    padding: 16,
  },
  separator: {
    height: 8,
  },
  goblinItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  goblinSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  goblinDisabled: {
    opacity: 0.5,
    backgroundColor: '#F3F4F6',
  },
  goblinIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  goblinIconText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  goblinInfo: {
    flex: 1,
  },
  goblinName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  goblinLevel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  disabledText: {
    color: '#9CA3AF',
  },
  assignedText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  checkmark: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
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
  saveButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
