import { useEffect, useState } from 'react'
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from '@/presentation/contexts/AuthContext'
import { ExpeditionStateProvider } from '@/presentation/contexts/ExpeditionStateContext'
import { getDatabase } from '@/infrastructure/database'
import { SQLiteDungeonProgressRepository } from '@/infrastructure/repositories/SQLiteDungeonProgressRepository'
import { SQLiteGoblinRepository } from '@/infrastructure/repositories/SQLiteGoblinRepository'
import { SQLitePartyRepository } from '@/infrastructure/repositories/SQLitePartyRepository'
import { SQLiteBaseStateRepository } from '@/infrastructure/repositories/SQLiteBaseStateRepository'
import { SQLiteExpeditionRepository } from '@/infrastructure/repositories/SQLiteExpeditionRepository'
import { SQLitePendingGoblinRepository } from '@/infrastructure/repositories/SQLitePendingGoblinRepository'
import { areasData } from '@/shared/data'

export default function RootLayout() {
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    // アプリ起動時にDBとリポジトリを初期化
    const initializeApp = async () => {
      try {
        // 第1段階: DBインスタンスの初期化（マイグレーション実行）
        console.log('[RootLayout] Initializing database...')

        await getDatabase()
        console.log('[RootLayout] Database initialized')

        // 第2段階: 全リポジトリの初期化（キャッシュの初期化）
        console.log('[RootLayout] Initializing repositories...')

        // 各リポジトリを並列で初期化
        await Promise.all([
          SQLiteGoblinRepository.getInstance().initialize(),
          SQLitePartyRepository.getInstance().initialize(),
          SQLiteBaseStateRepository.getInstance().initialize(),
          SQLiteExpeditionRepository.getInstance().initialize(),
          SQLitePendingGoblinRepository.getInstance().initialize(),
          SQLiteDungeonProgressRepository.getInstance().initialize(),
        ])

        // ダンジョン進行状況のデフォルトデータを保存
        const dungeonProgressRepo = SQLiteDungeonProgressRepository.getInstance()
        const storedProgress = dungeonProgressRepo.getAll()
        areasData.forEach((dungeon, index) => {
          if (!storedProgress[dungeon.id]) {
            dungeonProgressRepo.save(dungeon.id, {
              unlocked: dungeon.unlocked ?? index === 0,
              cleared: dungeon.cleared ?? false,
              unlockNotified: false,
            })
          }
        })

        console.log('[RootLayout] All repositories initialized successfully')
        setIsInitialized(true)
      } catch (error) {
        console.error('[RootLayout] Failed to initialize app:', error)
      }
    }
    initializeApp()
  }, [])

  // 初期化完了まではローディング画面を表示
  if (!isInitialized) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      </SafeAreaProvider>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ExpeditionStateProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
            </Stack>
            <StatusBar style="auto" />
          </ExpeditionStateProvider>
        </AuthProvider>
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
})
