import { useCallback, useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import type { ExpeditionRecord } from '../../shared/types'
import i18n from '../../shared/i18n'
import { useExpeditionStore } from '../stores/useExpeditionStore'

// フォアグラウンド時は通知バナー・バッジを表示しない（アプリ内で結果が見えるため）
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

function notificationId(expeditionId: string): string {
  return `expedition_${expeditionId}`
}

// 対象の帰還予定時刻までに帰還する予定のongoing遠征件数（対象自身含む）を算出
function calcBadgeCountForReturnAt(returnTime: Date, selfId: string): number {
  const records = useExpeditionStore.getState().expeditionRecords
  const targetMs = returnTime.getTime()
  let count = 1 // 自分自身
  for (const rec of records) {
    if (rec.id === selfId) continue
    if (rec.status !== 'ongoing') continue
    if (!rec.returnTime) continue
    if (rec.returnTime.getTime() <= targetMs) count += 1
  }
  return count
}

export function useExpeditionNotification() {
  const permissionGrantedRef = useRef(false)

  useEffect(() => {
    ;(async () => {
      const { status } = await Notifications.getPermissionsAsync()
      permissionGrantedRef.current = status === 'granted'
    })()
  }, [])

  /**
   * 遠征の帰還予定時刻にローカル通知をスケジュールする
   */
  const scheduleExpeditionNotification = useCallback(
    async (record: ExpeditionRecord) => {
      if (!permissionGrantedRef.current) return
      if (!record.returnTime) return

      const triggerSeconds = Math.max(
        1,
        Math.floor((record.returnTime.getTime() - Date.now()) / 1000),
      )

      const badge = calcBadgeCountForReturnAt(record.returnTime, record.id)

      await Notifications.scheduleNotificationAsync({
        identifier: notificationId(record.id),
        content: {
          title: i18n.t('ui.notification.expeditionTitle'),
          body: i18n.t('ui.notification.expeditionReturn', { partyName: record.partyName }),
          sound: true,
          badge,
        },
        trigger: Platform.OS === 'web'
          ? null
          : { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: triggerSeconds },
      })
    },
    [],
  )

  /**
   * フォアグラウンドで遠征完了を処理した場合、スケジュール済み通知をキャンセルする
   * アプリ内で処理した以上バッジに残す意味はないので合わせて0にする
   */
  const cancelExpeditionNotification = useCallback(async (expeditionId: string) => {
    await Notifications.cancelScheduledNotificationAsync(notificationId(expeditionId))
    if (Platform.OS !== 'web') {
      try {
        await Notifications.setBadgeCountAsync(0)
      } catch {
        // バッジクリア失敗は致命ではない
      }
    }
  }, [])

  return {
    scheduleExpeditionNotification,
    cancelExpeditionNotification,
  }
}
