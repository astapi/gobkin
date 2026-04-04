import { useMemo, useCallback, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useGoblinService } from '@/presentation/hooks/useGoblinService'
import type { Goblin } from '@/shared/types'
import { getFactor } from '@/shared/data/factors'
import { getGoblinImage } from '@/shared/utils/goblinImages'
import { getFactorImage } from '@/shared/utils/factorImages'
import { ModStatCalculator } from '@/core/services/ModStatCalculator'
import { getExpForNextLevel, getExpProgress } from '@/core/services/ExperienceSystem'
import { getModTemplate } from '@/shared/data/modPoolLoader'

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
  const { goblinId } = useLocalSearchParams<{ goblinId: string }>()
  const { getGoblinById, deleteGoblin } = useGoblinService()
  const [goblin, setGoblin] = useState<Goblin | null>(null)

  useEffect(() => {
    if (!goblinId) return
    void getGoblinById(parseInt(goblinId, 10))
      .then(setGoblin)
      .catch(() => setGoblin(null))
  }, [goblinId, getGoblinById])

  const effectiveStats = useMemo(
    () => goblin ? ModStatCalculator.calculate(goblin) : null,
    [goblin]
  )
  const expForNext = goblin ? getExpForNextLevel(goblin.level) : 0
  const expProgress = goblin ? getExpProgress(goblin.level, goblin.experience) : 0

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
      <Stack.Screen options={{ title: goblin.name, headerShown: true }} />
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
          <View style={styles.statList}>
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
              <View key={item.key} style={styles.statRow}>
                <Text style={styles.statRowLabel}>{item.label}</Text>
                <Text style={styles.statRowValue}>{effectiveStats[item.key]}</Text>
              </View>
            ))}
          </View>
        </View>

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
            {goblin.factors.map((factorId, idx) => {
              const factor = getFactor(factorId)
              if (!factor) return null
              const FactorIcon = getFactorImage(factorId)
              return (
                <View key={idx} style={styles.factorItem}>
                  <View style={styles.factorIconContainer}>
                    <FactorIcon width={24} height={24} />
                  </View>
                  <View style={styles.factorInfo}>
                    <Text style={styles.factorName}>{factor.name}</Text>
                    <Text style={styles.factorDesc}>{factor.description}</Text>
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
        )}

        {goblin.mods && goblin.mods.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Mod</Text>
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
        )}

        <TouchableOpacity style={styles.equipmentButton} onPress={handleOpenEquipment}>
          <Text style={styles.equipmentButtonText}>装備変更</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.banishButton} onPress={handleBanish}>
          <Text style={styles.banishButtonText}>このゴブリンを追放する</Text>
        </TouchableOpacity>
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
    padding: 16,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 16,
    backgroundColor: '#F3F4F6',
  },
  profileAvatarImage: {
    width: 52,
    height: 52,
    resizeMode: 'contain',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  profileRace: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  profileLevel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  detailSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  statList: {
    gap: 10,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  statRowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  statRowValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },
  expCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    padding: 12,
  },
  expRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  expLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  expValue: {
    fontSize: 13,
    color: '#6B7280',
  },
  expBarTrack: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  expBarFill: {
    height: '100%',
    backgroundColor: '#4B5563',
  },
  expHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  factorIconContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  factorInfo: {
    flex: 1,
  },
  factorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  factorDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  factorEffectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  factorEffectBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#DCFCE7',
  },
  factorEffectText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
  },
  modItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  modName: {
    fontSize: 14,
    color: '#1F2937',
  },
  modEffect: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  equipmentButton: {
    marginTop: 4,
    marginBottom: 12,
    backgroundColor: '#374151',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  equipmentButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  banishButton: {
    marginBottom: 24,
    backgroundColor: '#374151',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  banishButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
})
