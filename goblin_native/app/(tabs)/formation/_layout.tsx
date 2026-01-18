import { Stack } from 'expo-router'

export default function FormationLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Parties',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="preparation"
        options={{
          title: 'Expedition Prep',
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="edit"
        options={{
          title: 'Edit Party',
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="playback"
        options={{
          title: 'Expedition',
          presentation: 'card',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="result"
        options={{
          title: 'Results',
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="log"
        options={{
          title: 'Expedition Log',
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="battle-log"
        options={{
          title: 'Battle Log',
          presentation: 'card',
          headerShown: false,
        }}
      />
    </Stack>
  )
}
