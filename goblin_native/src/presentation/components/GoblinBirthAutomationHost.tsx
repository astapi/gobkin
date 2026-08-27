import { useEffect, useMemo } from 'react'
import { AppState } from 'react-native'
import { useBaseStore } from '../stores/useBaseStore'
import { useGoblinBirthStore } from '../stores/useGoblinBirthStore'

/** 画面に依存せず、時間経過した継続誕生枠を精算する常駐ホスト。 */
export function GoblinBirthAutomationHost() {
  const slots = useGoblinBirthStore((state) => state.slots)
  const pendingCount = useBaseStore((state) => state.pendingGoblins.length)
  const rank = useBaseStore((state) => state.baseState?.rank ?? 1)
  const nearestBirthAt = useMemo(() => {
    const timestamps = slots
      .filter((slot) => slot.isActive && !slot.capacityPausedAt && slot.nextBirthAt)
      .map((slot) => Date.parse(slot.nextBirthAt!))
      .filter(Number.isFinite)
    return timestamps.length > 0 ? Math.min(...timestamps) : undefined
  }, [slots])

  useEffect(() => {
    if (nearestBirthAt === undefined || pendingCount >= rank * 5) return
    const delay = Math.max(0, nearestBirthAt - Date.now())
    const timer = setTimeout(() => {
      void useGoblinBirthStore.getState().settleDueBirths()
    }, Math.min(delay, 2_147_000_000))
    return () => clearTimeout(timer)
  }, [nearestBirthAt, pendingCount, rank])

  useEffect(() => {
    void useGoblinBirthStore.getState()
      .syncCapacityPause(pendingCount >= rank * 5)
      .catch((error) => console.warn('[GoblinBirthAutomationHost] Failed to sync capacity pause', error))
  }, [pendingCount, rank])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void useGoblinBirthStore.getState().settleDueBirths()
      }
    })
    return () => subscription.remove()
  }, [])

  return null
}
