import { useMemo } from 'react'
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { buildEnemyEntries } from '@/presentation/encyclopedia/encyclopediaData'
import { useDungeonStore } from '@/presentation/stores/useDungeonStore'
import { getDungeonName, getEnemyName } from '@/shared/i18n/entityLocalization'
import { getEnemyImage } from '@/shared/utils/enemyImages'

export default function EncyclopediaMonsterListScreen() {
  const { t } = useTranslation()
  const { dungeonId } = useLocalSearchParams<{ dungeonId: string }>()
  const dungeons = useDungeonStore((state) => state.dungeons)
  const dungeon = dungeons.find((entry) => entry.id === dungeonId && entry.unlocked)
  const enemyEntries = useMemo(
    () => dungeon ? buildEnemyEntries(dungeon.id) : [],
    [dungeon],
  )

  if (!dungeon) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <Stack.Screen options={{ title: t('ui.encyclopedia.title') }} />
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{t('ui.encyclopedia.empty')}</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: getDungeonName(dungeon) }} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {enemyEntries.map((entry) => {
          const image = getEnemyImage(entry.enemy)
          return (
            <TouchableOpacity
              key={entry.enemy.id}
              testID={`encyclopedia-enemy-${entry.enemy.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${getEnemyName(entry.enemy)}、${entry.isBoss ? t('ui.encyclopedia.boss') : t('ui.encyclopedia.normal')}、Lv.${entry.enemy.level}`}
              style={styles.enemyCard}
              activeOpacity={0.8}
              onPress={() => router.push(`/encyclopedia-detail/${dungeon.id}/${entry.enemy.id}`)}
            >
              <View style={styles.enemyThumb}>
                {image ? (
                  <Image source={image} style={styles.enemyThumbImage} resizeMode="contain" />
                ) : (
                  <Text style={styles.enemyThumbFallback}>?</Text>
                )}
              </View>
              <View style={styles.enemyTextBlock}>
                <Text style={styles.enemyName}>{getEnemyName(entry.enemy)}</Text>
                <Text style={styles.enemyMeta}>
                  {entry.isBoss ? t('ui.encyclopedia.boss') : t('ui.encyclopedia.normal')} / Lv.{entry.enemy.level}
                </Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 12,
    gap: 8,
    paddingBottom: 32,
  },
  enemyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  enemyThumb: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enemyThumbImage: {
    width: 38,
    height: 38,
  },
  enemyThumbFallback: {
    color: '#9CA3AF',
    fontSize: 22,
    fontWeight: '800',
  },
  enemyTextBlock: {
    flex: 1,
    gap: 2,
  },
  enemyName: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
  },
  enemyMeta: {
    color: '#6B7280',
    fontSize: 12,
  },
  emptyCard: {
    margin: 16,
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
