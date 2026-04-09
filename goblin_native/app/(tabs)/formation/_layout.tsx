import { Stack } from 'expo-router'

export default function FormationLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'パーティ編成',
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
        name="equipment-list"
        options={{
          title: '装備アイテムの一覧',
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="party-info"
        options={{
          title: 'PTの情報',
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="equipment"
        options={{
          title: '装備変更',
          presentation: 'formSheet',
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
          headerShown: false,
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
