import type { ExpeditionReplay } from '../../types'
import { addAutoExpeditionResult, createAutoExpeditionSummary } from '../autoExpeditionSummary'

function createReplay(
  summary: Partial<ExpeditionReplay['summary']>,
  reason: 'completed' | 'defeated' | 'policy_return' = 'completed',
): ExpeditionReplay {
  return {
    meta: {
      expeditionId: 'exp1',
      areaId: 'slime_cave',
      areaName: 'スライムの洞窟',
      floors: 3,
      baseDurationSec: 60,
      party: ['1'],
      partyRewardMultipliers: { gold: 1, rare: 1, title: 1 },
      returnPolicy: 'never',
      seed: 1,
    },
    durationSec: 60,
    events: [{ type: 'return', at: 60, reason }],
    summary: {
      success: true,
      maxFloorReached: 3,
      xpGained: 0,
      goldGained: 0,
      casualties: [],
      ...summary,
    },
  }
}

describe('addAutoExpeditionResult', () => {
  it('周回数・経験値・Gold・装備・因子を累計する', () => {
    let summary = createAutoExpeditionSummary('session-a')
    summary = addAutoExpeditionResult(summary, 'session-a', createReplay({
      xpGained: 100,
      goldGained: 40,
      treasureDrops: [{ templateId: 'club' }, { templateId: 'club' }],
      factorAcquisitions: [{ goblinId: 1, factorIds: ['slime', 'fire'] }],
    }))
    summary = addAutoExpeditionResult(summary, 'session-a', createReplay({
      xpGained: 80,
      goldGained: 30,
      treasureDrops: [{ templateId: 'robe' }],
    }))

    expect(summary).toEqual({
      sessionId: 'session-a',
      runCount: 2,
      clearCount: 2,
      wipeoutCount: 0,
      retreatCount: 0,
      xpGained: 180,
      goldGained: 70,
      rewardItems: [
        { templateId: 'club', count: 2 },
        { templateId: 'robe', count: 1 },
      ],
      factorCount: 2,
      levelUps: [],
    })
  })

  it('クリア・全滅・退却を帰還理由ごとに集計する', () => {
    let summary = addAutoExpeditionResult(
      undefined,
      'session-a',
      createReplay({ success: true }, 'completed'),
    )
    summary = addAutoExpeditionResult(
      summary,
      'session-a',
      createReplay({ success: false, casualties: ['1'] }, 'defeated'),
    )
    summary = addAutoExpeditionResult(
      summary,
      'session-a',
      createReplay({ success: false }, 'policy_return'),
    )

    expect(summary.runCount).toBe(3)
    expect(summary.clearCount).toBe(1)
    expect(summary.wipeoutCount).toBe(1)
    expect(summary.retreatCount).toBe(1)
  })

  it('結果別回数を持たない既存セーブへも安全に加算する', () => {
    const current = createAutoExpeditionSummary('session-a')
    delete current.clearCount
    delete current.wipeoutCount
    delete current.retreatCount

    const summary = addAutoExpeditionResult(
      current,
      'session-a',
      createReplay({ success: false, casualties: ['1'] }, 'defeated'),
    )

    expect(summary.clearCount).toBe(0)
    expect(summary.wipeoutCount).toBe(1)
    expect(summary.retreatCount).toBe(0)
  })

  it('複数周にまたがるレベルアップを開始Lvから最終Lvへまとめる', () => {
    let summary = addAutoExpeditionResult(undefined, 'session-a', createReplay({
      memberLevelUps: [{ goblinId: 1, oldLevel: 2, newLevel: 3 }],
    }))
    summary = addAutoExpeditionResult(summary, 'session-a', createReplay({
      memberLevelUps: [
        { goblinId: 1, oldLevel: 3, newLevel: 5 },
        { goblinId: 2, oldLevel: 4, newLevel: 5 },
      ],
    }))

    expect(summary.levelUps).toEqual([
      { goblinId: 1, oldLevel: 2, newLevel: 5 },
      { goblinId: 2, oldLevel: 4, newLevel: 5 },
    ])
  })

  it('別セッションの累計は引き継がない', () => {
    const previous = addAutoExpeditionResult(undefined, 'session-a', createReplay({ goldGained: 100 }))
    const next = addAutoExpeditionResult(previous, 'session-b', createReplay({ goldGained: 20 }))

    expect(next.sessionId).toBe('session-b')
    expect(next.runCount).toBe(1)
    expect(next.goldGained).toBe(20)
  })
})
