import { memo } from 'react'
import { Tabs } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import ListIcon from '../../assets/list.svg'
import HenseiIcon from '../../assets/hensei.svg'
import BaseIcon from '../../assets/base.svg'
import { CurrentTimeBadge } from '@/presentation/components/CurrentTimeBadge'
import { GoldBadge } from '@/presentation/components/GoldBadge'

interface TabIconProps {
  Icon: React.FC<{ width: number; height: number; fill?: string }>
  color: string
}

const TabIcon = memo(function TabIcon({ Icon, color }: TabIconProps) {
  return (
    <View style={styles.iconContainer}>
      <Icon width={24} height={24} fill={color} />
    </View>
  )
})

export default function TabLayout() {
  const { t } = useTranslation()
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
        name="index"
        options={{
          title: t('ui.tabs.goblinList'),
          headerTitle: t('ui.tabs.goblinList'),
          headerShown: false,
          tabBarIcon: ({ color }) => <TabIcon Icon={ListIcon} color={color} />,
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
          tabBarIcon: ({ color }) => <TabIcon Icon={BaseIcon} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('ui.tabs.settings'),
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <View style={styles.iconContainer}>
              <Text style={{ fontSize: 20, color }}>&#9881;</Text>
            </View>
          ),
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
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
