import { Tabs } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ListIcon from '../../assets/list.svg'
import HenseiIcon from '../../assets/hensei.svg'
import BaseIcon from '../../assets/base.svg'

interface TabIconProps {
  Icon: React.FC<{ width: number; height: number; fill?: string }>
  color: string
}

function TabIcon({ Icon, color }: TabIconProps) {
  return (
    <View style={styles.iconContainer}>
      <Icon width={24} height={24} fill={color} />
    </View>
  )
}

export default function TabLayout() {
  const insets = useSafeAreaInsets()
  const basePadding = 8
  const baseHeight = 60
  const safeAreaPadding = Math.max(basePadding, insets.bottom)
  return (
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
          title: 'List',
          headerTitle: 'Goblin List',
          headerShown: false,
          tabBarIcon: ({ color }) => <TabIcon Icon={ListIcon} color={color} />,
        }}
      />
      <Tabs.Screen
        name="formation"
        options={{
          title: 'Formation',
          headerTitle: 'Party Formation',
          headerShown: false,
          tabBarIcon: ({ color }) => <TabIcon Icon={HenseiIcon} color={color} />,
        }}
      />
      <Tabs.Screen
        name="base"
        options={{
          title: 'Base',
          headerTitle: 'Base Management',
          headerShown: false,
          tabBarIcon: ({ color }) => <TabIcon Icon={BaseIcon} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <View style={styles.iconContainer}>
              <Text style={{ fontSize: 20, color }}>&#9881;</Text>
            </View>
          ),
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
