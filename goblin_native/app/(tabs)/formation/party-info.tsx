import { useEffect, useMemo, useState, useCallback } from 'react'
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { usePartyStore } from '@/presentation/stores/usePartyStore'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { getGoblinDisplayImage } from '@/shared/utils/goblinImages'
import { getExpForNextLevel } from '@/core/services/ExperienceSystem'
import { getRowDamageMultiplierFromSkills, getUniqueSkillsById } from '@/shared/data/characterSkills'
import { SQLiteEquipmentRepository } from '@/infrastructure/repositories/SQLiteEquipmentRepository'
import { EquipmentService } from '@/core/services/EquipmentService'
import type { CharacterSkill, Goblin, Party } from '@/shared/types'

function getExpRateText(): string {
  return '1.00倍'
}

function getAttackTypeLabel(skills: CharacterSkill[]): string {
  const uniqueSkills = getUniqueSkillsById(skills)
  const hasMelee = uniqueSkills.some((skill) => skill.enablesMeleeRowDamagePenalty)
  const hasRanged = uniqueSkills.some((skill) => skill.enablesRangedRowDamagePenalty)

  if (hasMelee && hasRanged) return '遠距離武器'
  if (hasMelee) return '近接武器'
  if (hasRanged) return '遠距離武器'
  return 'スキルなし'
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export default function PartyInfoScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>()
  const { parties, isLoading: partiesLoading, getPartyById } = usePartyStore()
  const goblins = useGoblinStore((state) => state.goblins)
  const goblinsLoading = useGoblinStore((state) => state.isLoading)
  const [party, setParty] = useState<Party | null>(null)
  const [memberSkillsById, setMemberSkillsById] = useState<Record<number, CharacterSkill[]>>({})

  useEffect(() => {
    if (!partyId) {
      setParty(null)
      return
    }

    void getPartyById(parseInt(partyId, 10))
      .then(setParty)
      .catch(() => setParty(null))
  }, [partyId, parties, getPartyById])

  const partyMembers = useMemo(() => {
    if (!party) return []

    return party.memberIds
      .map((id) => goblins.find((goblin) => goblin.id === id))
      .filter((goblin): goblin is Goblin => goblin !== undefined)
  }, [goblins, party])

  useEffect(() => {
    let cancelled = false

    const loadMemberSkills = async (): Promise<void> => {
      if (partyMembers.length === 0) {
        setMemberSkillsById({})
        return
      }

      const repository = SQLiteEquipmentRepository.getInstance()
      const entries = await Promise.all(
        partyMembers.map(async (goblin) => {
          const equippedItems = await repository.getByGoblinId(goblin.id)
          const equipmentSkills = EquipmentService.collectGrantedSkills(equippedItems)
          return [goblin.id, [...goblin.skills, ...equipmentSkills]] as const
        }),
      )

      if (cancelled) return

      setMemberSkillsById(
        entries.reduce<Record<number, CharacterSkill[]>>((acc, [goblinId, skills]) => {
          acc[goblinId] = [...skills]
          return acc
        }, {}),
      )
    }

    void loadMemberSkills()

    return () => {
      cancelled = true
    }
  }, [partyMembers])

  const handleBack = useCallback(() => {
    router.back()
  }, [])

  if (partiesLoading || goblinsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    )
  }

  if (!party) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>パーティが見つかりません</Text>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>戻る</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'PTの情報',
          headerLeft: () => (
            <TouchableOpacity onPress={handleBack}>
              <Text style={styles.headerButton}>← 戻る</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.partyName}>{party.name}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lv / 次のLvに必要な経験値</Text>
          {partyMembers.map((goblin) => {
            const expForNext = getExpForNextLevel(goblin.level)
            const remainingExp = Math.max(0, expForNext - goblin.experience)

            return (
              <View key={goblin.id} style={styles.memberRow}>
                <Image source={getGoblinDisplayImage(goblin)} style={styles.avatar} />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{goblin.name}</Text>
                  <Text style={styles.memberSubText}>
                    {`Lv${goblin.level} 次のLvまで ${remainingExp} (${getExpRateText()})`}
                  </Text>
                </View>
              </View>
            )
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>隊列による攻撃能力補正</Text>
          {partyMembers.map((goblin, index) => {
            const memberSkills = memberSkillsById[goblin.id] ?? goblin.skills
            const multiplier = getRowDamageMultiplierFromSkills(memberSkills, index)
            const attackTypeLabel = getAttackTypeLabel(memberSkills)

            return (
              <View key={`row-${goblin.id}`} style={styles.memberRow}>
                <Image source={getGoblinDisplayImage(goblin)} style={styles.avatar} />
                <View style={styles.attackInfoRow}>
                  <Text style={styles.memberName}>{goblin.name}</Text>
                  <Text style={styles.attackModifierText}>
                    {`補正: ${formatPercent(multiplier)} (${attackTypeLabel})`}
                  </Text>
                </View>
              </View>
            )
          })}
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
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 88,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 16,
    color: '#111827',
  },
  backButton: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  headerButton: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: '700',
  },
  partyName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    paddingHorizontal: 4,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  memberInfo: {
    flex: 1,
    gap: 4,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  memberSubText: {
    fontSize: 13,
    color: '#6B7280',
  },
  attackInfoRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  attackModifierText: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: 13,
    color: '#374151',
  },
})
