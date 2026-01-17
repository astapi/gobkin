import { useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import type { Party, PartyStatus } from '@/shared/types'

// Sample data for demonstration
const sampleParties: Party[] = [
  {
    id: 1,
    name: 'Alpha Squad',
    memberIds: [1, 2],
    status: 'idle' as PartyStatus,
    dungeonId: '1',
    targetFloor: null,
    returnPolicy: 'never',
  },
  {
    id: 2,
    name: 'Bravo Team',
    memberIds: [3],
    status: 'idle' as PartyStatus,
    dungeonId: '2',
    targetFloor: 3,
    returnPolicy: 'if_any_ko',
  },
]

interface PartyCardProps {
  party: Party
  onPress: () => void
}

function PartyCard({ party, onPress }: PartyCardProps) {
  const statusColors: Record<PartyStatus, string> = {
    idle: '#10B981',
    expedition: '#3B82F6',
  }

  const status = party.status ?? 'idle'

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.partyName}>{party.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[status] }]}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.memberCount}>Members: {party.memberIds.length}</Text>
        {party.dungeonId && (
          <Text style={styles.dungeonInfo}>Dungeon: {party.dungeonId}</Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

export default function FormationScreen() {
  const [parties] = useState<Party[]>(sampleParties)

  const handlePartyPress = (party: Party) => {
    router.push({
      pathname: '/formation/preparation',
      params: { partyId: party.id.toString() },
    })
  }

  const handleCreateParty = () => {
    // TODO: Implement party creation
    console.log('Create new party')
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={parties}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <PartyCard party={item} onPress={() => handlePartyPress(item)} />
        )}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={() => (
          <TouchableOpacity style={styles.createButton} onPress={handleCreateParty}>
            <Text style={styles.createButtonText}>+ Create New Party</Text>
          </TouchableOpacity>
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
    textTransform: 'uppercase',
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  memberCount: {
    fontSize: 14,
    color: '#6B7280',
  },
  dungeonInfo: {
    fontSize: 14,
    color: '#6B7280',
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
