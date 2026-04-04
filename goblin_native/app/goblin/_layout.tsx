import { Stack } from 'expo-router'

export default function GoblinLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="detail" />
      <Stack.Screen
        name="equipment"
        options={{
          headerShown: true,
          title: '装備変更',
          presentation: 'modal',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTitleStyle: { color: '#1F2937', fontWeight: 'bold' },
          headerTintColor: '#6B7280',
        }}
      />
    </Stack>
  )
}
