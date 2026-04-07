import { useMemo, useCallback, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router, useNavigation } from 'expo-router'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { useBaseStore } from '@/presentation/stores/useBaseStore'
import type { Goblin } from '@/shared/types'
import { getFactor } from '@/shared/data/factors'
import { getGoblinImage } from '@/shared/utils/goblinImages'
import { getFactorImage } from '@/shared/utils/factorImages'
import { ModStatCalculator } from '@/core/services/ModStatCalculator'
import { getExpForNextLevel, getExpProgress } from '@/core/services/ExperienceSystem'
import { getModTemplate } from '@/shared/data/modPoolLoader'
import { describeCharacterSkill, getUniqueSkillsById } from '@/shared/data/characterSkills'

const STAT_LABELS: Record<string, string> = {
  hp_percent: 'HP', hp_flat: 'HP',
  atk_percent: 'ATK', atk_flat: 'ATK',
  def_percent: 'DEF', def_flat: 'DEF',
  spd_percent: 'SPD', spd_flat: 'SPD',
  sp_percent: 'SP', sp_flat: 'SP',
  attackCount_percent: '攻撃回数', attackCount_flat: '攻撃回数',
  accuracy_percent: '命中精度', accuracy_flat: '命中精度',
  evasion_percent: '回避', evasion_flat: '回避',
  damage_reduction: '被ダメ軽減',
}

function getStatLabel(stat: string): string {
  return STAT_LABELS[stat] || stat
}

export default function GoblinDetailScreen() {
  const { goblinId, source } = useLocalSearchParams<{ goblinId: string, source?: string }>()
  const getGoblinById = useGoblinStore((state) => state.getGoblinById)
  const deleteGoblin = useGoblinStore((state) => state.deleteGoblin)
  const pendingGoblins = useBaseStore((state) => state.pendingGoblins)
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

  const handleBanish = useCallback(() => {
    if (!goblin) return
    Alert.alert(
      '追放確認',
      `${goblin.name}を追放しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '追放する',
          style: 'destructive',
          onPress: () => {
            deleteGoblin(goblin.id)
            router.back()
          },
        },
      ],
    )
  }, [goblin, deleteGoblin])

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
              <Image source={getGoblinImage(goblin.avatar)} style={styles.profileAvatarImage} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{goblin.name}</Text>
              <Text style={styles.profileRace}>{goblin.race}</Text>
              <Text style={styles.profileLevel}>Lv.{goblin.level}</Text>
            </View>
          </View>
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.sectionTitle}>ステータス</Text>
          <View style={styles.statGrid}>
            {([
              { key: 'hp', label: 'HP' },
              { key: 'atk', label: 'ATK' },
              { key: 'def', label: 'DEF' },
              { key: 'spd', label: 'SPD' },
              { key: 'sp', label: 'SP' },
              { key: 'attackCount', label: '攻撃回数' },
              { key: 'accuracy', label: '命中精度' },
              { key: 'evasion', label: '回避' },
            ] as const).map(item => (
              <View key={item.key} style={styles.statChip}>
                <Text style={styles.statChipLabel}>{item.label}</Text>
                <Text style={styles.statChipValue}>{effectiveStats[item.key]}</Text>
              </View>
            ))}
          </View>
        </View>

        {characterSkills.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>スキル</Text>
            <View style={styles.abilityList}>
              {characterSkills.map((skill, idx) => (
                <View key={`${skill.id}-${idx}`} style={styles.abilityItem}>
                  <Text style={styles.abilityName}>{skill.name}</Text>
                  <Text style={styles.abilityDesc}>{describeCharacterSkill(skill)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.detailSection}>
          <Text style={styles.sectionTitle}>経験値</Text>
          <View style={styles.expCard}>
            <View style={styles.expRow}>
              <Text style={styles.expLabel}>EXP</Text>
              <Text style={styles.expValue}>{goblin.experience} / {expForNext}</Text>
            </View>
            <View style={styles.expBarTrack}>
              <View style={[styles.expBarFill, { width: `${Math.max(0, Math.min(1, expProgress)) * 100}%` }]} />
            </View>
            <Text style={styles.expHint}>次のレベルまで: {Math.max(0, expForNext - goblin.experience)}</Text>
          </View>
        </View>

        {goblin.factors && goblin.factors.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>因子</Text>
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
                      <Text style={styles.factorName}>{factor.name}</Text>
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
            <Text style={styles.sectionTitle}>Mod</Text>
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
              <Text style={styles.equipmentButtonText}>装備変更</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.banishButton} onPress={handleBanish}>
              <Text style={styles.banishButtonText}>このゴブリンを追放する</Text>
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
