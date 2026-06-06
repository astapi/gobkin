import { forwardRef, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useStoryStore } from '@/presentation/stores/useStoryStore'
import { useTutorialTarget } from '@/presentation/hooks/useTutorialTarget'
import { BOTTOM_INFO_SPACING } from '@/shared/constants/layout'

export default function StoryTabScreen() {
  const { t } = useTranslation()
  const stories = useStoryStore((state) => state.stories)

  const mainStories = stories.filter(s => s.category === 'main' && s.unlocked)
  const sideStories = stories.filter(s => s.category === 'side' && s.unlocked)

  const prologueRef = useTutorialTarget<View>({
    activeOn: ['read_prologue'],
    messageKey: 'ui.tutorial.banner.readPrologue',
    placement: 'below',
  })

  const handleStoryPress = useCallback((storyId: string) => {
    router.push({ pathname: '/(tabs)/story/reader', params: { storyId } })
  }, [])

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.screenTitle}>{t('ui.story.title')}</Text>

        <Text style={styles.sectionTitle}>{t('ui.story.mainStory')}</Text>
        {mainStories.length === 0 ? (
          <Text style={styles.emptyText}>{t('ui.story.noStories')}</Text>
        ) : (
          mainStories.map(story => {
            const ref =
              story.id === 'prologue'
                ? prologueRef
                : undefined
            return (
              <StoryCard
                key={story.id}
                ref={ref}
                title={story.title}
                read={story.read}
                onPress={() => handleStoryPress(story.id)}
              />
            )
          })
        )}

        {sideStories.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, styles.sideSectionTitle]}>{t('ui.story.sideStory')}</Text>
            {sideStories.map(story => (
              <StoryCard
                key={story.id}
                title={story.title}
                read={story.read}
                onPress={() => handleStoryPress(story.id)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

interface StoryCardProps {
  title: string
  read: boolean
  onPress: () => void
}

const StoryCard = forwardRef<View, StoryCardProps>(function StoryCard({ title, read, onPress }, ref) {
  return (
    <View ref={ref} collapsable={false}>
      <TouchableOpacity style={styles.card} onPress={onPress}>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{title}</Text>
          {!read && <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>}
        </View>
        <Text style={styles.cardArrow}>→</Text>
      </TouchableOpacity>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: BOTTOM_INFO_SPACING,
    gap: 4,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    marginTop: 8,
  },
  sideSectionTitle: {
    marginTop: 20,
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  card: {
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    justifyContent: 'space-between',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  cardArrow: {
    fontSize: 16,
    color: '#7C3AED',
  },
  newBadge: {
    backgroundColor: '#7C3AED',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
})
