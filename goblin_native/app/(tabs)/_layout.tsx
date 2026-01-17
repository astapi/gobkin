import { Tabs } from 'expo-router'
import { View, StyleSheet } from 'react-native'
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
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E7EB',
          paddingTop: 8,
          paddingBottom: 8,
          height: 60,
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
          tabBarIcon: ({ color }) => <TabIcon Icon={ListIcon} color={color} />,
        }}
      />
      <Tabs.Screen
        name="formation"
        options={{
          title: 'Formation',
          headerTitle: 'Party Formation',
          tabBarIcon: ({ color }) => <TabIcon Icon={HenseiIcon} color={color} />,
        }}
      />
      <Tabs.Screen
        name="base"
        options={{
          title: 'Base',
          headerTitle: 'Base Management',
          tabBarIcon: ({ color }) => <TabIcon Icon={BaseIcon} color={color} />,
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
