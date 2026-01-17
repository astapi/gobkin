import { Tabs } from 'expo-router'
import { Text, View, StyleSheet } from 'react-native'

function TabIcon({ name, color }: { name: string; color: string }) {
  return (
    <View style={styles.iconContainer}>
      <Text style={[styles.icon, { color }]}>{name}</Text>
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
          tabBarIcon: ({ color }) => <TabIcon name="G" color={color} />,
        }}
      />
      <Tabs.Screen
        name="formation"
        options={{
          title: 'Formation',
          headerTitle: 'Party Formation',
          tabBarIcon: ({ color }) => <TabIcon name="P" color={color} />,
        }}
      />
      <Tabs.Screen
        name="base"
        options={{
          title: 'Base',
          headerTitle: 'Base Management',
          tabBarIcon: ({ color }) => <TabIcon name="B" color={color} />,
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
  icon: {
    fontSize: 16,
    fontWeight: 'bold',
  },
})
