import { Stack } from 'expo-router'
import { useTranslation } from 'react-i18next'

export default function FormationLayout() {
  const { t } = useTranslation()

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: t('ui.formation.layout.index'),
        }}
      />
      <Stack.Screen
        name="preparation"
        options={{
          title: t('ui.formation.layout.preparation'),
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="edit"
        options={{
          title: t('ui.formation.layout.edit'),
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="equipment-list"
        options={{
          title: t('ui.formation.layout.equipmentList'),
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="party-info"
        options={{
          title: t('ui.formation.layout.partyInfo'),
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="equipment"
        options={{
          title: t('ui.formation.layout.equipment'),
          presentation: 'formSheet',
        }}
      />
      <Stack.Screen
        name="playback"
        options={{
          title: t('ui.formation.layout.playback'),
          presentation: 'card',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="result"
        options={{
          title: t('ui.formation.layout.result'),
          presentation: 'card',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="log"
        options={{
          title: t('ui.formation.layout.log'),
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="battle-log"
        options={{
          title: t('ui.formation.layout.battleLog'),
          presentation: 'card',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="level-up-log"
        options={{
          title: t('ui.formation.layout.levelUpLog'),
          presentation: 'card',
          headerShown: false,
        }}
      />
    </Stack>
  )
}
