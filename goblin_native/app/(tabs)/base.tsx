import { useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { useBaseState } from '@/presentation/hooks/useBaseState'
import { usePendingGoblins } from '@/presentation/hooks/usePendingGoblins'
import { useGoblinService } from '@/presentation/hooks/useGoblinService'
import { getGoblinImage } from '@/shared/utils/goblinImages'
import { getFactorImage } from '@/shared/utils/factorImages'
import { getModTemplate } from '@/shared/data/modPoolLoader'
import { ModStatCalculator } from '@/core/services/ModStatCalculator'

const STAT_LABELS: Record<string, string> = {
  hp_percent: 'HP',
  hp_flat: 'HP',
  atk_percent: 'ATK',
  atk_flat: 'ATK',
  def_percent: 'DEF',
  def_flat: 'DEF',
  spd_percent: 'SPD',
  sp_percent: 'SP',
  sp_flat: 'SP',
  damage_reduction: '被ダメ軽減',
}

function getStatLabel(stat: string): string {
  return STAT_LABELS[stat] || stat
}

export default function BaseManagementScreen() {
  const { isLoading: baseLoading, rank, capacity } = useBaseState()
  const { pendingGoblins, isLoading: pendingLoading, removePendingGoblin, refreshPendingGoblins } = usePendingGoblins()
  const { goblins, saveGoblin } = useGoblinService()

  const [selectedGoblinIds, setSelectedGoblinIds] = useState<Set<number>>(new Set())

  const currentGoblinCount = goblins.length
  const availableSlots = Math.max(0, capacity - currentGoblinCount)
  const maxPendingGoblins = rank * 5
  const selectedCount = selectedGoblinIds.size
  const canAddSelected = selectedCount > 0 && selectedCount <= availableSlots

  const toggleGoblinSelection = useCallback((goblinId: number) => {
    setSelectedGoblinIds(prev => {
      const next = new Set(prev)
      if (next.has(goblinId)) {
        next.delete(goblinId)
      } else {
        next.add(goblinId)
      }
      return next
    })
  }, [])

  const addSelectedGoblins = useCallback(() => {
    if (!canAddSelected) return
    const selectedGoblins = pendingGoblins.filter(g => selectedGoblinIds.has(g.id))
    selectedGoblins.forEach(goblin => {
      saveGoblin(goblin)
      removePendingGoblin(goblin.id)
    })
    setSelectedGoblinIds(new Set())
  }, [canAddSelected, pendingGoblins, selectedGoblinIds, saveGoblin, removePendingGoblin])

  const dismissSelectedGoblins = useCallback(() => {
    if (selectedCount === 0) return
    const selectedGoblins = pendingGoblins.filter(g => selectedGoblinIds.has(g.id))
    selectedGoblins.forEach(goblin => {
      removePendingGoblin(goblin.id)
    })
    setSelectedGoblinIds(new Set())
  }, [pendingGoblins, selectedGoblinIds, selectedCount, removePendingGoblin])

  useFocusEffect(
    useCallback(() => {
      refreshPendingGoblins()
    }, [refreshPendingGoblins])
  )

  if (baseLoading || pendingLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.screenTitle}>拠点管理</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>拠点ステータス</Text>
          <View style={styles.statusGrid}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>拠点ランク</Text>
              <View style={styles.statusValueBox}>
                <Text style={styles.statusValueText}>{rank}</Text>
              </View>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>収容数</Text>
              <View style={styles.statusValueBox}>
                <Text style={styles.statusValueText}>{capacity}</Text>
              </View>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>現在のゴブリン</Text>
              <Text style={styles.statusValuePlain}>{currentGoblinCount} / {capacity}</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>空き枠</Text>
              <Text style={styles.statusValuePlain}>{availableSlots}</Text>
            </View>
          </View>
        </View>

        {pendingGoblins.length > 0 && (
          <View style={styles.card}>
            <View style={styles.pendingHeader}>
              <View style={styles.pendingTitleRow}>
                <Text style={styles.cardTitle}>追加されたゴブリン</Text>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>{pendingGoblins.length} / {maxPendingGoblins}体</Text>
                </View>
              </View>
              {selectedCount > 0 && (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.dismissButton} onPress={dismissSelectedGoblins}>
                    <Text style={styles.dismissButtonText}>解雇する ({selectedCount})</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addButton, !canAddSelected && styles.addButtonDisabled]}
                    onPress={addSelectedGoblins}
                    disabled={!canAddSelected}
                  >
                    <Text style={[styles.addButtonText, !canAddSelected && styles.addButtonTextDisabled]}>
                      拠点に加える ({selectedCount})
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <Text style={styles.pendingDescription}>
              遠征成功により新しいゴブリンが見つかりました。拠点に加えるか、解雇するゴブリンを選択してください。
            </Text>
            <View style={styles.pendingList}>
              {pendingGoblins.map(goblin => {
                const isSelected = selectedGoblinIds.has(goblin.id)
                const effectiveStats = ModStatCalculator.calculate(goblin)
                const hasMods = goblin.mods && goblin.mods.length > 0
                const hasFactors = goblin.factors && goblin.factors.length > 0
                return (
                  <TouchableOpacity
                    key={goblin.id}
                    style={[styles.pendingCard, isSelected && styles.pendingCardSelected]}
                    onPress={() => toggleGoblinSelection(goblin.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.pendingRow}>
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <Text style={styles.checkboxMark}>✓</Text>}
                      </View>
                      <Image source={getGoblinImage(goblin.avatar)} style={styles.pendingAvatar} />
                      <View style={styles.pendingInfo}>
                        <Text style={styles.pendingName} numberOfLines={1}>{goblin.name}</Text>
                        <Text style={styles.pendingStats}>
                          HP{effectiveStats.hp} / A{effectiveStats.atk} / D{effectiveStats.def} / S{effectiveStats.spd} / SP{effectiveStats.sp}
                        </Text>
                      </View>
                    </View>
                    {(hasFactors || hasMods) && (
                      <View style={styles.pendingExtras}>
                        {hasFactors && (
                          <View style={styles.factorRow}>
                            {goblin.factors!.map((factorId, index) => {
                              const FactorIcon = getFactorImage(factorId)
                              return (
                                <View key={`${factorId}-${index}`} style={styles.factorBadge}>
                                  <FactorIcon width={14} height={14} />
                                </View>
                              )
                            })}
                          </View>
                        )}
                        {hasMods && (
                          <View style={styles.modRow}>
                            {goblin.mods!.map((mod, index) => {
                              const template = getModTemplate(mod.templateId)
                              if (!template) return null
                              const isPercent = template.stat.includes('percent') || template.stat === 'damage_reduction'
                              const label = `${getStatLabel(template.stat)}+${mod.value}${isPercent ? '%' : ''}`
                              const isPrefix = template.type === 'prefix'
                              return (
                                <View
                                  key={`${mod.templateId}-${index}`}
                                  style={[styles.modBadge, isPrefix ? styles.modBadgeBlue : styles.modBadgePurple]}
                                >
                                  <Text style={[styles.modBadgeText, isPrefix ? styles.modBadgeTextBlue : styles.modBadgeTextPurple]}>
                                    {label}
                                  </Text>
                                </View>
                              )
                            })}
                          </View>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        )}

        <View style={styles.noteCard}>
          <Text style={styles.noteText}>• 遠征成功時にゴブリンが1体追加されます</Text>
          <Text style={styles.noteText}>• 追加されたゴブリンのリストは拠点ランク × 5体まで保持されます（現在: 最大{maxPendingGoblins}体）</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 32,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 12,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusItem: {
    flexBasis: '48%',
  },
  statusLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 6,
  },
  statusValueBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  statusValueText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  statusValuePlain: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  pendingHeader: {
    marginBottom: 8,
  },
  pendingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pendingBadge: {
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pendingBadgeText: {
    fontSize: 11,
    color: '#4B5563',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dismissButton: {
    flex: 1,
    backgroundColor: '#6B7280',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addButton: {
    flex: 1,
    backgroundColor: '#374151',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addButtonTextDisabled: {
    color: '#9CA3AF',
  },
  pendingDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 18,
  },
  pendingList: {
    gap: 8,
  },
  pendingCard: {
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  pendingCardSelected: {
    borderColor: '#6B7280',
    backgroundColor: '#F3F4F6',
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxSelected: {
    borderColor: '#4B5563',
    backgroundColor: '#4B5563',
  },
  checkboxMark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  pendingAvatar: {
    width: 40,
    height: 40,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  pendingStats: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  pendingExtras: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 6,
  },
  factorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  factorBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  modBadgeBlue: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  modBadgePurple: {
    backgroundColor: '#F5F3FF',
    borderColor: '#E9D5FF',
  },
  modBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  modBadgeTextBlue: {
    color: '#1D4ED8',
  },
  modBadgeTextPurple: {
    color: '#6D28D9',
  },
  noteCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
  },
  noteText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
})
