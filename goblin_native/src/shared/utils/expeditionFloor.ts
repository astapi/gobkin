import type { ExpeditionRecord } from '../types'

/**
 * 進行中の遠征について、現在時刻時点で到達している階層を計算する。
 * リプレイは出発時に最後まで先に計算済みのため、summary.maxFloorReached を
 * そのまま使うと「最終到達階層」が表示されてしまうため、経過時間に対応する
 * イベントだけを走査して階層を求める。
 */
export function computeCurrentFloor(record: ExpeditionRecord, now: Date): number {
  const replay = record.replay
  if (!replay || !record.returnTime) return 1
  const startMs = record.startTime.getTime()
  const returnMs = record.returnTime.getTime()
  const totalMs = returnMs - startMs
  if (totalMs <= 0) return 1
  const elapsedRatio = Math.min(1, Math.max(0, (now.getTime() - startMs) / totalMs))
  const cutoffSec = elapsedRatio * replay.durationSec
  let floor = 1
  for (const event of replay.events) {
    if (event.at > cutoffSec) break
    if (event.type === 'floor_up') {
      floor = Math.max(floor, event.to)
    } else if (
      event.type === 'battle' ||
      event.type === 'boss' ||
      event.type === 'exploring' ||
      event.type === 'treasure' ||
      event.type === 'move_start'
    ) {
      floor = Math.max(floor, event.floor)
    }
  }
  return floor
}
