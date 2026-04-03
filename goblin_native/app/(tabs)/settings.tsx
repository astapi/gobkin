import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useReset } from '@/presentation/contexts/ResetContext'

export default function SettingsScreen() {
  const [isResetting, setIsResetting] = useState(false)
  const { resetAndReinitialize } = useReset()

  const handleResetData = () => {
    Alert.alert(
      'データリセット',
      'すべてのデータを初期化します。この操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'リセット',
          style: 'destructive',
          onPress: () => {
            setIsResetting(true)
            void resetAndReinitialize()
          },
        },
      ],
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Debug</Text>
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleResetData}
            disabled={isResetting}
          >
            <Text style={styles.dangerButtonText}>
              {isResetting ? 'リセット中...' : 'データリセット（SQLite）'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.hint}>
            すべてのゴブリン・パーティ・遠征データを削除し、初期状態に戻します。
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  dangerButton: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7280',
  },
})
