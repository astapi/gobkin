import type {
  AutoExpeditionSessionSummary,
  ExpeditionReplay,
} from '../types'
import { isSameEquipmentStack } from './equipmentModIdentity'

export function createAutoExpeditionSummary(sessionId: string): AutoExpeditionSessionSummary {
  return {
    sessionId,
    runCount: 0,
    clearCount: 0,
    wipeoutCount: 0,
    retreatCount: 0,
    xpGained: 0,
    goldGained: 0,
    rewardItems: [],
    factorCount: 0,
    levelUps: [],
  }
}

/** 確定した1周分の結果を自動周回セッションの累計へ加算する。 */
export function addAutoExpeditionResult(
  current: AutoExpeditionSessionSummary | undefined,
  sessionId: string,
  replay: ExpeditionReplay,
): AutoExpeditionSessionSummary {
  const base = current?.sessionId === sessionId
    ? current
    : createAutoExpeditionSummary(sessionId)
  const rewardItems = base.rewardItems.map(item => ({ ...item }))
  const levelUps = base.levelUps.map(item => ({ ...item }))

  for (const drop of replay.summary.treasureDrops ?? []) {
    const existing = rewardItems.find(item => isSameEquipmentStack(item, drop))
    if (existing) {
      existing.count += 1
    } else {
      rewardItems.push({ ...drop, count: 1 })
    }
  }

  for (const levelUp of replay.summary.memberLevelUps ?? []) {
    const existing = levelUps.find(item => item.goblinId === levelUp.goblinId)
    if (existing) {
      existing.newLevel = levelUp.newLevel
    } else {
      levelUps.push({ ...levelUp })
    }
  }

  const factorCount = (replay.summary.factorAcquisitions ?? [])
    .reduce((count, acquisition) => count + acquisition.factorIds.length, 0)
  const returnReason = [...replay.events].reverse()
    .find(event => event.type === 'return')?.reason
  const isClear = returnReason === 'completed' || (!returnReason && replay.summary.success)
  const isWipeout = returnReason === 'defeated' || (
    !returnReason &&
    !replay.summary.success &&
    replay.meta.party.length > 0 &&
    replay.summary.casualties.length >= replay.meta.party.length
  )
  const isRetreat = returnReason === 'policy_return' || (!returnReason && !isClear && !isWipeout)

  return {
    sessionId,
    runCount: base.runCount + 1,
    clearCount: (base.clearCount ?? 0) + (isClear ? 1 : 0),
    wipeoutCount: (base.wipeoutCount ?? 0) + (isWipeout ? 1 : 0),
    retreatCount: (base.retreatCount ?? 0) + (isRetreat ? 1 : 0),
    xpGained: base.xpGained + Math.max(0, replay.summary.xpGained),
    goldGained: base.goldGained
      + Math.max(0, replay.summary.goldGained)
      + Math.max(0, replay.summary.autoSoldGold ?? 0),
    rewardItems,
    factorCount: base.factorCount + factorCount,
    levelUps,
  }
}
