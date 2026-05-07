import { useEffect, useMemo, useState, useCallback } from 'react'
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { usePartyStore } from '@/presentation/stores/usePartyStore'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { getGoblinDisplayImage } from '@/shared/utils/goblinImages'
import { getFactorImage } from '@/shared/utils/factorImages'
import { calculateGoblinEffectiveStats, getEffectiveStats } from '@/shared/utils/goblinStats'
import { getExpForNextLevel } from '@/core/services/ExperienceSystem'
import { getRowDamageMultiplierFromSkills, getUniqueSkillsById } from '@/shared/data/characterSkills'
import { getFactor } from '@/shared/data/factors'
import { getFactorName, getStatLabel } from '@/shared/i18n/entityLocalization'
import { SQLiteEquipmentRepository } from '@/infrastructure/repositories/SQLiteEquipmentRepository'
import { EquipmentService } from '@/core/services/EquipmentService'
import type { CharacterSkill, Goblin, GoblinStats, Party } from '@/shared/types'

const STATUS_COMPARISON_KEYS: ReadonlyArray<keyof GoblinStats> = [
  'hp',
  'atk',
  'magicAtk',
  'def',
  'magicDef',
  'attackCount',
  'accuracy',
  'evasion',
  'magicHeal',
  'criticalRate',
]

type PartySkillCategory = 'rare' | 'title' | 'gold'

type PartySkillEntry = {
  category: PartySkillCategory
  goblin: Goblin
  skill: CharacterSkill
  valueText: string
}

function getExpRateText(t: (key: string, options?: Record<string, unknown>) => string): string {
  return t('ui.formation.partyInfo.expRate')
}

