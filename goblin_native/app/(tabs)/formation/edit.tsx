import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'

const availableGoblins = [
  { id: 1, name: 'Goburo', level: 5, selected: true },
  { id: 2, name: 'Gobichi', level: 3, selected: true },
  { id: 3, name: 'Gobimi', level: 7, selected: false },
]

export default function PartyEditScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>()

  const handleSave = () => {
    router.back()
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Party #{partyId}</Text>
      <Text style={styles.subtitle}>Select members for your party</Text>

      <FlatList
        data={availableGoblins}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.goblinItem, item.selected && styles.goblinSelected]}
          >
            <View style={styles.goblinInfo}>
              <Text style={styles.goblinName}>{item.name}</Text>
              <Text style={styles.goblinLevel}>Lv.{item.level}</Text>
            </View>
            <View style={[styles.checkbox, item.selected && styles.checkboxSelected]}>
              {item.selected && <Text style={styles.checkmark}>V</Text>}
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save</Text>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    padding: 16,
    paddingBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    paddingHorizontal: 16,
    paddingBottom: 16,
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
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  goblinSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
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
    marginTop: 4,
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
