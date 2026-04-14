import type { ExpeditionMeta, ExpeditionReplay } from '../../shared/types'
import { ExpeditionEngine } from './ExpeditionEngine'

/**
 * 遅延計算ヘルパー
 * ExpeditionMeta から ExpeditionReplay を再計算する。
 * シードベースの決定論的計算のため、いつ実行しても同じ結果になる。
 */
export async function computeExpeditionReplay(meta: ExpeditionMeta): Promise<ExpeditionReplay> {
  const engine = new ExpeditionEngine(meta.seed)
  return engine.generateExpedition(
    meta.request,
    meta.departingGoblins,
    meta.rewardMultipliers,
  )
}
