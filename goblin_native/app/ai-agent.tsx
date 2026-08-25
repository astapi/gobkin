import { memo, useCallback } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import type { GameAgentLogEntry } from '@/core/agent'
import {
  type GameAgentConnectionStatus,
  useGameAgentStore,
} from '@/presentation/stores/useGameAgentStore'

const STATUS_COLORS: Record<GameAgentConnectionStatus, string> = {
  disabled: '#6B7280',
  connecting: '#D97706',
  connected: '#16A34A',
  disconnected: '#DC2626',
}

interface LogRowProps {
  entry: GameAgentLogEntry
}

const LogRow = memo(function LogRow({ entry }: LogRowProps) {
  const time = new Date(entry.completedAt).toLocaleTimeString()
  const statusColor = entry.status === 'completed'
    ? '#16A34A'
    : entry.status === 'rejected'
      ? '#D97706'
      : '#DC2626'

  return (
    <View style={styles.logCard}>
      <View style={styles.logHeader}>
        <Text style={styles.logTime}>{time}</Text>
        <Text style={[styles.logStatus, { color: statusColor }]}>{entry.status}</Text>
      </View>
      <Text style={styles.logAction}>{entry.actionType ?? 'unknown'}</Text>
      <Text style={styles.logSummary}>{entry.summary}</Text>
      {entry.reason ? <Text style={styles.logReason}>AI: {entry.reason}</Text> : null}
      <Text style={styles.logId}>{entry.actionId}</Text>
    </View>
  )
})

export default function GameAgentScreen() {
  const { t } = useTranslation()
  const connectionStatus = useGameAgentStore(state => state.connectionStatus)
  const bridgeUrl = useGameAgentStore(state => state.bridgeUrl)
  const revision = useGameAgentStore(state => state.revision)
  const lastSnapshotAt = useGameAgentStore(state => state.lastSnapshotAt)
  const logs = useGameAgentStore(state => state.logs)
  const requestReconnect = useGameAgentStore(state => state.requestReconnect)
  const clearLogs = useGameAgentStore(state => state.clearLogs)

  const renderLog = useCallback(({ item }: { item: GameAgentLogEntry }) => (
    <LogRow entry={item} />
  ), [])

  const statusLabel = t(`ui.aiAgent.status.${connectionStatus}`)
  const lastSyncLabel = lastSnapshotAt
    ? new Date(lastSnapshotAt).toLocaleTimeString()
    : t('ui.aiAgent.notSynced')

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <FlatList
        data={logs}
        keyExtractor={item => `${item.actionId}:${item.completedAt}`}
        renderItem={renderLog}
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <>
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[connectionStatus] }]} />
                <Text style={styles.statusText}>{statusLabel}</Text>
              </View>
              <Text style={styles.bridgeUrl}>{bridgeUrl ?? t('ui.aiAgent.noBridgeUrl')}</Text>
              <Text style={styles.metaText}>
                {t('ui.aiAgent.snapshotMeta', { revision, time: lastSyncLabel })}
              </Text>
              <Text style={styles.description}>{t('ui.aiAgent.description')}</Text>
              <View style={styles.buttonRow}>
                <Pressable style={styles.primaryButton} onPress={requestReconnect}>
                  <Text style={styles.primaryButtonText}>{t('ui.aiAgent.reconnect')}</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={clearLogs}>
                  <Text style={styles.secondaryButtonText}>{t('ui.aiAgent.clearLogs')}</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.sectionTitle}>{t('ui.aiAgent.actionLog')}</Text>
          </>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>{t('ui.aiAgent.emptyLog')}</Text>}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  statusCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  bridgeUrl: {
    color: '#374151',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 6,
  },
  metaText: {
    color: '#6B7280',
    fontSize: 12,
    marginBottom: 12,
  },
  description: {
    color: '#4B5563',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 9,
    backgroundColor: '#2563EB',
    paddingVertical: 11,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#9CA3AF',
    paddingVertical: 11,
  },
  secondaryButtonText: {
    color: '#374151',
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#1F2937',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  logCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 12,
    marginBottom: 8,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  logTime: {
    color: '#6B7280',
    fontSize: 11,
  },
  logStatus: {
    fontSize: 11,
    fontWeight: '700',
  },
  logAction: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  logSummary: {
    color: '#1F2937',
    fontSize: 13,
    lineHeight: 19,
  },
  logReason: {
    color: '#4B5563',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  logId: {
    color: '#9CA3AF',
    fontSize: 10,
    marginTop: 6,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 32,
  },
})

