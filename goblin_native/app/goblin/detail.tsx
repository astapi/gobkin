import { useMemo, useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert, PanResponder } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router, useNavigation } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { useBaseStore } from '@/presentation/stores/useBaseStore'
import { usePartyStore } from '@/presentation/stores/usePartyStore'
import type { Goblin } from '@/shared/types'
import type { BattleActionPolicy } from '@/shared/types'
import { getFactor } from '@/shared/data/factors'
import { getGoblinDisplayImage } from '@/shared/utils/goblinImages'
import { getFactorImage } from '@/shared/utils/factorImages'
import { ModStatCalculator } from '@/core/services/ModStatCalculator'
import { EquipmentService } from '@/core/services/EquipmentService'
import { getExpForNextLevel, getExpProgress } from '@/core/services/ExperienceSystem'
import { getModTemplate } from '@/shared/data/modPoolLoader'
import { getCharacterSkillEffectDescriptions, getUniqueSkillsById } from '@/shared/data/characterSkills'
import { SQLiteEquipmentRepository } from '@/infrastructure/repositories/SQLiteEquipmentRepository'
import { getDefaultSkillsForRace } from '@/shared/data/raceSkills'
import { getGoblinJobDefinition } from '@/shared/data/goblinJobs'
import { MAGE_MAGIC_SPELL_TABLE } from '@/shared/data/mageMagic'
import { SPELL_DEFS } from '@/shared/data/spells'
import { getGoblinBaseAttributesAtLevel } from '@/shared/utils/goblinHp'
import { getEffectiveStats } from '@/shared/utils/goblinStats'
import { isProtectedGoblin } from '@/shared/utils/goblinProtection'
import { getFactorName, getRaceLabel, getSkillLabel, getSpellLabel, getStatLabel } from '@/shared/i18n/entityLocalization'
import { normalizeBattleActionPolicy } from '@/shared/utils/battleActionPolicy'
import type { CharacterSkill, EquipmentInstance } from '@/shared/types'

const ACTION_POLICY_FIELDS: Array<{ key: keyof BattleActionPolicy; labelKey: string }> = [
  { key: 'attackRate', labelKey: 'ui.goblin.battleActionAttackRate' },
  { key: 'clericMagicRate', labelKey: 'ui.goblin.battleActionClericMagicRate' },
  { key: 'mageMagicRate', labelKey: 'ui.goblin.battleActionMageMagicRate' },
]

function getMageMagicEntries(skill: CharacterSkill) {
  const mageMagicLevel = skill.mageMagicLevel
  if (mageMagicLevel === undefined) return []
  return MAGE_MAGIC_SPELL_TABLE.filter(entry => entry.spellTier <= mageMagicLevel)
}

function getSpellName(spellId: string): string {
  const spellDef = SPELL_DEFS[spellId]
  return spellDef ? getSpellLabel(spellDef) : spellId
}

function getLearnedMageMagicNames(skill: CharacterSkill, characterLevel: number): string[] {
  return getMageMagicEntries(skill)
    .filter(entry => characterLevel >= entry.requiredCharacterLevel)
    .map(entry => getSpellName(entry.spellId))
}

function formatMageMagicDetail(skill: CharacterSkill, characterLevel: number): string | null {
  const entries = getMageMagicEntries(skill)
  if (entries.length === 0) return null

  return entries
    .map((entry) => {
      const learned = characterLevel >= entry.requiredCharacterLevel ? '習得済' : '未習得'
      return `Lv${entry.requiredCharacterLevel} ${getSpellName(entry.spellId)}（${learned}）`
    })
    .join('\n')
}

function includesSkillId(skills: readonly CharacterSkill[], skillId: string): boolean {
  return skills.some(skill => skill.id === skillId)
}

