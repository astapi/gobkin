import { useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { router } from 'expo-router'
import { usePartyService } from '@/presentation/hooks/usePartyService'
import { useGoblinService } from '@/presentation/hooks/useGoblinService'
import type { Party, PartyStatus } from '@/shared/types'

interface PartyCardProps {
  party: Party
  memberCount: number
  onPress: () => void
  onEdit: () => void
}

function PartyCard({ party, memberCount, onPress, onEdit }: PartyCardProps) {
  const statusColors: Record<PartyStatus, string> = {
    idle: '#10B981',
    expedition: '#3B82F6',
  }

  const statusLabels: Record<PartyStatus, string> = {
    idle: '待機中',
    expedition: '遠征中',
  }

  const status = party.status ?? 'idle'

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.partyName}>{party.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[status] }]}>
          <Text style={styles.statusText}>{statusLabels[status]}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.memberCount}>メンバー: {memberCount}人</Text>
        {party.dungeonId && (
          <Text style={styles.dungeonInfo}>ダンジョン: {party.dungeonId}</Text>
        )}
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={(e) => {
            e.stopPropagation?.()
            onEdit()
          }}
        >
          <Text style={styles.editButtonText}>編集</Text>
        </TouchableOpacity>
        {status === 'idle' && (
          <TouchableOpacity style={styles.expeditionButton} onPress={onPress}>
            <Text style={styles.expeditionButtonText}>遠征準備</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  )
}

export default function FormationScreen() {
  const { parties, isLoading, createParty } = usePartyService()
  const { goblins, isLoading: goblinsLoading } = useGoblinService()

  const handlePartyPress = useCallback((party: Party) => {
    const status = party.status ?? 'idle'
    if (status === 'expedition') {
      // 遠征中のパーティはプレイバック画面へ
      router.push({
        pathname: '/formation/playback',
        params: { partyId: party.id.toString() },
      })
    } else {
      // 待機中のパーティは遠征準備画面へ
      router.push({
        pathname: '/formation/preparation',
        params: { partyId: party.id.toString() },
      })
    }
  }, [])

  const handleEditPress = useCallback((party: Party) => {
    router.push({
      pathname: '/formation/edit',
      params: { partyId: party.id.toString() },
    })
  }, [])

  const handleCreateParty = useCallback(() => {
    if (goblins.length === 0) {
      Alert.alert('ゴブリンがいません', 'パーティを作成するにはゴブリンが必要です')
      return
    }

    // 次のパーティIDを推定（createPartyが内部で計算するが、遷移用に必要）
    const maxId = parties.reduce((max, p) => Math.max(max, p.id), 0)
    const expectedNewId = maxId + 1

    const created = createParty({
      name: `パーティ ${expectedNewId}`,
      memberIds: [],
    })

    // 作成後に編集画面へ遷移
    router.push({
      pathname: '/formation/edit',
      params: { partyId: created.id.toString() },
    })
  }, [parties, goblins.length, createParty])

  if (isLoading || goblinsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={parties}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <PartyCard
            party={item}
            memberCount={item.memberIds.length}
            onPress={() => handlePartyPress(item)}
            onEdit={() => handleEditPress(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={() => (
          <TouchableOpacity style={styles.createButton} onPress={handleCreateParty}>
            <Text style={styles.createButtonText}>+ 新しいパーティを作成</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>パーティがありません</Text>
            <Text style={styles.emptyDescription}>
              上のボタンから新しいパーティを作成しましょう
            </Text>
          </View>
        )}
      />
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
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  separator: {
    height: 12,
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  partyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  memberCount: {
    fontSize: 14,
    color: '#6B7280',
  },
  dungeonInfo: {
    fontSize: 14,
    color: '#6B7280',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  expeditionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
  },
  expeditionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  createButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
