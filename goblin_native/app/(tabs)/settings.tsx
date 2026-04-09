import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useReset } from '@/presentation/contexts/ResetContext'
import { useDebugSettingsStore } from '@/presentation/stores/useDebugSettingsStore'

export default function SettingsScreen() {
  const { t } = useTranslation()
  const [isResetting, setIsResetting] = useState(false)
  const { resetAndReinitialize } = useReset()
  const instantDungeonExploration = useDebugSettingsStore((state) => state.instantDungeonExploration)
  const setInstantDungeonExploration = useDebugSettingsStore((state) => state.setInstantDungeonExploration)

  const handleResetData = () => {
    Alert.alert(
      t('ui.settings.resetConfirmTitle'),
      t('ui.settings.resetConfirmBody'),
      [
        { text: t('ui.common.cancel'), style: 'cancel' },
        {
          text: t('ui.settings.resetAction'),
          style: 'destructive',
          onPress: () => {
            setIsResetting(true)
            void resetAndReinitialize()
          },
        },
      ],
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('ui.settings.title')}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('ui.settings.debug')}</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingTextBlock}>
              <Text style={styles.settingTitle}>{t('ui.settings.instantExplorationTitle')}</Text>
              <Text style={styles.settingDescription}>{t('ui.settings.instantExplorationDescription')}</Text>
            </View>
            <Switch
              value={instantDungeonExploration}
              onValueChange={(value) => {
                void setInstantDungeonExploration(value)
              }}
            />
          </View>

          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleResetData}
            disabled={isResetting}
          >
            <Text style={styles.dangerButtonText}>
              {isResetting ? t('ui.settings.resetting') : t('ui.settings.resetButton')}
            </Text>
          </TouchableOpacity>
          <Text style={styles.hint}>{t('ui.settings.resetHint')}</Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  settingTextBlock: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
  dangerButton: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7280',
  },
})
