import { useCallback, useMemo, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useStoryStore } from '@/presentation/stores/useStoryStore'

export default function StoryReaderScreen() {
  const { t } = useTranslation()
  const { storyId } = useLocalSearchParams<{ storyId: string }>()
  const stories = useStoryStore((state) => state.stories)
  const markStoryRead = useStoryStore((state) => state.markStoryRead)
  const [hasMarkedRead, setHasMarkedRead] = useState(false)

  const story = useMemo(() => {
    return stories.find(s => s.id === storyId) ?? null
  }, [stories, storyId])

  const handleComplete = useCallback(async () => {
    if (!story || hasMarkedRead) return
    await markStoryRead(story.id)
    setHasMarkedRead(true)
  }, [story, hasMarkedRead, markStoryRead])

  const handleSkip = useCallback(() => {
    Alert.alert(
      t('ui.story.skipTitle'),
      t('ui.story.skipMessage'),
      [
        { text: t('ui.common.cancel'), style: 'cancel' },
        {
          text: t('ui.story.skipConfirm'),
          onPress: () => void handleComplete(),
        },
      ]
    )
  }, [handleComplete, t])

  if (!story) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('ui.story.notFound')}</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{t('ui.common.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const isAlreadyRead = story.read || hasMarkedRead

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.navBack}>← {t('ui.common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{story.title}</Text>
        {!isAlreadyRead ? (
          <TouchableOpacity onPress={handleSkip}>
            <Text style={styles.skipButton}>{t('ui.story.skip')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.navSpacer} />
        )}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.storyTitle}>{story.title}</Text>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>
            {story.category === 'main' ? t('ui.story.mainStory') : t('ui.story.sideStory')}
          </Text>
        </View>

        <View style={styles.divider} />

        {story.chapters.map((chapter, index) => (
          <View key={chapter.id}>
            <Text style={styles.chapterText}>{chapter.text}</Text>
            {index < story.chapters.length - 1 && <View style={styles.chapterDivider} />}
          </View>
        ))}

        <View style={styles.divider} />

        {!isAlreadyRead ? (
          <TouchableOpacity style={styles.completeButton} onPress={() => void handleComplete()}>
            <Text style={styles.completeButtonText}>{t('ui.story.complete')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.readBadgeContainer}>
            <Text style={styles.readBadge}>{t('ui.story.alreadyRead')}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.returnButton} onPress={() => router.back()}>
          <Text style={styles.returnButtonText}>{t('ui.common.back')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  navBack: {
    fontSize: 14,
    color: '#374151',
  },
  navTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  navSpacer: {
    width: 60,
  },
  skipButton: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  storyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  categoryBadge: {
    alignSelf: 'center',
    marginTop: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 24,
  },
  chapterText: {
    fontSize: 15,
    lineHeight: 26,
    color: '#374151',
  },
  chapterDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 20,
  },
  completeButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  completeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  readBadgeContainer: {
    alignItems: 'center',
  },
  readBadge: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  backButton: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  returnButton: {
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 12,
    alignItems: 'center',
  },
  returnButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
})
