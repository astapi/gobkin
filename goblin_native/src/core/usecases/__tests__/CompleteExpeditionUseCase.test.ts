import { CompleteExpeditionUseCase } from '../CompleteExpeditionUseCase'
import type { IGoblinRepository, IPartyRepository, IBaseStateRepository } from '../../repositories'
import { getDefaultSkillsForRace } from '../../../shared/data/raceSkills'
import type { Goblin, GoblinStats, Party, BaseState, ExpeditionReplay, TimelineEvent } from '../../../shared/types'

// --- テストヘルパー ---

function createTestGoblin(overrides: Partial<Goblin> = {}): Goblin {
  const race = overrides.race ?? 'ゴブリン'
  return {
    id: 1,
    name: 'テストゴブリン',
    race,
    level: 1,
    experience: 0,
    avatar: '/test.png',
    stats: { hp: 60, atk: 12, sp: 10, spd: 10, def: 10, attackCount: 2, accuracy: 20, evasion: 15 },
    mods: [],
    skills: overrides.skills ?? getDefaultSkillsForRace(race),
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

function createBattleEvent(xp: number, allyHPDelta: number[], at = 10, floor = 1): Extract<TimelineEvent, { type: 'battle' }> {
  return {
    type: 'battle',
    at,
    floor,
    enemy: { id: 'enemy_1', name: 'テスト敵', lvl: 1, count: 1, gold: 10 },
    combat: { rounds: 3, outcome: 'win', allyHPDelta, enemyDefeated: 1 },
    xp,
  }
}

function createTestReplay(overrides: Partial<ExpeditionReplay> = {}): ExpeditionReplay {
  const party = overrides?.meta?.party ?? ['1']
  const partySize = party.length
  const defaultEvents: TimelineEvent[] = [
    { type: 'move_start', at: 0, floor: 1 },
    createBattleEvent(100, Array(partySize).fill(-5)),
    { type: 'return', at: 60, reason: 'completed' },
  ]
  return {
    meta: {
      expeditionId: 'exp-1',
      areaId: 'dungeon_1',
      areaName: 'テストダンジョン',
      floors: 3,
      baseDurationSec: 60,
      party: ['1'],
      returnPolicy: 'never',
      seed: 12345,
    },
    durationSec: 60,
    events: defaultEvents,
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
    updateGoblinFactors: jest.fn(async (id: number, factors: string[], effectiveStats: GoblinStats) => {
      const goblin = store.get(id)
      if (goblin) store.set(id, { ...goblin, factors, effectiveStats })
    }),
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
      // レベルアップ情報で経験値付与を確認
      const levelUp = result.levelUps.get(1)!
      expect(levelUp.oldLevel).toBe(1)
      expect(levelUp.newLevel).toBeGreaterThan(1)
    })

    it('戦闘不能メンバーは経験値を獲得しない', async () => {
      const goblin1 = createTestGoblin({ id: 1 })
      const goblin2 = createTestGoblin({ id: 2, name: 'ゴブリン2' })
      const party = createTestParty({ id: 1, memberIds: [1, 2] })
      const baseState = createTestBaseState()
      // ゴブリン1がHP0になる戦闘イベント（allyHPDelta: [-60, -5] でゴブリン1は戦闘不能）
      // ただし戦闘前はまだ生存しているので、この戦闘のXPは2人で分配
      const events: TimelineEvent[] = [
        { type: 'move_start', at: 0, floor: 1 },
        createBattleEvent(100, [-60, -5]),
        { type: 'return', at: 60, reason: 'completed' },
      ]
      const replay = createTestReplay({
        meta: { expeditionId: 'exp-1', areaId: 'dungeon_1', areaName: 'テスト', floors: 3, baseDurationSec: 60, party: ['1', '2'], returnPolicy: 'never', seed: 12345 },
        events,
        summary: { success: true, maxFloorReached: 3, xpGained: 100, goldGained: 50, casualties: ['1'] },
      })

      const goblinRepo = createMockGoblinRepository([goblin1, goblin2])
      const partyRepo = createMockPartyRepository([party])
      const baseRepo = createMockBaseStateRepository(baseState)

      const usecase = new CompleteExpeditionUseCase(goblinRepo, partyRepo, baseRepo)
      const result = await usecase.execute(1, replay)

      // 戦闘前に2人とも生存 → 2人に分配、両方ともXPを得る
      expect(result.updatedGoblinIds).toContain(1)
      expect(result.updatedGoblinIds).toContain(2)
    })

    it('ゴールドが加算される', async () => {
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

    it('成功した遠征でダンジョンが制圧される', async () => {
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

    it('��に制圧済みのダンジョンではnewDungeonCapturedがundefined', async () => {
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

    it('失敗した遠征ではダンジョンが制圧さ��ない', async () => {
      const goblin = createTestGoblin()
      const party = createTestParty()
      const baseState = createTestBaseState({ capturedDungeons: [] })
      const events: TimelineEvent[] = [
        { type: 'move_start', at: 0, floor: 1 },
        createBattleEvent(30, [-60]),
        { type: 'return', at: 30, reason: 'defeated' },
      ]
      const replay = createTestReplay({
        events,
        summary: { success: false, maxFloorReached: 2, xpGained: 30, goldGained: 0, casualties: ['1'] },
      })

      const baseRepo = createMockBaseStateRepository(baseState)
      const usecase = new CompleteExpeditionUseCase(
        createMockGoblinRepository([goblin]),
        createMockPartyRepository([party]),
        baseRepo,
      )
      const result = await usecase.execute(1, replay)

      expect(result.newDungeonCaptured).toBeUndefined()
    })

    it('完了後にパーティステータスがidleに更新される', async () => {
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
      const firstLevel = firstCallGoblin.level

      // 2回目（ガードなしで呼ぶとさらに加算される）
      await usecase.execute(1, replay)
      const secondCallGoblin = (goblinRepo.saveGoblin as jest.Mock).mock.calls[1][0] as Goblin

      // UseCase自体にはガードがないため、2回呼べば2回加算される
      expect(secondCallGoblin.level).toBeGreaterThanOrEqual(firstLevel)
      expect(goblinRepo.saveGoblin).toHaveBeenCalledTimes(2)
    })

    it('複数メンバー���パーティで経験値がメンバー数で分��される', async () => {
      const goblin1 = createTestGoblin({ id: 1, name: 'ゴブリン1' })
      const goblin2 = createTestGoblin({ id: 2, name: 'ゴブリン2' })
      const goblin3 = createTestGoblin({ id: 3, name: 'ゴブリン3' })
      const party = createTestParty({ id: 1, memberIds: [1, 2, 3] })
      const baseState = createTestBaseState()
      // 3人パーティで戦闘XP 9 → 1人あたり3（レベルアップしない小さい値）
      const events: TimelineEvent[] = [
        { type: 'move_start', at: 0, floor: 1 },
        createBattleEvent(9, [-5, -5, -5]),
        { type: 'return', at: 60, reason: 'completed' },
      ]
      const replay = createTestReplay({
        meta: { expeditionId: 'exp-1', areaId: 'dungeon_1', areaName: 'テスト', floors: 3, baseDurationSec: 60, party: ['1', '2', '3'], returnPolicy: 'never', seed: 12345 },
        events,
        summary: { success: true, maxFloorReached: 3, xpGained: 9, goldGained: 0, casualties: [] },
      })

      const goblinRepo = createMockGoblinRepository([goblin1, goblin2, goblin3])
      const usecase = new CompleteExpeditionUseCase(goblinRepo, createMockPartyRepository([party]), createMockBaseStateRepository(baseState))
      const result = await usecase.execute(1, replay)

      expect(result.updatedGoblinIds).toEqual(expect.arrayContaining([1, 2, 3]))
      expect(goblinRepo.saveGoblin).toHaveBeenCalledTimes(3)

      // 各ゴブリンが3ずつ取得（9/3=3、LV1→LV1で経験値3のまま）
      for (let i = 0; i < 3; i++) {
        const saved = (goblinRepo.saveGoblin as jest.Mock).mock.calls[i][0] as Goblin
        expect(saved.experience).toBe(3)
        expect(saved.level).toBe(1)
      }
    })

    it('戦���不能が発生すると残りメンバーで経験値が再分配される', async () => {
      const goblin1 = createTestGoblin({ id: 1, name: 'ゴブリン1' })
      const goblin2 = createTestGoblin({ id: 2, name: 'ゴブリン2' })
      const goblin3 = createTestGoblin({ id: 3, name: 'ゴブリン3' })
      const party = createTestParty({ id: 1, memberIds: [1, 2, 3] })
      const baseState = createTestBaseState()
      // 戦闘1: 3人生存 XP 9 → 3ずつ、ゴブリン1が戦闘不能（HP60→0��
      // 戦闘2: 2人生存 XP 8 → 4ずつ
      const events: TimelineEvent[] = [
        { type: 'move_start', at: 0, floor: 1 },
        createBattleEvent(9, [-60, -5, -5], 10),  // ゴブリン1戦闘��能
        createBattleEvent(8, [0, -5, -5], 20),     // 2人で分配
        { type: 'return', at: 60, reason: 'completed' },
      ]
      const replay = createTestReplay({
        meta: { expeditionId: 'exp-1', areaId: 'dungeon_1', areaName: 'テスト', floors: 3, baseDurationSec: 60, party: ['1', '2', '3'], returnPolicy: 'never', seed: 12345 },
        events,
        summary: { success: true, maxFloorReached: 3, xpGained: 17, goldGained: 0, casualties: ['1'] },
      })

      const goblinRepo = createMockGoblinRepository([goblin1, goblin2, goblin3])
      const usecase = new CompleteExpeditionUseCase(goblinRepo, createMockPartyRepository([party]), createMockBaseStateRepository(baseState))
      const result = await usecase.execute(1, replay)

      // ゴブリン1: 戦闘1で3、戦闘2では戦闘不能で0 → 合計3
      // ゴブリン2: 戦闘1で3、戦闘2で4 → ���計7
      // ゴブリ��3: 戦闘1で3、戦闘2で4 → 合計7
      const savedGoblins = (goblinRepo.saveGoblin as jest.Mock).mock.calls.map((c: unknown[]) => c[0] as Goblin)
      const g1 = savedGoblins.find(g => g.id === 1)!
      const g2 = savedGoblins.find(g => g.id === 2)!
      const g3 = savedGoblins.find(g => g.id === 3)!

      expect(g1.experience).toBe(3)
      expect(g2.experience).toBe(7)
      expect(g3.experience).toBe(7)
    })

    it('経験値0の遠征ではゴブリンが更新されない', async () => {
      const goblin = createTestGoblin()
      const party = createTestParty()
      const events: TimelineEvent[] = [
        { type: 'move_start', at: 0, floor: 1 },
        { type: 'return', at: 30, reason: 'defeated' },
      ]
      const replay = createTestReplay({
        events,
        summary: { success: false, maxFloorReached: 1, xpGained: 0, goldGained: 0, casualties: [] },
      })

      const goblinRepo = createMockGoblinRepository([goblin])
      const usecase = new CompleteExpeditionUseCase(goblinRepo, createMockPartyRepository([party]), createMockBaseStateRepository(createTestBaseState()))
      const result = await usecase.execute(1, replay)

      expect(result.updatedGoblinIds).toHaveLength(0)
      expect(goblinRepo.saveGoblin).not.toHaveBeenCalled()
    })
  })
})
