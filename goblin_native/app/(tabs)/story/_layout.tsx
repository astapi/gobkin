import { Stack } from 'expo-router'

export default function StoryLayout() {
  return (
    <Stack
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="reader" />
    </Stack>
  )
}