function SkillGroup({
  title,
  skills,
  goblinLevel,
  onPressSkill,
}: {
  title: string
  skills: CharacterSkill[]
  goblinLevel: number
  onPressSkill: (skill: CharacterSkill) => void
}) {
  if (skills.length === 0) return null

  return (
    <View style={styles.skillGroup}>
      <Text style={styles.skillGroupTitle}>{title}</Text>
      <View style={styles.abilityList}>
        {skills.map((skill, idx) => {
          const learnedMageMagicNames = getLearnedMageMagicNames(skill, goblinLevel)

          return (
            <TouchableOpacity
              key={`${skill.id}-${idx}`}
              style={styles.abilityItem}
              activeOpacity={0.75}
              onPress={() => onPressSkill(skill)}
            >
              <Text style={styles.abilityName}>{getSkillLabel(skill)}</Text>
              <Text style={styles.abilityDesc}>{getCharacterSkillEffectDescriptions(skill).join('\n')}</Text>
              {learnedMageMagicNames.length > 0 && (
                <Text style={styles.abilitySpellList}>
                  習得済魔法: {learnedMageMagicNames.join(' / ')}
                </Text>
              )}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

function BattleActionRateSlider({
  value,
  onChange,
  onSlidingStart,
  onSlidingComplete,
}: {
  value: number
  onChange: (value: number) => void
  onSlidingStart: () => void
  onSlidingComplete: () => void
}) {
  const trackRef = useRef<View>(null)
  const [trackWidth, setTrackWidth] = useState(0)
  const clampedValue = Math.max(0, Math.min(100, Math.round(value)))
  const fillWidth = trackWidth * clampedValue / 100

  const updateFromTrackX = useCallback((x: number) => {
    if (trackWidth <= 0) return
    const nextValue = Math.round(Math.max(0, Math.min(trackWidth, x)) / trackWidth * 100)
    onChange(nextValue)
  }, [onChange, trackWidth])

  const updateFromPageX = useCallback((pageX: number) => {
    trackRef.current?.measureInWindow((x) => {
      updateFromTrackX(pageX - x)
    })
  }, [updateFromTrackX])

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: event => updateFromPageX(event.nativeEvent.pageX),
    onPanResponderMove: (_, gestureState) => updateFromPageX(gestureState.moveX),
    onPanResponderRelease: onSlidingComplete,
    onPanResponderTerminate: onSlidingComplete,
    onShouldBlockNativeResponder: () => true,
  }), [onSlidingComplete, updateFromPageX])

  return (
    <View style={styles.sliderBlock}>
      <View
        ref={trackRef}
        style={styles.sliderTrackTouchArea}
        onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
        onTouchStart={onSlidingStart}
        {...panResponder.panHandlers}
      >
        <View style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: fillWidth }]} />
          <View style={[styles.sliderThumb, { left: fillWidth }]} />
        </View>
      </View>
      <View style={styles.sliderScaleRow}>
        <Text style={styles.sliderScaleText}>0%</Text>
        <Text style={styles.sliderScaleText}>50%</Text>
        <Text style={styles.sliderScaleText}>100%</Text>
      </View>
    </View>
  )
}

