import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { usePartyStore } from '@/presentation/stores/usePartyStore'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { SQLiteEquipmentRepository } from '@/infrastructure/repositories/SQLiteEquipmentRepository'
import { EquipmentService } from '@/core/services/EquipmentService'
import { EquipmentTitleService } from '@/core/services/EquipmentTitleService'
import { getEquipmentTemplate } from '@/shared/data/equipmentPoolLoader'
import { getGoblinImage } from '@/shared/utils/goblinImages'
import type { EquipmentInstance, EquipmentTemplate, Goblin, Party } from '@/shared/types'

function getDisplayName(eq: EquipmentInstance, template: EquipmentTemplate): string {
  if (eq.titleName) {
    return EquipmentTitleService.formatTitledName(eq.titleName, template.name)
  }
  return template.name
}

export default function PartyEquipmentListScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>()
  const { parties, isLoading: partiesLoading, getPartyById } = usePartyStore()
  const { goblins, isLoading: goblinsLoading } = useGoblinStore()
  const [party, setParty] = useState<Party | null>(null)
  const [equipmentMap, setEquipmentMap] = useState<Record<number, EquipmentInstance[]>>({})
  const [isLoadingEquipment, setIsLoadingEquipment] = useState(true)

  useEffect(() => {
    if (!partyId) {
      setParty(null)
      return
    }
    void getPartyById(parseInt(partyId, 10)).then(setParty).catch(() => setParty(null))
  }, [partyId, parties, getPartyById])

  const partyMembers = useMemo(() => {
    if (!party) return []
    return party.memberIds
      .map(id => goblins.find(goblin => goblin.id === id))
      .filter((goblin): goblin is Goblin => goblin !== undefined)
  }, [party, goblins])

  const loadEquipment = useCallback(async () => {
    if (partyMembers.length === 0) {
      setEquipmentMap({})
      setIsLoadingEquipment(false)
      return
    }

    setIsLoadingEquipment(true)
    const repository = SQLiteEquipmentRepository.getInstance()
    const entries = await Promise.all(
      partyMembers.map(async member => {
        const items = await repository.getByGoblinId(member.id)
        return [member.id, items] as const
      }),
    )

    setEquipmentMap(Object.fromEntries(entries))
    setIsLoadingEquipment(false)
  }, [partyMembers])

  useEffect(() => {
    void loadEquipment()
  }, [loadEquipment])

  useFocusEffect(
    useCallback(() => {
      void loadEquipment()
    }, [loadEquipment]),
  )

  const handleOpenGoblinEquipment = useCallback((goblinId: number) => {
    router.push({
      pathname: '/formation/equipment',
      params: { goblinId: String(goblinId) },
    })
  }, [])

  if (partiesLoading || goblinsLoading || isLoadingEquipment) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>装備情報を読み込み中...</Text>
      </View>
    )
  }

  if (!party) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>パーティが見つかりません</Text>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: '装備アイテムの一覧',
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.partyName}>{party.name}</Text>
          <Text style={styles.description}>メンバーを選ぶと、そのまま装備変更画面を開きます。</Text>
        </View>

        {partyMembers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>パーティメンバーがいません</Text>
          </View>
        ) : (
          partyMembers.map(member => {
            const equippedItems = equipmentMap[member.id] ?? []
            const maxSlots = EquipmentService.getAvailableSlots(member)

            return (
              <TouchableOpacity
                key={member.id}
                style={styles.memberCard}
                onPress={() => handleOpenGoblinEquipment(member.id)}
                activeOpacity={0.85}
              >
                <View style={styles.memberHeader}>
                  <Image source={getGoblinImage(member.avatar)} style={styles.avatar} />
                  <View style={styles.memberMeta}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={styles.memberSubText}>
                      装備 {equippedItems.length}/{maxSlots}
                    </Text>
                  </View>
                  <Text style={styles.changeLink}>変更する</Text>
                </View>

                {equippedItems.length === 0 ? (
                  <Text style={styles.emptyEquipmentText}>装備中のアイテムはありません</Text>
                ) : (
                  <View style={styles.equipmentList}>
                    {equippedItems.map(item => {
                      const template = getEquipmentTemplate(item.templateId)
                      if (!template) return null

                      return (
                        <View key={item.id} style={styles.equipmentChip}>
                          <Text style={styles.equipmentChipText} numberOfLines={1}>
                            {getDisplayName(item, template)}
                          </Text>
                        </View>
                      )
                    })}
                  </View>
                )}
              </TouchableOpacity>
            )
          })
        )}
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  partyName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    color: '#6B7280',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 6,
    marginRight: 12,
  },
  memberMeta: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  memberSubText: {
    fontSize: 12,
    color: '#6B7280',
  },
  changeLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  emptyEquipmentText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  equipmentList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  equipmentChip: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  equipmentChipText: {
    fontSize: 12,
    color: '#1D4ED8',
  },
})
