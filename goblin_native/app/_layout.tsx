import { View, ActivityIndicator, Text, StyleSheet, Pressable } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from '@/presentation/contexts/AuthContext'
import { ExpeditionStateProvider } from '@/presentation/contexts/ExpeditionStateContext'
import { ResetProvider } from '@/presentation/contexts/ResetContext'
import { useDatabaseInit } from '@/presentation/hooks/useDatabaseInit'

export default function RootLayout() {
  const { ready, error, resetAndReinitialize } = useDatabaseInit()

  if (error) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>DB init error: {error}</Text>
          <Pressable style={styles.resetButton} onPress={() => void resetAndReinitialize()}>
            <Text style={styles.resetButtonText}>Reset Database</Text>
          </Pressable>
        </View>
      </SafeAreaProvider>
    )
  }

  if (!ready) {
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
            <ResetProvider resetAndReinitialize={resetAndReinitialize}>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="goblin" />
              </Stack>
              <StatusBar style="auto" />
            </ResetProvider>
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
