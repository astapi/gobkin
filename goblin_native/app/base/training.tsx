import { useState, useCallback, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal, Pressable, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useBaseStore, selectRank } from '@/presentation/stores/useBaseStore'
import { useDungeonStore } from '@/presentation/stores/useDungeonStore'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { usePartyStore } from '@/presentation/stores/usePartyStore'
import { useStoryStore } from '@/presentation/stores/useStoryStore'
import { describeCharacterSkill } from '@/shared/data/characterSkills'
import { applyGoblinJob, canTrainGoblin, formatGoblinJobSkillName, getGoblinTrainingJobDefinitions, getGoblinJobDefinition, getGoblinJobSkillEntries, GOBLIN_TRAINING_UNLOCK_RANK } from '@/shared/data/goblinJobs'
import { getCharacterSkill } from '@/shared/data/skillCatalog'
import type { GoblinJob } from '@/shared/types'
import { getGoblinJobLabel, getRaceLabel } from '@/shared/i18n/entityLocalization'
import { getGoblinDisplayImage } from '@/shared/utils/goblinImages'

export default function BaseTrainingScreen() {
  const { t, i18n } = useTranslation()
  const rank = useBaseStore(selectRank)
  const goblins = useGoblinStore((state) => state.goblins)
  const saveGoblin = useGoblinStore((state) => state.saveGoblin)
  const parties = usePartyStore((state) => state.parties)
  const dungeonProgress = useDungeonStore((state) => state.progress)
  const stories = useStoryStore((state) => state.stories)

  const [selectedGoblinId, setSelectedGoblinId] = useState<number | null>(null)
  const [selectedJob, setSelectedJob] = useState<GoblinJob | undefined>(undefined)
  const [isTraining, setIsTraining] = useState(false)
  const [isGoblinModalVisible, setIsGoblinModalVisible] = useState(false)

  const trainingUnlocked = rank >= GOBLIN_TRAINING_UNLOCK_RANK
  const clearedAreaIds = useMemo(() => new Set(
    Object.entries(dungeonProgress)
      .filter(([, progress]) => progress.cleared)
      .map(([areaId]) => areaId)
  ), [dungeonProgress])
  const readStoryIds = useMemo(() => new Set(
    stories
      .filter((story) => story.read)
      .map((story) => story.id)
  ), [stories])
  const jobDefinitions = useMemo(
    () => getGoblinTrainingJobDefinitions(clearedAreaIds, readStoryIds),
    [clearedAreaIds, i18n.resolvedLanguage, readStoryIds]
  )

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
      return t('ui.training.statusLocked', { rank: GOBLIN_TRAINING_UNLOCK_RANK })
    }
    if (trainableGoblins.length === 0) {
      return t('ui.training.statusNoTrainable')
    }
    if (selectedGoblinEntry?.isExpedition) {
      return t('ui.training.statusExpedition', { name: selectedGoblinEntry.goblin.name })
    }
    return t('ui.training.statusReady')
  }, [selectedGoblinEntry, t, trainableGoblins.length, trainingUnlocked])

  const handleTrainGoblin = useCallback(() => {
    if (!activeGoblin || !effectiveSelectedJob || selectedGoblinEntry?.isExpedition) return

    const nextJob = getGoblinJobDefinition(effectiveSelectedJob)
    Alert.alert(
      t('ui.training.confirmTitle'),
      t('ui.training.confirmBody', { name: activeGoblin.name, jobName: nextJob.name }),
      [
        { text: t('ui.common.cancel'), style: 'cancel' },
        {
          text: t('ui.training.trainAction'),
          onPress: async () => {
            setIsTraining(true)
            try {
              await saveGoblin(applyGoblinJob(activeGoblin, effectiveSelectedJob))
              setSelectedGoblinId(null)
              setSelectedJob(undefined)
              Alert.alert(t('ui.training.successTitle'), t('ui.training.successBody', { name: activeGoblin.name, jobName: nextJob.name }))
            } catch (error) {
              const message = error instanceof Error ? error.message : t('ui.training.failureBody')
              Alert.alert(t('ui.training.failureTitle'), message)
            } finally {
              setIsTraining(false)
            }
          },
        },
      ]
    )
  }, [activeGoblin, effectiveSelectedJob, saveGoblin, selectedGoblinEntry?.isExpedition, t])

  const handleShowJobTips = useCallback((job: GoblinJob) => {
    const jobDefinition = getGoblinJobDefinition(job)
    const tipLines = getGoblinJobSkillEntries(job)
      .map((jobSkill) => `${t('ui.training.jobTipBullet')} ${formatGoblinJobSkillName(jobSkill)}\n${describeCharacterSkill(getCharacterSkill(jobSkill.skillId))}`)
      .join('\n\n')

    Alert.alert(jobDefinition.name, tipLines)
  }, [t])

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.headerEyebrow}>{t('ui.training.title')}</Text>
          <Text style={styles.headerBody}>{t('ui.training.headerBody')}</Text>
        </View>

        {!trainingUnlocked ? (
          <View style={styles.lockedPanel}>
            <Text style={styles.lockedTitle}>{t('ui.training.lockedTitle')}</Text>
            <Text style={styles.lockedBody}>{t('ui.training.lockedBody')}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {activeGoblin ? (
              <>
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>{t('ui.training.targetLabel')}</Text>
                  <TouchableOpacity
                    style={styles.settingValue}
                    onPress={() => setIsGoblinModalVisible(true)}
                  >
                    <View style={styles.selectedGoblinSummary}>
                      <Image source={getGoblinDisplayImage({ ...activeGoblin, job: effectiveSelectedJob })} style={styles.selectedGoblinAvatar} />
                      <View style={styles.selectedGoblinSummaryText}>
                        <Text style={styles.settingValueText}>{activeGoblin.name}</Text>
                        <Text style={styles.settingValueDescription}>
                          {t('ui.training.currentJobLine', {
                            race: getRaceLabel(activeGoblin.raceId ?? activeGoblin.race),
                            jobName: selectedGoblinCurrentJob?.name ?? t('ui.training.unassigned'),
                          })}
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
                            <Text style={styles.jobTipsButtonText}>{t('ui.training.jobTipsButton')}</Text>
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
                    {isTraining
                      ? t('ui.training.processing')
                      : effectiveSelectedJob
                        ? t('ui.training.trainButton', { name: activeGoblin.name })
                        : t('ui.training.selectJobPlaceholder')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.helperText}>{trainingStatusText}</Text>
            )}
          </View>
        )}

        <View style={styles.noteCard}>
          <Text style={styles.noteText}>{t('ui.training.noteGoblinOnly')}</Text>
          <Text style={styles.noteText}>{t('ui.training.noteJobLocked')}</Text>
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
            <Text style={styles.modalTitle}>{t('ui.training.modalTitle')}</Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
              {trainableGoblins.length === 0 ? (
                <Text style={styles.modalEmptyText}>{t('ui.training.modalEmpty')}</Text>
              ) : (
                trainableGoblins.map(({ goblin, assignedParty, isExpedition }) => {
                  const isSelected = activeGoblin?.id === goblin.id
                  const jobName = goblin.job ? getGoblinJobLabel(goblin.job) : t('ui.training.unassigned')
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
                          {t('ui.training.modalGoblinLine', {
                            race: getRaceLabel(goblin.raceId ?? goblin.race),
                            jobName,
                          })}
                        </Text>
                        {assignedParty && (
                          <Text style={styles.modalOptionDescription}>
                            {isExpedition
                              ? t('ui.training.partyExpeditionStatus', { partyName: assignedParty.name })
                              : t('ui.training.partyAssignedStatus', { partyName: assignedParty.name })}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  )
                })
              )}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setIsGoblinModalVisible(false)}>
              <Text style={styles.modalCloseButtonText}>{t('ui.common.close')}</Text>
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
