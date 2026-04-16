import { useCallback, useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import type { ExpeditionRecord } from '../../shared/types'
import i18n from '../../shared/i18n'

// フォアグラウンド時は通知バナーを表示しない（アプリ内で結果が見えるため）
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

      await Notifications.scheduleNotificationAsync({
        identifier: notificationId(record.id),
        content: {
          title: i18n.t('ui.notification.expeditionTitle'),
          body: i18n.t('ui.notification.expeditionReturn', { partyName: record.partyName }),
          sound: true,
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
   */
  const cancelExpeditionNotification = useCallback(async (expeditionId: string) => {
    await Notifications.cancelScheduledNotificationAsync(notificationId(expeditionId))
  }, [])

  return {
    scheduleExpeditionNotification,
    cancelExpeditionNotification,
  }
}
