import { useCallback, useId, useRef } from 'react'
import type { View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useTutorialOverlayStore, type SpotlightPlacement } from '../stores/useTutorialOverlayStore'
import { useTutorialStore } from '../stores/useTutorialStore'
import type { TutorialStep } from '../../shared/types/Tutorial'

interface UseTutorialTargetParams {
  /** このステップ群のときに自分をターゲットとして登録する */
  activeOn: readonly TutorialStep[]
  messageKey: string
  placement?: SpotlightPlacement
  /** ターゲット領域のパディング(px) */
  padding?: number
}

/**
 * チュートリアル中にスポットを当てたい要素へ付ける ref を返す。
 * 画面フォーカス中かつ該当ステップのときのみ位置測定し、
 * 自分の id でグローバル overlay store にエントリを登録する。
 */
export const useTutorialTarget = <T extends View = View>({
  activeOn,
  messageKey,
  placement = 'auto',
  padding = 6,
}: UseTutorialTargetParams) => {
  const ref = useRef<T | null>(null)
  const entryId = useId()
  const setEntry = useTutorialOverlayStore(state => state.setEntry)
  const clearEntry = useTutorialOverlayStore(state => state.clearEntry)

  useFocusEffect(
    useCallback(() => {
      let cancelled = false

      const measure = () => {
        if (cancelled) return
        const step = useTutorialStore.getState().step
        if (!activeOn.includes(step)) return
        const node = ref.current
        if (!node) return
        const anyNode = node as unknown as {
          measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void
        }
        anyNode.measureInWindow?.((x, y, w, h) => {
          if (cancelled || w === 0 || h === 0) return
          setEntry({
            id: entryId,
            rect: {
              x: x - padding,
              y: y - padding,
              width: w + padding * 2,
              height: h + padding * 2,
            },
            messageKey,
            placement,
            forStep: step,
          })
        })
      }

      const timers = [
        setTimeout(measure, 0),
        setTimeout(measure, 80),
        setTimeout(measure, 240),
        setTimeout(measure, 600),
      ]

      let lastStep = useTutorialStore.getState().step
      const unsubscribe = useTutorialStore.subscribe((state) => {
        if (state.step !== lastStep) {
          lastStep = state.step
          measure()
        }
      })

      return () => {
        cancelled = true
        timers.forEach(clearTimeout)
        unsubscribe()
        clearEntry(entryId)
      }
    }, [activeOn, messageKey, placement, padding, entryId, setEntry, clearEntry]),
  )

  return ref
}