function getAttackTypeLabel(skills: CharacterSkill[], t: (key: string) => string): string {
  const uniqueSkills = getUniqueSkillsById(skills)
  const hasMelee = uniqueSkills.some((skill) => skill.enablesMeleeRowDamagePenalty)
  const hasRanged = uniqueSkills.some((skill) => skill.enablesRangedRowDamagePenalty)

  if (hasMelee && hasRanged) return t('ui.formation.partyInfo.rangedWeapon')
  if (hasMelee) return t('ui.formation.partyInfo.meleeWeapon')
  if (hasRanged) return t('ui.formation.partyInfo.rangedWeapon')
  return t('ui.formation.partyInfo.noSkill')
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function formatMultiplier(value: number): string {
  return `${value.toFixed(2)}倍`
}

function formatBonusPercent(value: number): string {
  return `+${value}%`
}

function getMemberFactorIds(goblin: Goblin): string[] {
  return Array.from(
    new Set(
      [goblin.variantFactorId, ...(goblin.factors ?? [])].filter((factorId): factorId is string =>
        Boolean(factorId),
      ),
    ),
  )
}

function getFactorLabel(factorId: string): string {
  const factor = getFactor(factorId)
  return factor ? getFactorName(factor) : factorId
}

function FactorChip({ factorId }: { factorId: string }) {
  const FactorIcon = getFactorImage(factorId)

  return (
    <View style={styles.factorChip}>
      <FactorIcon width={13} height={13} />
      <Text style={styles.factorChipText} numberOfLines={1}>
        {getFactorLabel(factorId)}
      </Text>
    </View>
  )
}

function getPartySkillEntries(goblin: Goblin, skills: CharacterSkill[]): PartySkillEntry[] {
  return skills.flatMap((skill) => {
    const entries: PartySkillEntry[] = []

    if (skill.partyRareMultiplier !== undefined) {
      entries.push({
        category: 'rare',
        goblin,
        skill,
        valueText: formatMultiplier(skill.partyRareMultiplier),
      })
    }
    if (skill.partyTitleMultiplier !== undefined) {
      entries.push({
        category: 'title',
        goblin,
        skill,
        valueText: formatMultiplier(skill.partyTitleMultiplier),
      })
    }
    if (skill.goldBonusPercent !== undefined) {
      entries.push({
        category: 'gold',
        goblin,
        skill,
        valueText: formatBonusPercent(skill.goldBonusPercent),
      })
    }

    return entries
  })
}

export default function PartyInfoScreen() {
  const { t } = useTranslation()
  const { partyId } = useLocalSearchParams<{ partyId: string }>()
  const { parties, isLoading: partiesLoading, getPartyById } = usePartyStore()
  const goblins = useGoblinStore((state) => state.goblins)
  const goblinsLoading = useGoblinStore((state) => state.isLoading)
  const [party, setParty] = useState<Party | null>(null)
  const [memberSkillsById, setMemberSkillsById] = useState<Record<number, CharacterSkill[]>>({})
  const [memberStatsById, setMemberStatsById] = useState<Record<number, GoblinStats>>({})

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

  const partySkillEntries = useMemo(() => {
    return partyMembers.flatMap((goblin) => getPartySkillEntries(goblin, memberSkillsById[goblin.id] ?? goblin.skills))
  }, [memberSkillsById, partyMembers])

  useEffect(() => {
    let cancelled = false

    const loadMemberSkills = async (): Promise<void> => {
      if (partyMembers.length === 0) {
        setMemberSkillsById({})
        setMemberStatsById({})
        return
      }

      const repository = SQLiteEquipmentRepository.getInstance()
      const entries = await Promise.all(
        partyMembers.map(async (goblin) => {
          const equippedItems = await repository.getByGoblinId(goblin.id)
          const equipmentSkills = EquipmentService.collectGrantedSkills(equippedItems)
          const effectiveStats = calculateGoblinEffectiveStats(goblin, equippedItems)
          return [goblin.id, [...goblin.skills, ...equipmentSkills], effectiveStats] as const
        }),
      )

      if (cancelled) return

      setMemberSkillsById(
        entries.reduce<Record<number, CharacterSkill[]>>((acc, [goblinId, skills]) => {
          acc[goblinId] = [...skills]
          return acc
        }, {}),
      )
      setMemberStatsById(
        entries.reduce<Record<number, GoblinStats>>((acc, [goblinId, , stats]) => {
          acc[goblinId] = stats
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
        <Text style={styles.loadingText}>{t('ui.common.loading')}</Text>
      </View>
    )
  }

  if (!party) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{t('ui.formation.common.partyNotFound')}</Text>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>{t('ui.formation.common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('ui.formation.partyInfo.title'),
          headerLeft: () => (
            <TouchableOpacity onPress={handleBack}>
              <Text style={styles.headerButton}>← {t('ui.formation.common.back')}</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.partyName}>{party.name}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('ui.formation.partyInfo.levelSectionTitle')}</Text>
          {partyMembers.map((goblin) => {
            const expForNext = getExpForNextLevel(goblin.level)
            const remainingExp = Math.max(0, expForNext - goblin.experience)

            return (
              <View key={goblin.id} style={styles.memberRow}>
                <Image source={getGoblinDisplayImage(goblin)} style={styles.avatar} />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{goblin.name}</Text>
                  <Text style={styles.memberSubText}>
                    {t('ui.formation.partyInfo.levelLine', { level: goblin.level, remaining: remainingExp, rate: getExpRateText(t) })}
                  </Text>
                </View>
              </View>
            )
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('ui.formation.partyInfo.rowDamageTitle')}</Text>
          {partyMembers.map((goblin, index) => {
            const memberSkills = memberSkillsById[goblin.id] ?? goblin.skills
            const multiplier = getRowDamageMultiplierFromSkills(memberSkills, index)
            const attackTypeLabel = getAttackTypeLabel(memberSkills, t)

            return (
              <View key={`row-${goblin.id}`} style={styles.memberRow}>
                <Image source={getGoblinDisplayImage(goblin)} style={styles.avatar} />
                <View style={styles.attackInfoRow}>
                  <Text style={styles.memberName}>{goblin.name}</Text>
                  <Text style={styles.attackModifierText}>
                    {t('ui.formation.partyInfo.modifierLine', { percent: formatPercent(multiplier), type: attackTypeLabel })}
                  </Text>
                </View>
              </View>
            )
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('ui.formation.partyInfo.partySkillTitle')}</Text>
          {(['rare', 'title', 'gold'] as const).map((category) => {
            const entries = partySkillEntries.filter((entry) => entry.category === category)

            return (
              <View key={category} style={styles.partySkillGroup}>
                <Text style={styles.statusTitle}>{t(`ui.formation.partyInfo.partySkillCategory.${category}`)}</Text>
                {entries.length > 0 ? (
                  entries.map((entry, index) => (
                    <View key={`${category}-${entry.goblin.id}-${entry.skill.id}-${index}`} style={styles.statusMemberRow}>
                      <View style={styles.compactMemberInfo}>
                        <Image source={getGoblinDisplayImage(entry.goblin)} style={styles.compactAvatar} />
                        <Text style={styles.statusMemberName} numberOfLines={1}>{entry.goblin.name}</Text>
                      </View>
                      <Text style={styles.statusValue}>{entry.valueText}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.partySkillEmptyText}>{t('ui.formation.partyInfo.noPartySkills')}</Text>
                )}
              </View>
            )
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('ui.formation.partyInfo.statusComparisonTitle')}</Text>
          <View style={styles.statusList}>
            {STATUS_COMPARISON_KEYS.map((statKey) => (
              <View key={statKey} style={styles.statusGroup}>
                <Text style={styles.statusTitle}>{getStatLabel(statKey)}</Text>
                {partyMembers.map((goblin) => {
                  const stats = memberStatsById[goblin.id] ?? getEffectiveStats(goblin)

                  return (
                    <View key={`${statKey}-${goblin.id}`} style={styles.statusMemberRow}>
                      <View style={styles.compactMemberInfo}>
                        <Image source={getGoblinDisplayImage(goblin)} style={styles.compactAvatar} />
                        <Text style={styles.statusMemberName} numberOfLines={1}>{goblin.name}</Text>
                      </View>
                      <Text style={styles.statusValue}>{stats[statKey]}</Text>
                    </View>
                  )
                })}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('ui.formation.partyInfo.factorListTitle')}</Text>
          <View style={styles.factorMemberList}>
            {partyMembers.map((goblin) => {
              const factorIds = getMemberFactorIds(goblin)

              return (
                <View key={`factors-${goblin.id}`} style={styles.factorMemberBlock}>
                  <View style={styles.factorMemberHeader}>
                    <Image source={getGoblinDisplayImage(goblin)} style={styles.compactAvatar} />
                    <Text style={styles.factorMemberName} numberOfLines={1}>{goblin.name}</Text>
                  </View>
                  {factorIds.length > 0 ? (
                    factorIds.map((factorId) => (
                      <FactorChip key={`${goblin.id}-${factorId}`} factorId={factorId} />
                    ))
                  ) : (
                    <Text style={styles.factorEmptyText}>{t('ui.formation.partyInfo.noFactors')}</Text>
                  )}
                </View>
              )
            })}
          </View>
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
  statusList: {
    gap: 12,
  },
  statusGroup: {
    gap: 4,
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  statusMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingLeft: 8,
  },
  compactMemberInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  compactAvatar: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  statusMemberName: {
    flex: 1,
    fontSize: 12,
    color: '#4B5563',
  },
  statusValue: {
    minWidth: 52,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  partySkillGroup: {
    gap: 4,
  },
  partySkillEmptyText: {
    paddingLeft: 8,
    fontSize: 12,
    color: '#9CA3AF',
  },
  factorMemberList: {
    gap: 12,
  },
  factorMemberBlock: {
    alignItems: 'flex-start',
    gap: 4,
  },
  factorMemberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  factorMemberName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  factorChip: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 32,
    backgroundColor: '#EEF2FF',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  factorChipText: {
    flexShrink: 1,
    fontSize: 9,
    fontWeight: '700',
    color: '#4338CA',
  },
  factorEmptyText: {
    paddingLeft: 32,
    fontSize: 12,
    color: '#9CA3AF',
  },
})
