import { useMemo } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useDungeonStore } from '@/presentation/stores/useDungeonStore'
import { getDungeonName } from '@/shared/i18n/entityLocalization'

export default function EncyclopediaDungeonListScreen() {
  const { t } = useTranslation()
  const dungeons = useDungeonStore((state) => state.dungeons)
  const isLoading = useDungeonStore((state) => state.isLoading)
  const unlockedDungeons = useMemo(() => dungeons.filter((dungeon) => dungeon.unlocked), [dungeons])

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('ui.encyclopedia.title')}</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>{t('ui.common.loading')}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {unlockedDungeons.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>{t('ui.encyclopedia.empty')}</Text>
            </View>
          ) : (
            unlockedDungeons.map((dungeon) => (
              <TouchableOpacity
                key={dungeon.id}
                style={styles.dungeonCard}
                activeOpacity={0.8}
                onPress={() => router.push(`/encyclopedia-detail/${dungeon.id}`)}
              >
                <Text style={styles.dungeonName}>{getDungeonName(dungeon)}</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D1D5DB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 13,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 12,
    gap: 8,
    paddingBottom: 32,
  },
  dungeonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dungeonName: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 20,
  },
})
