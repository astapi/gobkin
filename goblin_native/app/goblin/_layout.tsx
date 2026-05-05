import { Stack } from 'expo-router'
import { useTranslation } from 'react-i18next'

export default function GoblinLayout() {
  const { t } = useTranslation()
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
          title: t('ui.root.equipmentChange'),
          presentation: 'formSheet',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTitleStyle: { color: '#1F2937', fontWeight: 'bold' },
          headerTintColor: '#6B7280',
        }}
      />
      <Stack.Screen
        name="avatar"
        options={{
          headerShown: true,
          title: '画像変更',
          presentation: 'formSheet',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTitleStyle: { color: '#1F2937', fontWeight: 'bold' },
          headerTintColor: '#6B7280',
        }}
      />
    </Stack>
  )
}