export default function GoblinDetailScreen() {
  const { t } = useTranslation()
  const { goblinId, source } = useLocalSearchParams<{ goblinId: string, source?: string }>()
  const goblins = useGoblinStore((state) => state.goblins)
  const getGoblinById = useGoblinStore((state) => state.getGoblinById)
  const saveGoblin = useGoblinStore((state) => state.saveGoblin)
  const deleteGoblin = useGoblinStore((state) => state.deleteGoblin)
  const pendingGoblins = useBaseStore((state) => state.pendingGoblins)
  const parties = usePartyStore((state) => state.parties)
  const equipmentRepository = useMemo(() => SQLiteEquipmentRepository.getInstance(), [])
  const [goblin, setGoblin] = useState<Goblin | null>(null)
  const [equippedItems, setEquippedItems] = useState<EquipmentInstance[]>([])
  const [battleActionPolicyDraft, setBattleActionPolicyDraft] = useState<BattleActionPolicy>(
    normalizeBattleActionPolicy(),
  )
  const [isSavingBattleActionPolicy, setIsSavingBattleActionPolicy] = useState(false)
  const [isSlidingBattleActionPolicy, setIsSlidingBattleActionPolicy] = useState(false)
  const savedBattleActionPolicyRef = useRef<string>(JSON.stringify(normalizeBattleActionPolicy()))
  const parentNav = useNavigation()
  const isPendingGoblin = source === 'pending'
  const parsedGoblinId = useMemo(() => {
    if (!goblinId) return null
    const parsed = parseInt(goblinId, 10)
    return Number.isNaN(parsed) ? null : parsed
  }, [goblinId])

  useEffect(() => {
    if (parsedGoblinId == null) {
      setGoblin(null)
      return
    }

    if (isPendingGoblin) {
      setGoblin(pendingGoblins.find((item) => item.id === parsedGoblinId) ?? null)
      return
    }

    const storedGoblin = goblins.find((item) => item.id === parsedGoblinId)
    if (storedGoblin) {
      setGoblin(storedGoblin)
      return
    }

    void getGoblinById(parsedGoblinId)
      .then(setGoblin)
      .catch(() => setGoblin(null))
  }, [parsedGoblinId, getGoblinById, goblins, isPendingGoblin, pendingGoblins])

  useEffect(() => {
    if (parsedGoblinId == null || isPendingGoblin) {
      setEquippedItems([])
      return
    }

    let active = true
    void equipmentRepository.getByGoblinId(parsedGoblinId)
      .then(items => {
        if (active) setEquippedItems(items)
      })
      .catch(() => {
        if (active) setEquippedItems([])
      })

    return () => {
      active = false
    }
  }, [equipmentRepository, isPendingGoblin, parsedGoblinId])

  useEffect(() => {
    if (goblin) {
      const nextPolicy = normalizeBattleActionPolicy(goblin.battleActionPolicy)
      savedBattleActionPolicyRef.current = JSON.stringify(nextPolicy)
      parentNav.getParent()?.setOptions({ title: goblin.name })
      setBattleActionPolicyDraft(nextPolicy)
    }
  }, [goblin, parentNav])

  const effectiveStats = useMemo(
    () => goblin ? getEffectiveStats(goblin) : null,
    [goblin]
  )
  const expForNext = goblin ? getExpForNextLevel(goblin.level) : 0
  const expProgress = goblin ? getExpProgress(goblin.level, goblin.experience) : 0
  const characterSkills = useMemo(() => getUniqueSkillsById(goblin?.skills ?? []), [goblin])
  const equipmentSkills = useMemo(
    () => getUniqueSkillsById(EquipmentService.collectGrantedSkills(equippedItems)),
    [equippedItems],
  )
  const raceSkills = useMemo(() => {
    if (!goblin) return []
    const raceDefaultSkills = getUniqueSkillsById(getDefaultSkillsForRace(goblin.raceId ?? goblin.race))
    return raceDefaultSkills.filter(skill => includesSkillId(characterSkills, skill.id))
  }, [characterSkills, goblin])
  const uniqueSkills = useMemo(() => {
    const raceSkillIds = new Set(raceSkills.map(skill => skill.id))
    const equipmentSkillIds = new Set(equipmentSkills.map(skill => skill.id))
    return characterSkills.filter(skill => (
      !raceSkillIds.has(skill.id) &&
      !equipmentSkillIds.has(skill.id)
    ))
  }, [characterSkills, equipmentSkills, raceSkills])
  const hasVisibleSkills = uniqueSkills.length > 0 || raceSkills.length > 0 || equipmentSkills.length > 0
  const baseAttributes = useMemo(
    () => goblin ? getGoblinBaseAttributesAtLevel(goblin, goblin.level) : null,
    [goblin]
  )
  const assignedParty = useMemo(() => (
    goblin ? parties.find((party) => party.memberIds.includes(goblin.id)) ?? null : null
  ), [goblin, parties])
  const jobLabel = goblin?.job ? getGoblinJobDefinition(goblin.job).name : null

  const handleBanish = useCallback(() => {
    if (!goblin) return
    if (isProtectedGoblin(goblin)) {
      Alert.alert(t('ui.goblin.banishBlocked'), `${goblin.name}は追放できません。`)
      return
    }
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

  const handlePressSkill = useCallback((skill: CharacterSkill) => {
    if (!goblin) return
    const title = getSkillLabel(skill)
    const mageMagicDetail = formatMageMagicDetail(skill, goblin.level)
    Alert.alert(title, mageMagicDetail ?? getCharacterSkillEffectDescriptions(skill).join('\n'))
  }, [goblin])

  const handleChangeBattleActionPolicy = useCallback((key: keyof BattleActionPolicy, value: number) => {
    setBattleActionPolicyDraft(current => normalizeBattleActionPolicy({
      ...current,
      [key]: value,
    }))
  }, [])

  useEffect(() => {
    if (!goblin || isPendingGoblin) return

    const nextPolicy = normalizeBattleActionPolicy(battleActionPolicyDraft)
    const nextPolicyKey = JSON.stringify(nextPolicy)
    if (nextPolicyKey === savedBattleActionPolicyRef.current) return

    const timeoutId = setTimeout(() => {
      setIsSavingBattleActionPolicy(true)
      void saveGoblin({
        ...goblin,
        battleActionPolicy: nextPolicy,
      })
        .then(() => {
          savedBattleActionPolicyRef.current = nextPolicyKey
          setGoblin(current => current ? { ...current, battleActionPolicy: nextPolicy } : current)
        })
        .catch((error: unknown) => {
          console.error('[GoblinDetail] Failed to save battle action policy', error)
        })
        .finally(() => setIsSavingBattleActionPolicy(false))
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [battleActionPolicyDraft, goblin, isPendingGoblin, saveGoblin])

  if (!goblin || !effectiveStats) return null

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView style={styles.content} scrollEnabled={!isSlidingBattleActionPolicy}>
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
              { key: 'magicAtk', label: getStatLabel('magicAtk') },
              { key: 'def', label: getStatLabel('def') },
              { key: 'magicDef', label: getStatLabel('magicDef') },
              { key: 'attackCount', label: getStatLabel('attackCount') },
              { key: 'accuracy', label: getStatLabel('accuracy') },
              { key: 'evasion', label: getStatLabel('evasion') },
              { key: 'magicHeal', label: getStatLabel('magicHeal') },
              { key: 'criticalRate', label: getStatLabel('criticalRate') },
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

        {hasVisibleSkills && (
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>{t('ui.goblin.skills')}</Text>
            <SkillGroup
              title={t('ui.goblin.uniqueSkills')}
              skills={uniqueSkills}
              goblinLevel={goblin.level}
              onPressSkill={handlePressSkill}
            />
            <SkillGroup
              title={t('ui.goblin.raceSkills')}
              skills={raceSkills}
              goblinLevel={goblin.level}
              onPressSkill={handlePressSkill}
            />
            <SkillGroup
              title={t('ui.goblin.equipmentSkills')}
              skills={equipmentSkills}
              goblinLevel={goblin.level}
              onPressSkill={handlePressSkill}
            />
          </View>
        )}

        {!isPendingGoblin && (
          <View style={styles.detailSection}>
            <View style={styles.policySectionHeader}>
              <Text style={styles.sectionTitle}>{t('ui.goblin.battleActionPolicy')}</Text>
              {isSavingBattleActionPolicy && (
                <Text style={styles.policySavingText}>{t('ui.common.saving')}</Text>
              )}
            </View>
            <View style={styles.policyList}>
              {ACTION_POLICY_FIELDS.map(field => (
                <View key={field.key} style={styles.policyItem}>
                  <View style={styles.policyHeader}>
                    <Text style={styles.policyLabel}>{t(field.labelKey)}</Text>
                    <Text style={styles.policyValue}>{battleActionPolicyDraft[field.key]}%</Text>
                  </View>
                  <BattleActionRateSlider
                    value={battleActionPolicyDraft[field.key]}
                    onChange={(value) => handleChangeBattleActionPolicy(field.key, value)}
                    onSlidingStart={() => setIsSlidingBattleActionPolicy(true)}
                    onSlidingComplete={() => setIsSlidingBattleActionPolicy(false)}
                  />
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

            {!isProtectedGoblin(goblin) && (
              <TouchableOpacity style={styles.banishButton} onPress={handleBanish}>
                <Text style={styles.banishButtonText}>{t('ui.goblin.banishButton')}</Text>
              </TouchableOpacity>
            )}
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
  skillGroup: {
    gap: 6,
    marginBottom: 10,
  },
  skillGroupTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
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
  abilitySpellList: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 14,
    color: '#374151',
  },
  policySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  policySavingText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  policyList: {
    gap: 8,
  },
  policyItem: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
    padding: 8,
    gap: 8,
  },
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  policyLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#1F2937',
  },
  policyValue: {
    minWidth: 44,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  sliderBlock: {
    gap: 2,
  },
  sliderTrackTouchArea: {
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  sliderTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    overflow: 'visible',
  },
  sliderFill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#4B5563',
  },
  sliderThumb: {
    position: 'absolute',
    top: -7,
    width: 20,
    height: 20,
    marginLeft: -10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#374151',
  },
  sliderScaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderScaleText: {
    fontSize: 9,
    color: '#9CA3AF',
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
