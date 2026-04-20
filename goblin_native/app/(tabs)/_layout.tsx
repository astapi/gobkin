import { memo } from 'react'
import { Tabs } from 'expo-router'
import { View, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import ListIcon from '../../assets/tab/tab_list.svg'
import HenseiIcon from '../../assets/tab/tab_hensei.svg'
import BaseIcon from '../../assets/tab/tab_base.svg'
import StoryIcon from '../../assets/tab/tab_story.svg'
import SettingIcon from '../../assets/tab/tab_setting.svg'
import { CurrentTimeBadge } from '@/presentation/components/CurrentTimeBadge'
import { GoldBadge } from '@/presentation/components/GoldBadge'
import { useStoryStore } from '@/presentation/stores/useStoryStore'

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

export default function TabLayout() {
  const { t } = useTranslation()
  const unreadCount = useStoryStore((state) => state.unreadCount)
  const insets = useSafeAreaInsets()
  const basePadding = 8
  const baseHeight = 60
  const safeAreaPadding = Math.max(basePadding, insets.bottom)
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
    <CurrentTimeBadge bottom={baseHeight + safeAreaPadding + 8} />
    <GoldBadge bottom={baseHeight + safeAreaPadding + 8} />
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
