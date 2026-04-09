import { useState, useCallback, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal, Pressable, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useBaseStore, selectRank } from '@/presentation/stores/useBaseStore'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { usePartyStore } from '@/presentation/stores/usePartyStore'
import { describeCharacterSkill } from '@/shared/data/characterSkills'
import { applyGoblinJob, canTrainGoblin, formatGoblinJobSkillName, getGoblinJobDefinitions, getGoblinJobDefinition, getGoblinJobSkillEntries, GOBLIN_TRAINING_UNLOCK_RANK } from '@/shared/data/goblinJobs'
import { getCharacterSkill } from '@/shared/data/skillCatalog'
import type { GoblinJob } from '@/shared/types'
import { getGoblinDisplayImage } from '@/shared/utils/goblinImages'

export default function BaseTrainingScreen() {
  const rank = useBaseStore(selectRank)
  const goblins = useGoblinStore((state) => state.goblins)
  const saveGoblin = useGoblinStore((state) => state.saveGoblin)
  const parties = usePartyStore((state) => state.parties)

  const [selectedGoblinId, setSelectedGoblinId] = useState<number | null>(null)
  const [selectedJob, setSelectedJob] = useState<GoblinJob | undefined>(undefined)
  const [isTraining, setIsTraining] = useState(false)
  const [isGoblinModalVisible, setIsGoblinModalVisible] = useState(false)

  const trainingUnlocked = rank >= GOBLIN_TRAINING_UNLOCK_RANK
  const jobDefinitions = useMemo(() => getGoblinJobDefinitions(), [])

  const trainableGoblins = useMemo(() => {
    return goblins
      .filter((goblin) => canTrainGoblin(goblin))
      .map((goblin) => {
        const assignedParty = parties.find((party) => party.memberIds.includes(goblin.id)) ?? null
        const isExpedition = assignedParty?.status === 'expedition'
        return { goblin, assignedParty, isExpedition }
      })
  }, [goblins, parties])

  const selectedGoblinEntry = useMemo(() => {
    if (!selectedGoblinId) return trainableGoblins[0] ?? null
    return trainableGoblins.find((entry) => entry.goblin.id === selectedGoblinId) ?? trainableGoblins[0] ?? null
  }, [selectedGoblinId, trainableGoblins])

  const activeGoblin = selectedGoblinEntry?.goblin ?? null
  const effectiveSelectedJob = selectedJob ?? activeGoblin?.job
  const selectedGoblinCurrentJob = activeGoblin?.job ? getGoblinJobDefinition(activeGoblin.job) : null

  const trainingStatusText = useMemo(() => {
    if (!trainingUnlocked) {
      return `拠点ランク${GOBLIN_TRAINING_UNLOCK_RANK}で訓練所が稼働します。`
    }
    if (trainableGoblins.length === 0) {
      return '訓練できる純ゴブリンがまだいません。'
    }
    if (selectedGoblinEntry?.isExpedition) {
      return `${selectedGoblinEntry.goblin.name}は遠征中のため訓練できません。`
    }
    return '純ゴブリンに専門役を与えられます。装備由来のスキルは維持されます。'
  }, [selectedGoblinEntry, trainableGoblins.length, trainingUnlocked])

  const handleTrainGoblin = useCallback(() => {
    if (!activeGoblin || !effectiveSelectedJob || selectedGoblinEntry?.isExpedition) return

    const nextJob = getGoblinJobDefinition(effectiveSelectedJob)
    Alert.alert(
      '訓練確認',
      `${activeGoblin.name}を${nextJob.name}として訓練しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '訓練する',
          onPress: async () => {
            setIsTraining(true)
            try {
              await saveGoblin(applyGoblinJob(activeGoblin, effectiveSelectedJob))
              Alert.alert('訓練完了', `${activeGoblin.name}は${nextJob.name}として訓練を終えました。`)
            } catch (error) {
              const message = error instanceof Error ? error.message : '訓練に失敗しました。'
              Alert.alert('訓練失敗', message)
            } finally {
              setIsTraining(false)
            }
          },
        },
      ]
    )
  }, [activeGoblin, effectiveSelectedJob, saveGoblin, selectedGoblinEntry?.isExpedition])

  const handleShowJobTips = useCallback((job: GoblinJob) => {
    const jobDefinition = getGoblinJobDefinition(job)
    const tipLines = getGoblinJobSkillEntries(job)
      .map((jobSkill) => `・${formatGoblinJobSkillName(jobSkill)}\n${describeCharacterSkill(getCharacterSkill(jobSkill.skillId))}`)
      .join('\n\n')

    Alert.alert(jobDefinition.name, tipLines)
  }, [])

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.headerEyebrow}>訓練所</Text>
          <Text style={styles.headerBody}>ゴブリンが訓練を行いジョブを得る事ができます</Text>
        </View>

        {!trainingUnlocked ? (
          <View style={styles.lockedPanel}>
            <Text style={styles.lockedTitle}>未開放</Text>
            <Text style={styles.lockedBody}>ゴブリン集落を制圧した後、拠点をランク2へ拡張すると専門訓練が可能になります。</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {activeGoblin ? (
              <>
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>訓練対象</Text>
                  <TouchableOpacity
                    style={styles.settingValue}
                    onPress={() => setIsGoblinModalVisible(true)}
                  >
                    <View style={styles.selectedGoblinSummary}>
                      <Image source={getGoblinDisplayImage({ ...activeGoblin, job: effectiveSelectedJob })} style={styles.selectedGoblinAvatar} />
                      <View style={styles.selectedGoblinSummaryText}>
                        <Text style={styles.settingValueText}>{activeGoblin.name}</Text>
                        <Text style={styles.settingValueDescription}>
                          {activeGoblin.race} / 現在: {selectedGoblinCurrentJob?.name ?? '未設定'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>

                <View style={styles.jobGrid}>
                  {jobDefinitions.map((job) => {
                    const isSelected = effectiveSelectedJob === job.id
                    return (
                      <TouchableOpacity
                        key={job.id}
                        style={[styles.jobCard, isSelected && styles.jobCardSelected]}
                        onPress={() => setSelectedJob(job.id)}
                      >
                        <View style={styles.jobCardHeader}>
                          <Text style={styles.jobCardTitle}>{job.name}</Text>
                          <TouchableOpacity
                            style={styles.jobTipsButton}
                            onPress={() => handleShowJobTips(job.id)}
                          >
                            <Text style={styles.jobTipsButtonText}>i</Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (!effectiveSelectedJob || selectedGoblinEntry?.isExpedition || isTraining) && styles.primaryButtonDisabled,
                  ]}
                  onPress={handleTrainGoblin}
                  disabled={!effectiveSelectedJob || selectedGoblinEntry?.isExpedition || isTraining}
                >
                  <Text style={styles.primaryButtonText}>
                    {isTraining ? '訓練中...' : effectiveSelectedJob ? `${activeGoblin.name}を訓練する` : 'ジョブを選択してください'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.helperText}>純ゴブリンが拠点にいれば、ここで専門役に育成できます。</Text>
            )}
          </View>
        )}

        <View style={styles.noteCard}>
          <Text style={styles.noteText}>・訓練はゴブリンのみ対象です。スライムゴブリン、ウルフゴブリンは訓練できません。</Text>
        </View>
      </ScrollView>

      <Modal
        transparent
        visible={isGoblinModalVisible}
        animationType="fade"
        onRequestClose={() => setIsGoblinModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsGoblinModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>訓練対象を選択</Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
              {trainableGoblins.length === 0 ? (
                <Text style={styles.modalEmptyText}>選択できるゴブリンがいません</Text>
              ) : (
                trainableGoblins.map(({ goblin, assignedParty, isExpedition }) => {
                  const isSelected = activeGoblin?.id === goblin.id
                  const jobName = goblin.job ? getGoblinJobDefinition(goblin.job).name : '未設定'
                  return (
                    <TouchableOpacity
                      key={goblin.id}
                      style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                      onPress={() => {
                        setSelectedGoblinId(goblin.id)
                        setSelectedJob(goblin.job)
                        setIsGoblinModalVisible(false)
                      }}
                    >
                      <Image source={getGoblinDisplayImage(goblin)} style={styles.modalAvatar} />
                      <View style={styles.modalOptionBody}>
                        <Text style={[styles.modalOptionTitle, isSelected && styles.modalOptionTitleSelected]}>
                          {goblin.name}
                        </Text>
                        <Text style={styles.modalOptionDescription}>
                          {goblin.race} / {jobName}
                        </Text>
                        {assignedParty && (
                          <Text style={styles.modalOptionDescription}>
                            {isExpedition ? `${assignedParty.name} で遠征中` : `${assignedParty.name} に編成中`}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  )
                })
              )}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setIsGoblinModalVisible(false)}>
              <Text style={styles.modalCloseButtonText}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
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
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerEyebrow: {
    fontSize: 12,
    color: '#6B7280',
  },
  headerBody: {
    fontSize: 13,
    lineHeight: 20,
    color: '#6B7280',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  lockedPanel: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    gap: 6,
  },
  lockedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  lockedBody: {
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
  },
  settingItem: {
    marginBottom: 2,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  settingValue: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedGoblinSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectedGoblinAvatar: {
    width: 36,
    height: 36,
    borderRadius: 4,
  },
  selectedGoblinSummaryText: {
    flex: 1,
    gap: 2,
  },
  settingValueText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  settingValueDescription: {
    fontSize: 12,
    color: '#6B7280',
  },
  jobGrid: {
    gap: 10,
  },
  jobCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    gap: 8,
  },
  jobCardSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
  },
  jobCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  jobCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  jobTipsButton: {
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobTipsButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
  },
  primaryButton: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
  noteCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    gap: 6,
  },
  noteText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modalList: {
    maxHeight: 420,
  },
  modalListContent: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 10,
  },
  modalEmptyText: {
    fontSize: 14,
    color: '#6B7280',
    paddingVertical: 8,
  },
  modalOption: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  modalOptionSelected: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  modalAvatar: {
    width: 40,
    height: 40,
    borderRadius: 4,
  },
  modalOptionBody: {
    flex: 1,
    gap: 2,
  },
  modalOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalOptionTitleSelected: {
    color: '#111827',
  },
  modalOptionDescription: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
  modalCloseButton: {
    margin: 20,
    marginTop: 0,
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
})
