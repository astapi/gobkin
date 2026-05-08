import { memo, useEffect, useMemo } from 'react'
import { Tabs, usePathname } from 'expo-router'
import { View, StyleSheet, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import ListIcon from '../../assets/tab/tab_list.svg'
import HenseiIcon from '../../assets/tab/tab_hensei.svg'
import BaseIcon from '../../assets/tab/tab_base.svg'
import StoryIcon from '../../assets/tab/tab_story.svg'
import SettingIcon from '../../assets/tab/tab_setting.svg'
import { CurrentTimeBadge } from '@/presentation/components/CurrentTimeBadge'
import { GoldBadge } from '@/presentation/components/GoldBadge'
import { GoldenAcornBadge } from '@/presentation/components/GoldenAcornBadge'
import { TipsBar, TIPS_BAR_HEIGHT } from '@/presentation/components/TipsBar'
import { useStoryStore } from '@/presentation/stores/useStoryStore'
import { useTutorialStore } from '@/presentation/stores/useTutorialStore'
import { useTutorialOverlayStore } from '@/presentation/stores/useTutorialOverlayStore'
import tipsData from '@/shared/data/tips.json'
import type { TutorialStep } from '@/shared/types/Tutorial'

interface TabIconProps {
  Icon: React.FC<{ width: number; height: number; fill?: string }>
  color: string
  size?: number
}

const TabIcon = memo(function TabIcon({ Icon, color, size = 24 }: TabIconProps) {
  return (
    <View style={styles.iconContainer}>
      <Icon width={size} height={size} fill={color} />
    </View>
  )
})

// (tabs)/_layout.tsx 内の Tabs.Screen 定義順と一致させる
const TAB_INDEX_BY_STEP: Partial<Record<TutorialStep, number>> = {
  // story=0, index=1, formation=2, base=3, settings=4
  see_first_goblin: 1,
  view_first_goblin: 2,
  open_formation: 2,
}

const TAB_MESSAGE_BY_STEP: Partial<Record<TutorialStep, string>> = {
  see_first_goblin: 'ui.tutorial.banner.afterPrologue',
  view_first_goblin: 'ui.tutorial.banner.openFormationTab',
  open_formation: 'ui.tutorial.banner.openFormationTab',
}

const FULL_SCREEN_MESSAGE_BY_STEP: Partial<Record<TutorialStep, string>> = {
  wait_clear: 'ui.tutorial.banner.waitClear',
}

const TAB_COUNT = 5
const FALLBACK_TIP_TEXT = 'ゴブリンたちは特定の敵から因子を獲得する可能性がある'

function pickTipText(): string {
  const tips = tipsData.tips.filter((tip) => tip.enabled && tip.text.trim().length > 0)
  if (tips.length === 0) return FALLBACK_TIP_TEXT
  const index = Math.floor(Math.random() * tips.length)
  return tips[index].text
}

export default function TabLayout() {
  const { t } = useTranslation()
  const pathname = usePathname()
  const tipText = useMemo(() => pickTipText(), [pathname])
  const unreadCount = useStoryStore((state) => state.unreadCount)
  const insets = useSafeAreaInsets()
  const basePadding = 8
  const baseHeight = 60
  const safeAreaPadding = Math.max(basePadding, insets.bottom)
  const tabBarHeight = baseHeight + safeAreaPadding
  const tipsBarBottom = tabBarHeight
  const badgeBottom = tabBarHeight + TIPS_BAR_HEIGHT + 8
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const tutorialStep = useTutorialStore((state) => state.step)
  const setEntry = useTutorialOverlayStore((state) => state.setEntry)
  const clearEntry = useTutorialOverlayStore((state) => state.clearEntry)
  const tabEntryId = 'tutorial-tabs-spotlight'

  useEffect(() => {
    const fullScreenMessageKey = FULL_SCREEN_MESSAGE_BY_STEP[tutorialStep]
    if (fullScreenMessageKey) {
      setEntry({
        id: tabEntryId,
        rect: null,
        messageKey: fullScreenMessageKey,
        placement: 'auto',
        forStep: tutorialStep,
        allowThrough: false,
      })
      return () => {
        clearEntry(tabEntryId)
      }
    }

    const tabIndex = TAB_INDEX_BY_STEP[tutorialStep]
    const messageKey = TAB_MESSAGE_BY_STEP[tutorialStep]
    if (tabIndex === undefined || !messageKey) {
      clearEntry(tabEntryId)
      return
    }

    const tabWidth = screenWidth / TAB_COUNT
    setEntry({
      id: tabEntryId,
      rect: {
        x: tabIndex * tabWidth,
        y: screenHeight - tabBarHeight,
        width: tabWidth,
        height: tabBarHeight,
      },
      messageKey,
      placement: 'above',
      forStep: tutorialStep,
      allowThrough: true,
    })

    return () => {
      clearEntry(tabEntryId)
    }
  }, [tutorialStep, screenWidth, screenHeight, tabBarHeight, setEntry, clearEntry])
  return (
    <View style={styles.rootContainer}>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E7EB',
          paddingTop: 8,
          paddingBottom: safeAreaPadding,
          height: baseHeight + safeAreaPadding,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        sceneStyle: {
          paddingBottom: TIPS_BAR_HEIGHT,
        },
        headerShown: true,
        headerStyle: {
          backgroundColor: '#FFFFFF',
        },
        headerTitleStyle: {
          color: '#1F2937',
          fontWeight: 'bold',
        },
      }}
    >
      <Tabs.Screen
        name="story"
        options={{
          title: t('ui.tabs.story'),
          headerShown: false,
          tabBarIcon: ({ color }) => <TabIcon Icon={StoryIcon} color={color} size={30} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#7C3AED', fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: t('ui.tabs.goblinList'),
          headerTitle: t('ui.tabs.goblinList'),
          headerShown: false,
          tabBarIcon: ({ color }) => <TabIcon Icon={ListIcon} color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="formation"
        options={{
          title: t('ui.tabs.formation'),
          headerTitle: t('ui.tabs.formation'),
          headerShown: false,
          tabBarIcon: ({ color }) => <TabIcon Icon={HenseiIcon} color={color} />,
        }}
      />
      <Tabs.Screen
        name="base"
        options={{
          title: t('ui.tabs.base'),
          headerTitle: t('ui.tabs.base'),
          headerShown: false,
          tabBarIcon: ({ color }) => <TabIcon Icon={BaseIcon} color={color} size={40} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('ui.tabs.settings'),
          headerShown: false,
          tabBarIcon: ({ color }) => <TabIcon Icon={SettingIcon} color={color} />,
        }}
      />
    </Tabs>
    <TipsBar bottom={tipsBarBottom} text={tipText} />
    <CurrentTimeBadge bottom={badgeBottom} />
    <GoldenAcornBadge bottom={badgeBottom + 32} />
    <GoldBadge bottom={badgeBottom} />
    </View>
  )
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
