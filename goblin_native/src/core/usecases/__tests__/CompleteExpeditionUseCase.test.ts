import { CompleteExpeditionUseCase } from '../CompleteExpeditionUseCase'
import type { IGoblinRepository, IPartyRepository, IBaseStateRepository } from '../../repositories'
import type { Goblin, Party, BaseState, ExpeditionReplay } from '../../../shared/types'

// --- テストヘルパー ---

function createTestGoblin(overrides: Partial<Goblin> = {}): Goblin {
  return {
    id: 1,
    name: 'テストゴブリン',
    race: 'ゴブリン',
    level: 1,
    experience: 0,
    avatar: '/test.png',
    stats: { hp: 60, atk: 12, sp: 10, spd: 10, def: 10, attackCount: 2, accuracy: 20, evasion: 15 },
    mods: [],
    factors: [],
    ...overrides,
  }
}

function createTestParty(overrides: Partial<Party> = {}): Party {
  return {
    id: 1,
    name: 'テストパーティ',
    memberIds: [1],
    status: 'expedition',
    ...overrides,
  }
}

function createTestBaseState(overrides: Partial<BaseState> = {}): BaseState {
  return {
    capacity: 10,
    rank: 1,
    capturedDungeons: [],
    currentMaxParties: 2,
    currentMaxGoblins: 10,
    currentIVBonus: 0,
    gold: 100,
    ...overrides,
  }
}

function createTestReplay(overrides: Partial<ExpeditionReplay> = {}): ExpeditionReplay {
  return {
    meta: {
      expeditionId: 'exp-1',
      areaId: 'dungeon_1',
      areaName: 'テスト���ンジョン',
      floors: 3,
      baseDurationSec: 60,
      party: ['1'],
      returnPolicy: 'never',
      seed: 12345,
    },
    durationSec: 60,
    events: [
      { type: 'move_start', at: 0, floor: 1 },
      { type: 'return', at: 60, reason: 'completed' },
    ],
    summary: {
      success: true,
      maxFloorReached: 3,
      xpGained: 100,
      goldGained: 50,
      casualties: [],
    },
    ...overrides,
  }
}

// --- モックリポジトリ ---

function createMockGoblinRepository(goblins: Goblin[]): IGoblinRepository {
  const store = new Map(goblins.map(g => [g.id, { ...g }]))
  return {
    getGoblins: jest.fn(async () => [...store.values()]),
    getGoblin: jest.fn(async (id: number) => store.get(id) ?? null),
    saveGoblin: jest.fn(async (goblin: Goblin) => { store.set(goblin.id, { ...goblin }) }),
    deleteGoblin: jest.fn(async () => {}),
    updateGoblinStats: jest.fn(async () => {}),
    updateGoblinLevel: jest.fn(async () => {}),
  }
}

function createMockPartyRepository(parties: Party[]): IPartyRepository {
  const store = new Map(parties.map(p => [p.id, { ...p }]))
  return {
    getParties: jest.fn(async () => [...store.values()]),
    getParty: jest.fn(async (id: number) => store.get(id) ?? null),
    saveParty: jest.fn(async () => {}),
    deleteParty: jest.fn(async () => {}),
    updatePartyStatus: jest.fn(async () => {}),
    getPartiesByStatus: jest.fn(async () => []),
    updateDungeonSettings: jest.fn(async () => {}),
    updateFloorTarget: jest.fn(async () => {}),
    updateReturnPolicy: jest.fn(async () => {}),
  }
}

function createMockBaseStateRepository(state: BaseState): IBaseStateRepository {
  let currentState = { ...state }
  return {
    getBaseState: jest.fn(async () => ({ ...currentState })),
    saveBaseState: jest.fn(async (s: BaseState) => { currentState = { ...s } }),
    getAndIncrementNextGoblinId: jest.fn(async () => 99),
  }
}

// --- テスト ---

