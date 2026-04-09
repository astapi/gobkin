import { useMemo, useCallback, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router, useNavigation } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { useBaseStore } from '@/presentation/stores/useBaseStore'
import { usePartyStore } from '@/presentation/stores/usePartyStore'
import type { Goblin } from '@/shared/types'
import { getFactor } from '@/shared/data/factors'
import { getGoblinDisplayImage } from '@/shared/utils/goblinImages'
import { getFactorImage } from '@/shared/utils/factorImages'
import { ModStatCalculator } from '@/core/services/ModStatCalculator'
import { getExpForNextLevel, getExpProgress } from '@/core/services/ExperienceSystem'
import { getModTemplate } from '@/shared/data/modPoolLoader'
import { describeCharacterSkill, getUniqueSkillsById } from '@/shared/data/characterSkills'
import { getGoblinJobDefinition } from '@/shared/data/goblinJobs'
import { getGoblinBaseAttributes } from '@/shared/utils/goblinHp'
import { getFactorName, getRaceLabel, getSkillLabel, getStatLabel } from '@/shared/i18n/entityLocalization'

export default function GoblinDetailScreen() {
  const { t } = useTranslation()
  const { goblinId, source } = useLocalSearchParams<{ goblinId: string, source?: string }>()
  const getGoblinById = useGoblinStore((state) => state.getGoblinById)
  const deleteGoblin = useGoblinStore((state) => state.deleteGoblin)
  const pendingGoblins = useBaseStore((state) => state.pendingGoblins)
  const parties = usePartyStore((state) => state.parties)
  const [goblin, setGoblin] = useState<Goblin | null>(null)
  const parentNav = useNavigation()
  const isPendingGoblin = source === 'pending'

  useEffect(() => {
    if (!goblinId) return
    const parsedGoblinId = parseInt(goblinId, 10)

    if (isPendingGoblin) {
      setGoblin(pendingGoblins.find((item) => item.id === parsedGoblinId) ?? null)
      return
    }

    void getGoblinById(parsedGoblinId)
      .then(setGoblin)
      .catch(() => setGoblin(null))
  }, [goblinId, getGoblinById, isPendingGoblin, pendingGoblins])

  useEffect(() => {
    if (goblin) {
      parentNav.getParent()?.setOptions({ title: goblin.name })
    }
  }, [goblin, parentNav])

  const effectiveStats = useMemo(
    () => goblin ? ModStatCalculator.calculate(goblin) : null,
    [goblin]
  )
  const expForNext = goblin ? getExpForNextLevel(goblin.level) : 0
  const expProgress = goblin ? getExpProgress(goblin.level, goblin.experience) : 0
  const characterSkills = useMemo(() => getUniqueSkillsById(goblin?.skills ?? []), [goblin])
  const baseAttributes = useMemo(
    () => goblin ? getGoblinBaseAttributes(goblin) : null,
    [goblin]
  )
  const assignedParty = useMemo(() => (
    goblin ? parties.find((party) => party.memberIds.includes(goblin.id)) ?? null : null
  ), [goblin, parties])
  const jobLabel = goblin?.job ? getGoblinJobDefinition(goblin.job).name : null

  const handleBanish = useCallback(() => {
    if (!goblin) return
    if (assignedParty) {
      Alert.alert(t('ui.goblin.banishBlocked'), `${goblin.name}は${assignedParty.name}に編成中です。`)
      return
    }
    Alert.alert(
      t('ui.goblin.banishConfirmTitle'),
      t('ui.goblin.banishConfirmBody', { name: goblin.name }),
      [
        { text: t('ui.common.cancel'), style: 'cancel' },
        {
          text: t('ui.goblin.banishAction'),
          style: 'destructive',
          onPress: () => {
            void deleteGoblin(goblin.id)
              .then(() => {
                router.back()
              })
              .catch((error: unknown) => {
                const message = error instanceof Error ? error.message : `${goblin.name}の追放に失敗しました。`
                Alert.alert(t('ui.goblin.deleteErrorTitle'), message)
              })
          },
        },
      ],
    )
  }, [assignedParty, goblin, deleteGoblin, t])

  const handleOpenEquipment = useCallback(() => {
    if (!goblin) return
    router.push({ pathname: '/goblin/equipment', params: { goblinId: String(goblin.id) } })
  }, [goblin])

  if (!goblin || !effectiveStats) return null

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView style={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.profileAvatar}>
              <Image source={getGoblinDisplayImage(goblin)} style={styles.profileAvatarImage} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{goblin.name}</Text>
              <Text style={styles.profileRace}>{getRaceLabel(goblin.raceId ?? goblin.race)}</Text>
              {jobLabel && <Text style={styles.profileJob}>{jobLabel}</Text>}
              <Text style={styles.profileLevel}>{t('ui.common.levelShort')}{goblin.level}</Text>
            </View>
          </View>
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.sectionTitle}>{t('ui.goblin.stats')}</Text>
          <View style={styles.statGrid}>
            {([
              { key: 'hp', label: getStatLabel('hp') },
              { key: 'atk', label: getStatLabel('atk') },
              { key: 'def', label: getStatLabel('def') },
              { key: 'attackCount', label: getStatLabel('attackCount') },
              { key: 'accuracy', label: getStatLabel('accuracy') },
              { key: 'evasion', label: getStatLabel('evasion') },
            ] as const).map(item => (
              <View key={item.key} style={styles.statChip}>
                <Text style={styles.statChipLabel}>{item.label}</Text>
                <Text style={styles.statChipValue}>{effectiveStats[item.key]}</Text>
              </View>
            ))}
          </View>
        </View>

        {baseAttributes && (
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>{t('ui.goblin.baseAttributes')}</Text>
            <View style={styles.baseAttributeList}>
              {([
                { key: 'power', label: getStatLabel('power') },
                { key: 'wisdom', label: getStatLabel('wisdom') },
                { key: 'spirit', label: getStatLabel('spirit') },
                { key: 'vitality', label: getStatLabel('vitality') },
                { key: 'agility', label: getStatLabel('agility') },
                { key: 'luck', label: getStatLabel('luck') },
              ] as const).map(item => (
                <View key={item.key} style={styles.baseAttributeRow}>
                  <Text style={styles.baseAttributeLabel}>{item.label}</Text>
                  <Text style={styles.baseAttributeValue}>{baseAttributes[item.key]}</Text>
                  <Text style={styles.baseAttributeDelta}>(+0)</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {characterSkills.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>{t('ui.goblin.skills')}</Text>
            <View style={styles.abilityList}>
              {characterSkills.map((skill, idx) => (
                <View key={`${skill.id}-${idx}`} style={styles.abilityItem}>
                  <Text style={styles.abilityName}>{getSkillLabel(skill)}</Text>
                  <Text style={styles.abilityDesc}>{describeCharacterSkill(skill)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.detailSection}>
          <Text style={styles.sectionTitle}>{t('ui.goblin.experience')}</Text>
          <View style={styles.expCard}>
            <View style={styles.expRow}>
              <Text style={styles.expLabel}>{t('ui.goblin.exp')}</Text>
              <Text style={styles.expValue}>{goblin.experience} / {expForNext}</Text>
            </View>
            <View style={styles.expBarTrack}>
              <View style={[styles.expBarFill, { width: `${Math.max(0, Math.min(1, expProgress)) * 100}%` }]} />
            </View>
            <Text style={styles.expHint}>{t('ui.goblin.nextLevel', { value: Math.max(0, expForNext - goblin.experience) })}</Text>
          </View>
        </View>

        {goblin.factors && goblin.factors.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>{t('ui.goblin.factors')}</Text>
            <View style={styles.compactList}>
              {goblin.factors.map((factorId, idx) => {
                const factor = getFactor(factorId)
                if (!factor) return null
                const FactorIcon = getFactorImage(factorId)
                return (
                  <View key={idx} style={styles.factorItem}>
                    <View style={styles.factorIconContainer}>
                      <FactorIcon width={20} height={20} />
                    </View>
                    <View style={styles.factorInfo}>
                      <Text style={styles.factorName}>{getFactorName(factor)}</Text>
                      {factor.effects && factor.effects.length > 0 && (
                        <View style={styles.factorEffectRow}>
                          {factor.effects
                            .filter(effect => effect.type === 'stat_bonus')
                            .map((effect, effectIndex) => (
                              <View key={`${factorId}-${effectIndex}`} style={styles.factorEffectBadge}>
                                <Text style={styles.factorEffectText}>
                                  {effect.target.toUpperCase()} +{effect.value}
                                </Text>
                              </View>
                            ))}
                        </View>
                      )}
                    </View>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        {goblin.mods && goblin.mods.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>{t('ui.goblin.mods')}</Text>
            <View style={styles.modList}>
              {goblin.mods.map((mod, idx) => {
                const template = getModTemplate(mod.templateId)
                if (!template) return null
                const isPercent = template.stat.includes('percent') || template.stat === 'damage_reduction'
                const label = getStatLabel(template.stat)
                const valueText = `${mod.value > 0 ? '+' : ''}${mod.value}${isPercent ? '%' : ''}`
                return (
                  <View key={idx} style={styles.modItem}>
                    <Text style={styles.modName}>{label}</Text>
                    <Text style={styles.modEffect}>{valueText}</Text>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        {!isPendingGoblin && (
          <>
            <TouchableOpacity style={styles.equipmentButton} onPress={handleOpenEquipment}>
              <Text style={styles.equipmentButtonText}>{t('ui.goblin.equipmentChange')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.banishButton} onPress={handleBanish}>
              <Text style={styles.banishButtonText}>{t('ui.goblin.banishButton')}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    padding: 12,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#F3F4F6',
  },
  profileAvatarImage: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  profileRace: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 1,
  },
  profileJob: {
    fontSize: 12,
    color: '#1D4ED8',
    fontWeight: '600',
    marginBottom: 1,
  },
  profileLevel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  detailSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 6,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statChip: {
    width: '48%',
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  statChipLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 1,
  },
  statChipValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  baseAttributeList: {
    gap: 4,
  },
  baseAttributeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  baseAttributeLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6B7280',
    width: 34,
  },
  baseAttributeValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1F2937',
    width: 28,
    textAlign: 'right',
    marginLeft: 8,
  },
  baseAttributeDelta: {
    fontSize: 10,
    color: '#9CA3AF',
    marginLeft: 6,
  },
  abilityList: {
    gap: 6,
  },
  abilityItem: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  abilityName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 1,
  },
  abilityDesc: {
    fontSize: 10,
    color: '#6B7280',
  },
  expCard: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
    padding: 8,
  },
  expRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  expLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
  },
  expValue: {
    fontSize: 10,
    color: '#6B7280',
  },
  expBarTrack: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    overflow: 'hidden',
  },
  expBarFill: {
    height: '100%',
    backgroundColor: '#4B5563',
  },
  expHint: {
    marginTop: 4,
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'right',
  },
  compactList: {
    gap: 6,
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  factorIconContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 1,
  },
  factorInfo: {
    flex: 1,
  },
  factorName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1F2937',
  },
  factorEffectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  factorEffectBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#ECFDF5',
  },
  factorEffectText: {
    fontSize: 9,
    color: '#166534',
    fontWeight: '600',
  },
  modList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modItem: {
    width: '48%',
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  modName: {
    fontSize: 10,
    color: '#1F2937',
    marginBottom: 2,
  },
  modEffect: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1F2937',
  },
  equipmentButton: {
    marginTop: 2,
    marginBottom: 8,
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  equipmentButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  banishButton: {
    marginBottom: 16,
    backgroundColor: '#4B5563',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  banishButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
})
