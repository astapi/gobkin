import { ConfigurePartyUseCase } from '../ConfigurePartyUseCase'
import type { IPartyRepository } from '../../repositories'
import type { Party } from '../../../shared/types'

function createPartyRepository(initialParty: Party): IPartyRepository {
  let party = initialParty
  return {
    getParties: jest.fn(async () => [party]),
    getParty: jest.fn(async (id: number) => (id === party.id ? party : null)),
    saveParty: jest.fn(async (next: Party) => { party = next }),
    deleteParty: jest.fn(async () => {}),
    updatePartyStatus: jest.fn(async () => {}),
    getPartiesByStatus: jest.fn(async () => []),
    updateDungeonSettings: jest.fn(async () => {}),
    updateDungeonTier: jest.fn(async () => {}),
    updateFloorTarget: jest.fn(async () => {}),
    updateReturnPolicy: jest.fn(async () => {}),
  }
}

describe('ConfigurePartyUseCase.setAutoExpedition', () => {
  const baseParty: Party = {
    id: 1,
    name: 'PT1',
    memberIds: [1],
    status: 'idle',
    dungeonId: 'slime_cave',
    dungeonTier: 0,
    autoExpeditionDate: '2026-08-12',
    autoExpeditionUsedSec: 3600,
  }

  it('既存の周回使用量を維持して自動周回を有効化する', async () => {
    const repository = createPartyRepository(baseParty)
    const useCase = new ConfigurePartyUseCase(repository)

    const result = await useCase.setAutoExpedition(1, true)

    expect(result.autoExpeditionEnabled).toBe(true)
    expect(result.autoExpeditionDate).toBe('2026-08-12')
    expect(result.autoExpeditionUsedSec).toBe(3600)
    expect(result.autoExpeditionSessionId).toMatch(/^auto_1_/)
    expect(result.autoExpeditionSummary).toEqual({
      sessionId: result.autoExpeditionSessionId,
      runCount: 0,
      clearCount: 0,
      wipeoutCount: 0,
      retreatCount: 0,
      xpGained: 0,
      goldGained: 0,
      rewardItems: [],
      factorCount: 0,
      levelUps: [],
    })
  })

  it('進行中の遠征設定を変えずに自動周回だけを停止する', async () => {
    const repository = createPartyRepository({
      ...baseParty,
      status: 'expedition',
      autoExpeditionEnabled: true,
      autoExpeditionSessionId: 'session-a',
      autoExpeditionSummary: {
        sessionId: 'session-a',
        runCount: 2,
        xpGained: 100,
        goldGained: 50,
        rewardItems: [],
        factorCount: 0,
        levelUps: [],
      },
    })
    const useCase = new ConfigurePartyUseCase(repository)

    const result = await useCase.setAutoExpedition(1, false)

    expect(result.status).toBe('expedition')
    expect(result.autoExpeditionEnabled).toBe(false)
    expect(result.autoExpeditionSessionId).toBe('session-a')
    expect(result.autoExpeditionSummary?.runCount).toBe(2)
  })
})

describe('ConfigurePartyUseCase.acknowledgeAutoExpeditionSummary', () => {
  it('結果データを残したまま未確認のセッションIDだけをクリアする', async () => {
    const repository = createPartyRepository({
      id: 1,
      name: 'PT1',
      memberIds: [1],
      status: 'idle',
      autoExpeditionEnabled: false,
      autoExpeditionSessionId: 'session-a',
      autoExpeditionSummary: {
        sessionId: 'session-a',
        runCount: 2,
        xpGained: 100,
        goldGained: 50,
        rewardItems: [],
        factorCount: 0,
        levelUps: [],
      },
    })
    const useCase = new ConfigurePartyUseCase(repository)

    const result = await useCase.acknowledgeAutoExpeditionSummary(1)

    expect(result.autoExpeditionSessionId).toBeUndefined()
    expect(result.autoExpeditionSummary?.sessionId).toBe('session-a')
    expect(result.autoExpeditionSummary?.runCount).toBe(2)
  })

  it('自動周回中はセッションIDをクリアしない', async () => {
    const repository = createPartyRepository({
      id: 1,
      name: 'PT1',
      memberIds: [1],
      status: 'expedition',
      autoExpeditionEnabled: false,
      autoExpeditionSessionId: 'session-a',
    })
    const useCase = new ConfigurePartyUseCase(repository)

    const result = await useCase.acknowledgeAutoExpeditionSummary(1)

    expect(result.autoExpeditionSessionId).toBe('session-a')
  })
})