describe('CompleteExpeditionUseCase', () => {
  describe('execute', () => {
    it('成功した遠征で経験値が付与される', async () => {
      const goblin = createTestGoblin({ id: 1, level: 1, experience: 0 })
      const party = createTestParty({ id: 1, memberIds: [1] })
      const baseState = createTestBaseState()
      const replay = createTestReplay({ summary: { success: true, maxFloorReached: 3, xpGained: 100, goldGained: 50, casualties: [] } })

      const goblinRepo = createMockGoblinRepository([goblin])
      const partyRepo = createMockPartyRepository([party])
      const baseRepo = createMockBaseStateRepository(baseState)

      const usecase = new CompleteExpeditionUseCase(goblinRepo, partyRepo, baseRepo)
      const result = await usecase.execute(1, replay)

      expect(result.updatedGoblinIds).toContain(1)
      expect(goblinRepo.saveGoblin).toHaveBeenCalled()
      const savedGoblin = (goblinRepo.saveGoblin as jest.Mock).mock.calls[0][0] as Goblin
      expect(savedGoblin.experience).toBeGreaterThan(0)
    })

    it('戦闘不能メンバーは経験値を獲得しない', async () => {
      const goblin1 = createTestGoblin({ id: 1 })
      const goblin2 = createTestGoblin({ id: 2, name: '���ブリン2' })
      const party = createTestParty({ id: 1, memberIds: [1, 2] })
      const baseState = createTestBaseState()
      const replay = createTestReplay({
        meta: { expeditionId: 'exp-1', areaId: 'dungeon_1', areaName: 'テスト', floors: 3, baseDurationSec: 60, party: ['1', '2'], returnPolicy: 'never', seed: 12345 },
        summary: { success: true, maxFloorReached: 3, xpGained: 100, goldGained: 50, casualties: ['1'] },
      })

      const goblinRepo = createMockGoblinRepository([goblin1, goblin2])
      const partyRepo = createMockPartyRepository([party])
      const baseRepo = createMockBaseStateRepository(baseState)

      const usecase = new CompleteExpeditionUseCase(goblinRepo, partyRepo, baseRepo)
      const result = await usecase.execute(1, replay)

      expect(result.updatedGoblinIds).not.toContain(1)
      expect(result.updatedGoblinIds).toContain(2)
    })

    it('ゴールドが加算さ���る', async () => {
      const goblin = createTestGoblin()
      const party = createTestParty()
      const baseState = createTestBaseState({ gold: 100 })
      const replay = createTestReplay({ summary: { success: true, maxFloorReached: 3, xpGained: 50, goldGained: 200, casualties: [] } })

      const baseRepo = createMockBaseStateRepository(baseState)
      const usecase = new CompleteExpeditionUseCase(
        createMockGoblinRepository([goblin]),
        createMockPartyRepository([party]),
        baseRepo,
      )
      const result = await usecase.execute(1, replay)

      expect(result.goldGained).toBe(200)
      const savedState = (baseRepo.saveBaseState as jest.Mock).mock.calls[0][0] as BaseState
      expect(savedState.gold).toBe(300)
    })

    it('成功した遠征でダンジョンが制圧��れる', async () => {
      const goblin = createTestGoblin()
      const party = createTestParty()
      const baseState = createTestBaseState({ capturedDungeons: [] })
      const replay = createTestReplay({ summary: { success: true, maxFloorReached: 3, xpGained: 50, goldGained: 0, casualties: [] } })

      const baseRepo = createMockBaseStateRepository(baseState)
      const usecase = new CompleteExpeditionUseCase(
        createMockGoblinRepository([goblin]),
        createMockPartyRepository([party]),
        baseRepo,
      )
      const result = await usecase.execute(1, replay)

      expect(result.newDungeonCaptured).toBe('dungeon_1')
      const savedState = (baseRepo.saveBaseState as jest.Mock).mock.calls[0][0] as BaseState
      expect(savedState.capturedDungeons).toContain('dungeon_1')
    })

    it('既に制圧済みのダンジョンではnewDungeonCapturedがundefined', async () => {
      const goblin = createTestGoblin()
      const party = createTestParty()
      const baseState = createTestBaseState({ capturedDungeons: ['dungeon_1'] })
      const replay = createTestReplay({ summary: { success: true, maxFloorReached: 3, xpGained: 50, goldGained: 0, casualties: [] } })

      const usecase = new CompleteExpeditionUseCase(
        createMockGoblinRepository([goblin]),
        createMockPartyRepository([party]),
        createMockBaseStateRepository(baseState),
      )
      const result = await usecase.execute(1, replay)

      expect(result.newDungeonCaptured).toBeUndefined()
    })

    it('失敗した遠征ではダンジョンが制圧されない', async () => {
      const goblin = createTestGoblin()
      const party = createTestParty()
      const baseState = createTestBaseState({ capturedDungeons: [] })
      const replay = createTestReplay({ summary: { success: false, maxFloorReached: 2, xpGained: 30, goldGained: 0, casualties: ['1'] } })

      const baseRepo = createMockBaseStateRepository(baseState)
      const usecase = new CompleteExpeditionUseCase(
        createMockGoblinRepository([goblin]),
        createMockPartyRepository([party]),
        baseRepo,
      )
      const result = await usecase.execute(1, replay)

      expect(result.newDungeonCaptured).toBeUndefined()
    })

    it('完了後にパーティステータスがidleに更新さ���る', async () => {
      const goblin = createTestGoblin()
      const party = createTestParty({ status: 'expedition' })
      const baseState = createTestBaseState()
      const replay = createTestReplay()

      const partyRepo = createMockPartyRepository([party])
      const usecase = new CompleteExpeditionUseCase(
        createMockGoblinRepository([goblin]),
        partyRepo,
        createMockBaseStateRepository(baseState),
      )
      await usecase.execute(1, replay)

      expect(partyRepo.updatePartyStatus).toHaveBeenCalledWith(1, 'idle')
    })

    it('存在しないパーティIDでエラーが発生する', async () => {
      const usecase = new CompleteExpeditionUseCase(
        createMockGoblinRepository([]),
        createMockPartyRepository([]),
        createMockBaseStateRepository(createTestBaseState()),
      )

      await expect(usecase.execute(999, createTestReplay())).rejects.toThrow('パーティが見つかりません')
    })

    it('2回実行すると経験値が2重に加算される（呼び出し側でガードが必要）', async () => {
      const goblin = createTestGoblin({ id: 1, level: 1, experience: 0 })
      const party = createTestParty()
      const baseState = createTestBaseState({ gold: 0 })
      const replay = createTestReplay({ summary: { success: true, maxFloorReached: 3, xpGained: 100, goldGained: 50, casualties: [] } })

      const goblinRepo = createMockGoblinRepository([goblin])
      const partyRepo = createMockPartyRepository([party])
      const baseRepo = createMockBaseStateRepository(baseState)
      const usecase = new CompleteExpeditionUseCase(goblinRepo, partyRepo, baseRepo)

      // 1回目
      await usecase.execute(1, replay)
      const firstCallGoblin = (goblinRepo.saveGoblin as jest.Mock).mock.calls[0][0] as Goblin
      const firstExp = firstCallGoblin.experience

      // 2回目（ガードなしで呼ぶとさらに加算される）
      await usecase.execute(1, replay)
      const secondCallGoblin = (goblinRepo.saveGoblin as jest.Mock).mock.calls[1][0] as Goblin

      // UseCase自体にはガードがないため、2回呼べば2回加算される
      // → 呼び出し側（completeExpeditionRecord の戻り値）でガードする設計
      expect(secondCallGoblin.experience).toBeGreaterThan(firstExp)
      expect(goblinRepo.saveGoblin).toHaveBeenCalledTimes(2)
    })

    it('複数メンバーのパーティで全員に経験値が付与される', async () => {
      const goblin1 = createTestGoblin({ id: 1, name: 'ゴブリン1' })
      const goblin2 = createTestGoblin({ id: 2, name: 'ゴブリン2' })
      const goblin3 = createTestGoblin({ id: 3, name: 'ゴ��リン3' })
      const party = createTestParty({ id: 1, memberIds: [1, 2, 3] })
      const baseState = createTestBaseState()
      const replay = createTestReplay({
        meta: { expeditionId: 'exp-1', areaId: 'dungeon_1', areaName: 'テスト', floors: 3, baseDurationSec: 60, party: ['1', '2', '3'], returnPolicy: 'never', seed: 12345 },
        summary: { success: true, maxFloorReached: 3, xpGained: 100, goldGained: 0, casualties: [] },
      })

      const goblinRepo = createMockGoblinRepository([goblin1, goblin2, goblin3])
      const usecase = new CompleteExpeditionUseCase(goblinRepo, createMockPartyRepository([party]), createMockBaseStateRepository(baseState))
      const result = await usecase.execute(1, replay)

      expect(result.updatedGoblinIds).toEqual(expect.arrayContaining([1, 2, 3]))
      expect(goblinRepo.saveGoblin).toHaveBeenCalledTimes(3)
    })

    it('経験値0の遠征ではゴブリンが更新されない', async () => {
      const goblin = createTestGoblin()
      const party = createTestParty()
      const replay = createTestReplay({ summary: { success: false, maxFloorReached: 1, xpGained: 0, goldGained: 0, casualties: [] } })

      const goblinRepo = createMockGoblinRepository([goblin])
      const usecase = new CompleteExpeditionUseCase(goblinRepo, createMockPartyRepository([party]), createMockBaseStateRepository(createTestBaseState()))
      const result = await usecase.execute(1, replay)

      expect(result.updatedGoblinIds).toHaveLength(0)
      expect(goblinRepo.saveGoblin).not.toHaveBeenCalled()
    })
  })
})
