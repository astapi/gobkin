import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import {
  getGoblinDisplayImage,
  getGoblinImageKey,
  getGoblinImageOptionsForJob,
} from '@/shared/utils/goblinImages'
import type { Goblin } from '@/shared/types'

export default function GoblinAvatarScreen() {
  const { goblinId } = useLocalSearchParams<{ goblinId: string }>()
  const goblins = useGoblinStore((state) => state.goblins)
  const getGoblinById = useGoblinStore((state) => state.getGoblinById)
  const saveGoblin = useGoblinStore((state) => state.saveGoblin)
  const [isSaving, setIsSaving] = useState(false)
  const [loadedGoblin, setLoadedGoblin] = useState<Goblin | null>(null)

  const parsedGoblinId = useMemo(() => {
    if (!goblinId) return null
    const parsed = parseInt(goblinId, 10)
    return Number.isNaN(parsed) ? null : parsed
  }, [goblinId])

  const storeGoblin = useMemo(() => (
    parsedGoblinId == null
      ? null
      : goblins.find((item) => item.id === parsedGoblinId) ?? null
  ), [goblins, parsedGoblinId])

  const goblin = storeGoblin ?? loadedGoblin
  const imageOptions = useMemo(() => getGoblinImageOptionsForJob(goblin?.job), [goblin?.job])
  const selectedImageKey = useMemo(() => {
    const imageKey = getGoblinImageKey(goblin?.avatar)
    return imageOptions.some(option => option.key === imageKey)
      ? imageKey
      : imageOptions[0]?.key
  }, [goblin, imageOptions])

  useEffect(() => {
    if (parsedGoblinId == null || storeGoblin || loadedGoblin) return
    let active = true
    void getGoblinById(parsedGoblinId)
      .then((nextGoblin) => {
        if (active) setLoadedGoblin(nextGoblin)
      })
      .catch(() => {
        if (active) setLoadedGoblin(null)
      })

    return () => {
      active = false
    }
  }, [getGoblinById, loadedGoblin, parsedGoblinId, storeGoblin])

  const handleSelect = useCallback((avatar: string) => {
    if (!goblin || isSaving || goblin.avatar === avatar) return

    setIsSaving(true)
    void saveGoblin({ ...goblin, avatar })
      .then(() => router.back())
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : '画像の保存に失敗しました。'
        Alert.alert('画像変更エラー', message)
      })
      .finally(() => setIsSaving(false))
  }, [goblin, isSaving, saveGoblin])

  if (!goblin) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>ゴブリンが見つかりません。</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (imageOptions.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>この職業は画像変更に対応していません。</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <View style={styles.currentCard}>
          <Image source={getGoblinDisplayImage(goblin)} style={styles.currentImage} />
        </View>

        <View style={styles.optionGrid}>
          {imageOptions.map(option => {
            const selected = option.key === selectedImageKey
            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.optionCard,
                  selected && styles.optionCardSelected,
                ]}
                activeOpacity={0.75}
                disabled={isSaving}
                onPress={() => handleSelect(option.avatar)}
              >
                <Image source={option.source} style={styles.optionImage} />
              </TouchableOpacity>
            )
          })}
        </View>
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
    padding: 16,
    gap: 16,
  },
  currentCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 18,
  },
  currentImage: {
    width: 104,
    height: 104,
    resizeMode: 'contain',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionCard: {
    width: '30.5%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionCardSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
  },
  optionImage: {
    width: '76%',
    height: '76%',
    resizeMode: 'contain',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
})
