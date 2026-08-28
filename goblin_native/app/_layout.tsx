import { useCallback, useEffect, useState } from 'react'
import { View, ActivityIndicator, Text, StyleSheet, Pressable, Platform, AppState } from 'react-native'
import { Stack, router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import * as Notifications from 'expo-notifications'
import { AuthProvider } from '@/presentation/contexts/AuthContext'
import { ResetProvider } from '@/presentation/contexts/ResetContext'
import { useDatabaseInit } from '@/presentation/hooks/useDatabaseInit'
import { useGoblinStore } from '@/presentation/stores/useGoblinStore'
import { usePartyStore } from '@/presentation/stores/usePartyStore'
import { useBaseStore } from '@/presentation/stores/useBaseStore'
import { useDungeonStore } from '@/presentation/stores/useDungeonStore'
import { useExpeditionStore } from '@/presentation/stores/useExpeditionStore'
import { useDebugSettingsStore } from '@/presentation/stores/useDebugSettingsStore'
import { usePurchaseStore } from '@/presentation/stores/usePurchaseStore'
import { useStoryStore } from '@/presentation/stores/useStoryStore'
import { useTutorialStore } from '@/presentation/stores/useTutorialStore'
import { StartScreen } from '@/presentation/components/StartScreen'
import { TutorialSpotlight } from '@/presentation/components/TutorialSpotlight'
import { TutorialFinale } from '@/presentation/components/TutorialFinale'
import { ExpeditionDropToastHost } from '@/presentation/components/ExpeditionDropToastHost'
import { ExpeditionAutomationHost } from '@/presentation/components/ExpeditionAutomationHost'
import { GameAgentSyncHost } from '@/presentation/components/GameAgentSyncHost'
import { GoblinBirthAutomationHost } from '@/presentation/components/GoblinBirthAutomationHost'
import { useGoblinBirthStore } from '@/presentation/stores/useGoblinBirthStore'
import { initializeI18n } from '@/shared/i18n'

export default function RootLayout() {
  const { t } = useTranslation()
  const { ready, error, reloadKey, resetAndReinitialize, reloadAfterImport } = useDatabaseInit()
  const [storesReady, setStoresReady] = useState(false)
  const [showLaunchStartScreen, setShowLaunchStartScreen] = useState(true)
  const [launchStartRequested, setLaunchStartRequested] = useState(false)
  const tutorialStep = useTutorialStore(state => state.step)
  const tutorialLoading = useTutorialStore(state => state.isLoading)
  const tutorialResultRecord = useExpeditionStore(state => (
    state.expeditionRecords.find(record => (
      record.dungeonId === 'slime_cave' &&
      record.status === 'completed' &&
      record.replay !== undefined
    ))
  ))
  const startupReady = ready && storesReady && !tutorialLoading

  useEffect(() => {
    if (!ready) {
      // リセットや再初期化中は読み込み中表示に戻す（古い値で描画されないように）
      setStoresReady(false)
      return
    }
    const init = async () => {
      await Promise.all([
        initializeI18n(),
        useGoblinStore.getState().initialize(),
        usePartyStore.getState().initialize(),
        useBaseStore.getState().initialize(),
        useDungeonStore.getState().initialize(),
        useExpeditionStore.getState().initialize(),
        useDebugSettingsStore.getState().initialize(),
        usePurchaseStore.getState().initialize(),
        useStoryStore.getState().initialize(),
        useTutorialStore.getState().initialize(),
        useGoblinBirthStore.getState().initialize(),
      ])
      // 通知パーミッション要求（ネイティブのみ）
      if (Platform.OS !== 'web') {
        const { status } = await Notifications.getPermissionsAsync()
        if (status !== 'granted') {
          await Notifications.requestPermissionsAsync({
            ios: { allowAlert: true, allowBadge: true, allowSound: true },
          })
        }
        // 起動時点でユーザーは既にアプリを見ているので、アプリアイコンのバッジはクリア
        try {
          await Notifications.setBadgeCountAsync(0)
        } catch {
          // バッジクリア失敗は致命ではない
        }
      }
      setStoresReady(true)
    }
    void init()
  }, [ready, reloadKey])

  // フォアグラウンド復帰時にアプリアイコンのバッジをクリア
  useEffect(() => {
    if (Platform.OS === 'web') return
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        Notifications.setBadgeCountAsync(0).catch(() => {
          // バッジクリア失敗は致命ではない
        })
      }
    })
    return () => subscription.remove()
  }, [])

  const handleLaunchStart = useCallback(() => {
    setLaunchStartRequested(true)
  }, [])

  useEffect(() => {
    if (!launchStartRequested || !startupReady) return

    const enterGame = async () => {
      if (tutorialStep === 'not_started') {
        await useTutorialStore.getState().advanceTo('read_prologue')
        router.replace('/(tabs)/story')
      } else if (tutorialStep === 'learn_factor' && tutorialResultRecord) {
        // 攻略完了直後に終了していた場合だけ、起動時にチュートリアル結果画面から再開する。
        router.replace({
          pathname: '/formation/result',
          params: {
            expeditionId: tutorialResultRecord.id,
            partyId: tutorialResultRecord.partyId.toString(),
          },
        })
      }
      setShowLaunchStartScreen(false)
      setLaunchStartRequested(false)
    }

    void enterGame()
  }, [launchStartRequested, startupReady, tutorialResultRecord, tutorialStep])

  if (error) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>DB init error: {error}</Text>
          <Pressable
            testID="root-reset-database"
            accessibilityRole="button"
            accessibilityLabel={t('ui.root.resetDatabase')}
            style={styles.resetButton}
            onPress={() => void resetAndReinitialize()}
          >
            <Text style={styles.resetButtonText}>{t('ui.root.resetDatabase')}</Text>
          </Pressable>
        </View>
      </SafeAreaProvider>
    )
  }

  if (showLaunchStartScreen) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StartScreen
            onStart={handleLaunchStart}
            starting={launchStartRequested}
          />
          <StatusBar style="light" />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    )
  }

  if (!ready || !storesReady || tutorialLoading) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>{t('ui.common.loading')}</Text>
        </View>
      </SafeAreaProvider>
    )
  }

  if (tutorialStep === 'not_started') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StartScreen
            onStart={() => {
              void useTutorialStore.getState().advanceTo('read_prologue').then(() => {
                router.replace('/(tabs)/story')
              })
            }}
          />
          <StatusBar style="light" />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ResetProvider
            resetAndReinitialize={resetAndReinitialize}
            reloadAfterImport={reloadAfterImport}
          >
              <ExpeditionAutomationHost />
              <GoblinBirthAutomationHost />
              <GameAgentSyncHost />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="base/upgrade"
                  options={{
                    headerShown: true,
                    headerStyle: { backgroundColor: '#FFFFFF' },
                    headerTitleStyle: { color: '#1F2937', fontWeight: 'bold' },
                    headerTintColor: '#6B7280',
                    headerBackTitle: t('ui.common.back'),
                    title: t('ui.root.baseUpgrade'),
                  }}
                />
                <Stack.Screen
                  name="base/grow-group"
                  options={{
                    headerShown: true,
                    headerStyle: { backgroundColor: '#FFFFFF' },
                    headerTitleStyle: { color: '#1F2937', fontWeight: 'bold' },
                    headerTintColor: '#6B7280',
                    headerBackTitle: t('ui.common.back'),
                    title: t('ui.root.growGoblinGroup'),
                  }}
                />
                <Stack.Screen
                  name="base/training"
                  options={{
                    headerShown: true,
                    headerStyle: { backgroundColor: '#FFFFFF' },
                    headerTitleStyle: { color: '#1F2937', fontWeight: 'bold' },
                    headerTintColor: '#6B7280',
                    headerBackTitle: t('ui.common.back'),
                    title: t('ui.root.training'),
                  }}
                />
                <Stack.Screen
                  name="base/healing"
                  options={{
                    headerShown: true,
                    headerStyle: { backgroundColor: '#FFFFFF' },
                    headerTitleStyle: { color: '#1F2937', fontWeight: 'bold' },
                    headerTintColor: '#6B7280',
                    headerBackTitle: t('ui.common.back'),
                    title: t('ui.root.healing'),
                  }}
                />
                <Stack.Screen
                  name="base/shop"
                  options={{
                    headerShown: true,
                    headerStyle: { backgroundColor: '#FFFFFF' },
                    headerTitleStyle: { color: '#1F2937', fontWeight: 'bold' },
                    headerTintColor: '#6B7280',
                    headerBackTitle: t('ui.common.back'),
                    title: t('ui.root.equipmentShop'),
                  }}
                />
                <Stack.Screen
                  name="base/warehouse"
                  options={{
                    headerShown: true,
                    headerStyle: { backgroundColor: '#FFFFFF' },
                    headerTitleStyle: { color: '#1F2937', fontWeight: 'bold' },
                    headerTintColor: '#6B7280',
                    headerBackTitle: t('ui.common.back'),
                    title: t('ui.root.warehouse'),
                  }}
                />
                <Stack.Screen
                  name="shop"
                  options={{
                    headerShown: true,
                    headerStyle: { backgroundColor: '#FFFFFF' },
                    headerTitleStyle: { color: '#1F2937', fontWeight: 'bold' },
                    headerTintColor: '#6B7280',
                    headerBackTitle: t('ui.common.back'),
                    title: t('ui.root.shop'),
                  }}
                />
                <Stack.Screen
                  name="goblin"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="ai-agent"
                  options={{
                    headerShown: true,
                    headerStyle: { backgroundColor: '#FFFFFF' },
                    headerTitleStyle: { color: '#1F2937', fontWeight: 'bold' },
                    headerTintColor: '#6B7280',
                    headerBackTitle: t('ui.common.back'),
                    title: t('ui.root.aiAgent'),
                  }}
                />
                <Stack.Screen
                  name="encyclopedia-detail/[dungeonId]"
                  options={{
                    headerShown: true,
                    headerStyle: { backgroundColor: '#FFFFFF' },
                    headerTitleStyle: { color: '#1F2937', fontWeight: 'bold' },
                    headerTintColor: '#6B7280',
                    headerBackTitle: t('ui.common.back'),
                    title: t('ui.encyclopedia.title'),
                  }}
                />
                <Stack.Screen
                  name="encyclopedia-detail/[dungeonId]/[enemyId]"
                  options={{
                    headerShown: true,
                    headerStyle: { backgroundColor: '#FFFFFF' },
                    headerTitleStyle: { color: '#1F2937', fontWeight: 'bold' },
                    headerTintColor: '#6B7280',
                    headerBackTitle: t('ui.common.back'),
                    title: t('ui.encyclopedia.title'),
                  }}
                />
              </Stack>
              <StatusBar style="auto" />
              <ExpeditionDropToastHost />
            </ResetProvider>
        </AuthProvider>
        <TutorialSpotlight />
        <TutorialFinale />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  errorText: {
    textAlign: 'center',
    color: '#DC2626',
    marginBottom: 12,
  },
  resetButton: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#374151',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
})
