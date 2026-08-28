import { Stack } from 'expo-router'
import { useTranslation } from 'react-i18next'

export default function GoblinLayout() {
  const { t } = useTranslation()
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTitleStyle: { color: '#1F2937', fontWeight: 'bold' },
        headerTintColor: '#6B7280',
        headerBackTitle: t('ui.common.back'),
        headerBackButtonDisplayMode: 'generic',
      }}
    >
      <Stack.Screen
        name="detail"
        options={{ title: t('ui.root.goblinDetail') }}
      />
      <Stack.Screen
        name="equipment"
        options={{
          title: t('ui.root.equipmentChange'),
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="avatar"
        options={{
          title: '画像変更',
          presentation: 'formSheet',
        }}
      />
    </Stack>
  )
}
