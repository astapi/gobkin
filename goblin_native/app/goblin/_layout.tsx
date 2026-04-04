import { Stack } from 'expo-router'

export default function GoblinLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTitleStyle: { color: '#1F2937', fontWeight: 'bold' },
        headerTintColor: '#6B7280',
      }}
    >
      <Stack.Screen
        name="detail"
        options={{
          title: 'ゴブリン詳細',
        }}
      />
      <Stack.Screen
        name="equipment"
        options={{
          title: '装備変更',
          presentation: 'modal',
        }}
      />
    </Stack>
  )
}
