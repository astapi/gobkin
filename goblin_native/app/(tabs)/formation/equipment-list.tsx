import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { usePartyStore } from '@/presentation/stores/usePartyStore'
import { BOTTOM_INFO_SPACING } from '@/shared/constants/layout'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { equipmentRepository } from '@/presentation/di/repositories'
import { EquipmentService } from '@/core/services/EquipmentService'
import { getEquipmentTemplate } from '@/shared/data/equipmentPoolLoader'
import { applySkillBonusesToEquipmentBonuses } from '@/shared/data/characterSkills'
import { getGoblinDisplayImage } from '@/shared/utils/goblinImages'
import type { CharacterSkill, EquipmentInstance, Goblin, Party } from '@/shared/types'
import { getEquipmentDisplayName, getStatLabel } from '@/shared/i18n/entityLocalization'

type DisplayBonus = {
  stat: string
  value: number
}

function formatBonus(stat: string, value: number): string {
  const displayValue = Number.isInteger(value) ? value : Math.trunc(value * 10) / 10
  const isPercent = stat.includes('percent') || stat === 'damage_reduction'
  return `${displayValue > 0 ? '+' : ''}${displayValue}${isPercent ? '%' : ''}`
}

function isDisplayValueZero(value: number): boolean {
  const displayValue = Number.isInteger(value) ? value : Math.trunc(value * 10) / 10
  return displayValue === 0
}

function getDisplayBonuses(
  eq: EquipmentInstance,
  skills: CharacterSkill[],
  penaltyMultiplier: number,
): DisplayBonus[] {
  const originalBonuses = EquipmentService.calculateEquipmentBonuses([eq])
  const penalizedBonuses = originalBonuses.map((bonus) => ({
    ...bonus,
    value: Number((bonus.value * penaltyMultiplier).toFixed(4)),
  }))
  const adjustedBonuses = applySkillBonusesToEquipmentBonuses(skills, penalizedBonuses)
  return adjustedBonuses
    .map((bonus) => ({ stat: bonus.stat, value: bonus.value }))
    .filter((bonus) => !isDisplayValueZero(bonus.value))
}

function getInlineBonusLabel(bonus: DisplayBonus): string {
  return `${getStatLabel(bonus.stat)}${formatBonus(bonus.stat, bonus.value)}`
}

export default function PartyEquipmentListScreen() {
  const { t } = useTranslation()
  const { partyId } = useLocalSearchParams<{ partyId: string }>()
  const parties = usePartyStore((state) => state.parties)
  const partiesLoading = usePartyStore((state) => state.isLoading)
  const getPartyById = usePartyStore((state) => state.getPartyById)
  const goblins = useGoblinStore((state) => state.goblins)
  const goblinsLoading = useGoblinStore((state) => state.isLoading)
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
    const repository = equipmentRepository
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
        <Text style={styles.loadingText}>{t('ui.equipmentList.loading')}</Text>
      </View>
    )
  }

  if (!party) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t('ui.equipmentList.partyNotFound')}</Text>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('ui.equipmentList.title'),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.partyName}>{party.name}</Text>
          <Text style={styles.description}>{t('ui.equipmentList.description')}</Text>
        </View>

        {partyMembers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('ui.equipmentList.noMembers')}</Text>
          </View>
        ) : (
          partyMembers.map(member => {
            const equippedItems = equipmentMap[member.id] ?? []
            const maxSlots = EquipmentService.getAvailableSlots(member)
            const penaltyMultipliers = EquipmentService.getEquipmentPenaltyMultipliers(equippedItems)
            const characterSkills: CharacterSkill[] = [
              ...member.skills,
              ...EquipmentService.collectGrantedSkills(equippedItems),
            ]

            return (
              <TouchableOpacity
                key={member.id}
                style={styles.memberCard}
                onPress={() => handleOpenGoblinEquipment(member.id)}
                activeOpacity={0.85}
              >
                <View style={styles.memberHeader}>
                  <Image source={getGoblinDisplayImage(member)} style={styles.avatar} />
                  <View style={styles.memberMeta}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={styles.memberSubText}>
                      {t('ui.equipmentList.equippedCount', { equipped: equippedItems.length, max: maxSlots })}
                    </Text>
                  </View>
                  <Text style={styles.changeLink}>{t('ui.equipmentList.change')}</Text>
                </View>

                {equippedItems.length === 0 ? (
                  <Text style={styles.emptyEquipmentText}>{t('ui.equipmentList.emptyEquipment')}</Text>
                ) : (
                  <View style={styles.equipmentList}>
                    {equippedItems.map(item => {
                      const template = getEquipmentTemplate(item.templateId)
                      if (!template) return null

                      const multiplier = penaltyMultipliers.get(item.templateId) ?? 1
                      const penaltyPercent = multiplier !== 1 ? Math.round(multiplier * 100) : undefined
                      const displayBonuses = getDisplayBonuses(item, characterSkills, multiplier)
                      const inlineStats = displayBonuses.map((bonus) => getInlineBonusLabel(bonus)).join('  ')
                      const displayName = getEquipmentDisplayName(item, template)
                      const itemName = penaltyPercent !== undefined
                        ? `${penaltyPercent}％ ${displayName}`
                        : displayName

                      return (
                        <View
                          key={item.id}
                          style={[styles.itemRow, penaltyPercent !== undefined && styles.itemRowPenalty]}
                        >
                          <View style={styles.itemInfo}>
                            <Text style={styles.itemStats} numberOfLines={1}>
                              {inlineStats}
                            </Text>
                            <Text style={styles.itemName} numberOfLines={1}>
                              {itemName}
                            </Text>
                          </View>
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
    paddingBottom: BOTTOM_INFO_SPACING,
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
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  itemRowPenalty: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  itemInfo: {
    flex: 1,
  },
  itemStats: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
})
