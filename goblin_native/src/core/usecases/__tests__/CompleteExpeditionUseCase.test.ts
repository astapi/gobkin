import { CompleteExpeditionUseCase } from '../CompleteExpeditionUseCase'
import { GOLDEN_ACORN_CLEAR_ENCOUNTER_ID } from '../../services/ExpeditionEngine'
import type { IGoblinRepository, IPartyRepository, IBaseStateRepository, IEquipmentRepository, ITransactionRunner, IExpeditionCompletionGateway } from '../../repositories'
import { getCharacterSkill } from '../../../shared/data/skillCatalog'
import { getDefaultSkillsForRace } from '../../../shared/data/raceSkills'
import { DEFAULT_PARTY_REWARD_MULTIPLIERS } from '../../../shared/types'
import { getDungeonTierFactorDropMultiplier } from '../../../shared/types/DungeonTier'
import type { Goblin, GoblinStats, Party, BaseState, ExpeditionReplay, TimelineEvent, EquipmentInstance } from '../../../shared/types'

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
    stats: { hp: 60, atk: 12, magicAtk: 0, def: 10, magicDef: 0, attackCount: 2, accuracy: 20, evasion: 15, magicHeal: 10, criticalRate: 0 },
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

function createBossEvent(
  enemyId: string,
  xp: number,
  allyHPDelta: number[],
  at = 60,
  floor = 2,
): Extract<TimelineEvent, { type: 'boss' }> {
  return {
    type: 'boss',
    at,
    floor,
    enemy: { id: enemyId, name: 'テストボス', lvl: 1, count: 1, gold: 10 },
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
      partyRewardMultipliers: DEFAULT_PARTY_REWARD_MULTIPLIERS,
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
    updateGoblinCurrentHp: jest.fn(async (id: number, currentHp: number) => {
      const goblin = store.get(id)
      if (goblin) store.set(id, { ...goblin, currentHp })
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
    updateDungeonTier: jest.fn(async () => {}),
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

function createMockEquipmentRepository(equipment: EquipmentInstance[]): IEquipmentRepository {
  const store = new Map(equipment.map(item => [item.id, { ...item }]))
  return {
    getAll: jest.fn(async () => [...store.values()]),
    getByGoblinId: jest.fn(async (goblinId: number) => (
      [...store.values()].filter(item => item.goblinId === goblinId)
    )),
    getUnequipped: jest.fn(async () => (
      [...store.values()].filter(item => item.goblinId === null)
    )),
    save: jest.fn(async (item: EquipmentInstance) => { store.set(item.id, { ...item }) }),
    delete: jest.fn(async (id: string) => { store.delete(id) }),
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
        meta: {
          expeditionId: 'exp-1',
          areaId: 'dungeon_1',
          areaName: 'テスト',
          floors: 3,
          baseDurationSec: 60,
          party: ['1', '2'],
          partyRewardMultipliers: DEFAULT_PARTY_REWARD_MULTIPLIERS,
          returnPolicy: 'never',
          seed: 12345,
        },
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

    it('全滅した戦闘では経験値が付与されない', async () => {
      const goblin = createTestGoblin({ id: 1, level: 1, experience: 0 })
      const party = createTestParty({ id: 1, memberIds: [1] })
      const baseState = createTestBaseState()
      const events: TimelineEvent[] = [
        { type: 'move_start', at: 0, floor: 1 },
        {
          ...createBattleEvent(100, [-60], 10, 1),
          combat: { rounds: 3, outcome: 'lose', allyHPDelta: [-60], enemyDefeated: 0 },
        },
        { type: 'return', at: 60, reason: 'defeated' },
      ]
      const replay = createTestReplay({
        events,
        summary: { success: false, maxFloorReached: 1, xpGained: 100, goldGained: 0, casualties: ['1'] },
      })

      const goblinRepo = createMockGoblinRepository([goblin])
      const usecase = new CompleteExpeditionUseCase(goblinRepo, createMockPartyRepository([party]), createMockBaseStateRepository(baseState))
      const result = await usecase.execute(1, replay)

      expect(result.updatedGoblinIds).toEqual([1])
      expect(result.levelUps.size).toBe(0)
      expect(goblinRepo.saveGoblin).not.toHaveBeenCalled()
      expect(goblinRepo.updateGoblinCurrentHp).toHaveBeenCalledWith(1, 0)
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

    it('途中帰還成功ではダンジョン制圧と因子獲得を行わない', async () => {
      const goblin = createTestGoblin({ id: 1 })
      const party = createTestParty({ id: 1, memberIds: [1] })
      const baseState = createTestBaseState({ capturedDungeons: [] })
      const events: TimelineEvent[] = [
        { type: 'move_start', at: 0, floor: 1 },
        createBattleEvent(5, [-1], 10, 1),
        { type: 'floor_up', at: 10, from: 1, to: 2 },
        { type: 'return', at: 30, reason: 'policy_return' },
      ]
      const replay = createTestReplay({
        meta: {
          expeditionId: 'exp-1',
          areaId: 'slime_cave',
          areaName: 'スライムの洞窟',
          floors: 2,
          baseDurationSec: 30,
          party: ['1'],
          partyRewardMultipliers: DEFAULT_PARTY_REWARD_MULTIPLIERS,
          returnPolicy: 'if_any_ko',
          seed: 12345,
        },
        events,
        summary: { success: true, maxFloorReached: 2, xpGained: 5, goldGained: 0, casualties: [] },
      })

      const goblinRepo = createMockGoblinRepository([goblin])
      const baseRepo = createMockBaseStateRepository(baseState)
      const usecase = new CompleteExpeditionUseCase(goblinRepo, createMockPartyRepository([party]), baseRepo)
      const result = await usecase.execute(1, replay)

      expect(result.newDungeonCaptured).toBeUndefined()
      expect(result.factorAcquisitions.size).toBe(0)
      expect(goblinRepo.updateGoblinFactors).not.toHaveBeenCalled()
      const savedState = (baseRepo.saveBaseState as jest.Mock).mock.calls[0][0] as BaseState
      expect(savedState.capturedDungeons).not.toContain('slime_cave')
    })

    it('スライム洞窟の初回ボス踏破ではスライム因子を確定獲得する', async () => {
      const goblin = createTestGoblin({ id: 1 })
      const party = createTestParty({ id: 1, memberIds: [1] })
      const baseState = createTestBaseState({ capturedDungeons: [] })
      const events: TimelineEvent[] = [
        { type: 'move_start', at: 0, floor: 1 },
        createBattleEvent(5, [-1], 10, 1),
        { type: 'floor_up', at: 10, from: 1, to: 2 },
        createBossEvent('B_SLIME', 5, [-1], 30, 2),
        { type: 'return', at: 30, reason: 'completed' },
      ]
      const replay = createTestReplay({
        meta: {
          expeditionId: 'exp-1',
          areaId: 'slime_cave',
          areaName: 'スライムの洞窟',
          floors: 2,
          baseDurationSec: 30,
          party: ['1'],
          partyRewardMultipliers: DEFAULT_PARTY_REWARD_MULTIPLIERS,
          returnPolicy: 'never',
          seed: 12345,
        },
        events,
        summary: { success: true, maxFloorReached: 2, xpGained: 10, goldGained: 0, casualties: [] },
      })

      const goblinRepo = createMockGoblinRepository([goblin])
      const usecase = new CompleteExpeditionUseCase(
        goblinRepo,
        createMockPartyRepository([party]),
        createMockBaseStateRepository(baseState),
      )
      const result = await usecase.execute(1, replay)

      expect(result.newDungeonCaptured).toBe('slime_cave')
      expect(result.factorAcquisitions.get(1)).toEqual(['slime'])
      expect(goblinRepo.updateGoblinFactors).toHaveBeenCalledWith(
        1,
        ['slime'],
        expect.objectContaining({ hp: expect.any(Number) }),
      )
    })

    it('因子獲得倍率スキルは持っているゴブリンの因子獲得確率だけを上げる', async () => {
      const boostedGoblin = createTestGoblin({
        id: 1,
        name: '倍率持ち',
        skills: [getCharacterSkill('factor_drop_mult_1_5')],
      })
      const plainGoblin = createTestGoblin({ id: 2, name: '倍率なし', skills: [] })
      const party = createTestParty({ id: 1, memberIds: [1, 2] })
      const baseState = createTestBaseState({ capturedDungeons: [] })
      const events: TimelineEvent[] = [
        { type: 'move_start', at: 0, floor: 1 },
        createBossEvent('B001', 5, [-1, -1], 30, 1),
        { type: 'return', at: 30, reason: 'completed' },
      ]
      const replay = createTestReplay({
        meta: {
          expeditionId: 'exp-1',
          areaId: 'forest_outskirts',
          areaName: '森のはずれ',
          floors: 1,
          baseDurationSec: 30,
          party: ['1', '2'],
          partyRewardMultipliers: DEFAULT_PARTY_REWARD_MULTIPLIERS,
          returnPolicy: 'never',
          // seed=142: id=1の初回乱数0.0211(1.5%<r<2.25%: 倍率ありのみ獲得)、id=2は0.565(非獲得)
          seed: 142,
        },
        events,
        summary: { success: true, maxFloorReached: 1, xpGained: 5, goldGained: 0, casualties: [] },
      })

      const goblinRepo = createMockGoblinRepository([boostedGoblin, plainGoblin])
      const usecase = new CompleteExpeditionUseCase(
        goblinRepo,
        createMockPartyRepository([party]),
        createMockBaseStateRepository(baseState),
      )
      const result = await usecase.execute(1, replay)

      expect(result.factorAcquisitions.get(1)).toEqual(['wolf'])
      expect(result.factorAcquisitions.get(2)).toBeUndefined()
      expect(goblinRepo.updateGoblinFactors).toHaveBeenCalledTimes(1)
      expect(goblinRepo.updateGoblinFactors).toHaveBeenCalledWith(
        1,
        ['wolf'],
        expect.objectContaining({ hp: expect.any(Number) }),
      )
    })

    it('月額パス相当の因子倍率をスキル倍率の後に乗算する', async () => {
      const goblin = createTestGoblin({ id: 1, skills: [] })
      const party = createTestParty({ id: 1, memberIds: [1] })
      const events: TimelineEvent[] = [
        { type: 'move_start', at: 0, floor: 1 },
        createBossEvent('B001', 5, [-1], 30, 1),
        { type: 'return', at: 30, reason: 'completed' },
      ]
      const replay = createTestReplay({
        meta: {
          expeditionId: 'exp-1',
          areaId: 'forest_outskirts',
          areaName: '森のはずれ',
          floors: 1,
          baseDurationSec: 30,
          party: ['1'],
          partyRewardMultipliers: DEFAULT_PARTY_REWARD_MULTIPLIERS,
          expeditionBoost: { factorDropMultiplier: 2 },
          returnPolicy: 'never',
          // seed=142: id=1の初回乱数0.0211(1.5%<r<3%: 遠征ブーストありのみ獲得)
          seed: 142,
        },
        events,
        summary: { success: true, maxFloorReached: 1, xpGained: 5, goldGained: 0, casualties: [] },
      })

      const goblinRepo = createMockGoblinRepository([goblin])
      const usecase = new CompleteExpeditionUseCase(
        goblinRepo,
        createMockPartyRepository([party]),
        createMockBaseStateRepository(createTestBaseState()),
      )
      const result = await usecase.execute(1, replay)

      expect(result.factorAcquisitions.get(1)).toEqual(['wolf'])
    })

    it('装備の因子獲得倍率は装備しているゴブリンの因子獲得確率だけを上げる', async () => {
      const goblin = createTestGoblin({ id: 1, skills: [] })
      const plainGoblin = createTestGoblin({ id: 2, name: '装備なし', skills: [] })
      const party = createTestParty({ id: 1, memberIds: [1, 2] })
      const baseState = createTestBaseState({ capturedDungeons: [] })
      const events: TimelineEvent[] = [
        { type: 'move_start', at: 0, floor: 1 },
        createBossEvent('B001', 5, [-1, -1], 30, 1),
        { type: 'return', at: 30, reason: 'completed' },
      ]
      const replay = createTestReplay({
        meta: {
          expeditionId: 'exp-1',
          areaId: 'forest_outskirts',
          areaName: '森のはずれ',
          floors: 1,
          baseDurationSec: 30,
          party: ['1', '2'],
          partyRewardMultipliers: DEFAULT_PARTY_REWARD_MULTIPLIERS,
          returnPolicy: 'never',
          // seed=142: id=1の初回乱数0.0211(1.5%<r<2.25%: 装備倍率ありのみ獲得)、id=2は0.565(非獲得)
          seed: 142,
        },
        events,
        summary: { success: true, maxFloorReached: 1, xpGained: 5, goldGained: 0, casualties: [] },
      })

      const goblinRepo = createMockGoblinRepository([goblin, plainGoblin])
      const equipmentRepo = createMockEquipmentRepository([
        {
          id: 'eq-factor-core',
          templateId: 'accessory_factor_core',
          slotIndex: 0,
          goblinId: 1,
        },
      ])
      const usecase = new CompleteExpeditionUseCase(
        goblinRepo,
        createMockPartyRepository([party]),
        createMockBaseStateRepository(baseState),
        equipmentRepo,
      )
      const result = await usecase.execute(1, replay)

      expect(result.factorAcquisitions.get(1)).toEqual(['wolf'])
      expect(result.factorAcquisitions.get(2)).toBeUndefined()
      expect(goblinRepo.updateGoblinFactors).toHaveBeenCalledWith(
        1,
        ['wolf'],
        expect.objectContaining({ hp: expect.any(Number) }),
      )
    })

    it('上位Tier解禁因子は解禁Tierを1.5%起点として獲得判定される', async () => {
      expect(0.015 * getDungeonTierFactorDropMultiplier(3, 3)).toBeCloseTo(0.015)
      expect(0.015 * getDungeonTierFactorDropMultiplier(4, 3)).toBeCloseTo(0.025)
      expect(0.015 * getDungeonTierFactorDropMultiplier(5, 3)).toBeCloseTo(0.035)
      expect(getDungeonTierFactorDropMultiplier(2, 3)).toBe(0)

      const party = createTestParty({ id: 1, memberIds: [1] })
      const baseState = createTestBaseState({ capturedDungeons: ['slime_cave'] })
      const events: TimelineEvent[] = [
        { type: 'move_start', at: 0, floor: 1 },
        createBossEvent('B_SLIME', 5, [-1], 30, 2),
        {
          type: 'battle',
          at: 30,
          floor: 2,
          enemy: { id: GOLDEN_ACORN_CLEAR_ENCOUNTER_ID, name: 'ラタトスク', lvl: 10, count: 1, gold: 998 },
          combat: { rounds: 1, outcome: 'win', allyHPDelta: [0], enemyDefeated: 1 },
          xp: 998,
        },
        { type: 'return', at: 30, reason: 'completed' },
      ]
      const replayBase = {
        meta: {
          expeditionId: 'exp-1',
          areaId: 'slime_cave',
          areaName: 'スライムの洞窟',
          floors: 2,
          baseDurationSec: 30,
          party: ['1'],
          partyRewardMultipliers: DEFAULT_PARTY_REWARD_MULTIPLIERS,
          returnPolicy: 'never' as const,
          // seed=36: id=1の乱数列[0.0034, 0.513](ラタトスク獲得・スライム非獲得)
          seed: 36,
        },
        events,
        summary: { success: true, maxFloorReached: 3, xpGained: 5, goldGained: 0, casualties: [] },
      }

      const tier2Goblin = createTestGoblin()
      const tier2Usecase = new CompleteExpeditionUseCase(
        createMockGoblinRepository([tier2Goblin]),
        createMockPartyRepository([party]),
        createMockBaseStateRepository(baseState),
      )
      const tier2Result = await tier2Usecase.execute(1, createTestReplay({
        ...replayBase,
        meta: { ...replayBase.meta, tier: 2 },
      }))

      const tier3Goblin = createTestGoblin()
      const tier3GoblinRepo = createMockGoblinRepository([tier3Goblin])
      const tier3Usecase = new CompleteExpeditionUseCase(
        tier3GoblinRepo,
        createMockPartyRepository([party]),
        createMockBaseStateRepository(baseState),
      )
      const tier3Result = await tier3Usecase.execute(1, createTestReplay({
        ...replayBase,
        meta: { ...replayBase.meta, tier: 3 },
      }))

      expect(tier2Result.factorAcquisitions.get(1)).toBeUndefined()
      expect(tier3Result.factorAcquisitions.get(1)).toEqual(['ratatoskr'])
      expect(tier3GoblinRepo.updateGoblinFactors).toHaveBeenCalledWith(
        1,
        ['ratatoskr'],
        expect.objectContaining({ accuracy: expect.any(Number) }),
      )
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
        meta: {
          expeditionId: 'exp-1',
          areaId: 'dungeon_1',
          areaName: 'テスト',
          floors: 3,
          baseDurationSec: 60,
          party: ['1', '2', '3'],
          partyRewardMultipliers: DEFAULT_PARTY_REWARD_MULTIPLIERS,
          returnPolicy: 'never',
          seed: 12345,
        },
        events,
        summary: { success: true, maxFloorReached: 3, xpGained: 9, goldGained: 0, casualties: [] },
      })

      const goblinRepo = createMockGoblinRepository([goblin1, goblin2, goblin3])
      const usecase = new CompleteExpeditionUseCase(goblinRepo, createMockPartyRepository([party]), createMockBaseStateRepository(baseState))
      const result = await usecase.execute(1, replay)

      expect(result.updatedGoblinIds).toEqual(expect.arrayContaining([1, 2, 3]))
      expect(goblinRepo.saveGoblin).toHaveBeenCalledTimes(3)

      // 各ゴブリンが3ずつ取得（9/3=3）→ 純ゴブリンは経験値ボーナスなし: floor(3*1.0)=3
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
        meta: {
          expeditionId: 'exp-1',
          areaId: 'dungeon_1',
          areaName: 'テスト',
          floors: 3,
          baseDurationSec: 60,
          party: ['1', '2', '3'],
          partyRewardMultipliers: DEFAULT_PARTY_REWARD_MULTIPLIERS,
          returnPolicy: 'never',
          seed: 12345,
        },
        events,
        summary: { success: true, maxFloorReached: 3, xpGained: 17, goldGained: 0, casualties: ['1'] },
      })

      const goblinRepo = createMockGoblinRepository([goblin1, goblin2, goblin3])
      const usecase = new CompleteExpeditionUseCase(goblinRepo, createMockPartyRepository([party]), createMockBaseStateRepository(baseState))
      const result = await usecase.execute(1, replay)

      // ゴブリン1: 戦闘1で3、戦闘2では戦闘不能で0 → 合計3（純ゴブリンは経験値ボーナスなし）
      // ゴブリン2: 戦闘1で3、戦闘2で4 → 合計7
      // ゴブリン3: 同上
      const savedGoblins = (goblinRepo.saveGoblin as jest.Mock).mock.calls.map((c: unknown[]) => c[0] as Goblin)
      const g1 = savedGoblins.find(g => g.id === 1)!
      const g2 = savedGoblins.find(g => g.id === 2)!
      const g3 = savedGoblins.find(g => g.id === 3)!

      expect(g1.experience).toBe(3)
      expect(g1.level).toBe(1)
      expect(g2.experience).toBe(7)
      expect(g2.level).toBe(1)
      expect(g3.experience).toBe(7)
      expect(g3.level).toBe(1)
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

      expect(result.updatedGoblinIds).toEqual([1])
      expect(goblinRepo.saveGoblin).not.toHaveBeenCalled()
      expect(goblinRepo.updateGoblinCurrentHp).toHaveBeenCalledWith(1, 60)
    })
  })

  describe('冪等性ゲート / トランザクション', () => {
    const createMockRunner = (): ITransactionRunner => ({
      runInTransaction: jest.fn(<T,>(fn: () => Promise<T>) => fn()),
    })

    it('complete が false（処理済み）を返すと報酬処理をスキップして早期returnする', async () => {
      const goblin = createTestGoblin({ id: 1, level: 1, experience: 0 })
      const party = createTestParty()
      const baseState = createTestBaseState({ gold: 0 })
      const replay = createTestReplay()

      const goblinRepo = createMockGoblinRepository([goblin])
      const partyRepo = createMockPartyRepository([party])
      const baseRepo = createMockBaseStateRepository(baseState)
      const gateway: IExpeditionCompletionGateway = {
        complete: jest.fn(async () => false),
        updateReplay: jest.fn(async () => {}),
      }
      const runner = createMockRunner()

      const usecase = new CompleteExpeditionUseCase(goblinRepo, partyRepo, baseRepo, undefined, gateway, runner)
      const result = await usecase.execute(1, replay, { expeditionId: 'exp-1' })

      expect(result.alreadyProcessed).toBe(true)
      expect(gateway.complete).toHaveBeenCalledWith('exp-1', replay)
      expect(gateway.updateReplay).not.toHaveBeenCalled()
      expect(goblinRepo.saveGoblin).not.toHaveBeenCalled()
      expect(baseRepo.saveBaseState).not.toHaveBeenCalled()
      expect(partyRepo.updatePartyStatus).not.toHaveBeenCalled()
      expect(runner.runInTransaction).toHaveBeenCalledTimes(1)
    })

    it('complete が true を返すと報酬処理を行い enrichedReplay を updateReplay で保存する', async () => {
      const goblin = createTestGoblin({ id: 1, level: 1, experience: 0 })
      const party = createTestParty()
      const baseState = createTestBaseState({ gold: 0 })
      const replay = createTestReplay({ summary: { success: true, maxFloorReached: 3, xpGained: 100, goldGained: 50, casualties: [] } })

      const goblinRepo = createMockGoblinRepository([goblin])
      const partyRepo = createMockPartyRepository([party])
      const baseRepo = createMockBaseStateRepository(baseState)
      const gateway: IExpeditionCompletionGateway = {
        complete: jest.fn(async () => true),
        updateReplay: jest.fn(async () => {}),
      }
      const runner = createMockRunner()

      const usecase = new CompleteExpeditionUseCase(goblinRepo, partyRepo, baseRepo, undefined, gateway, runner)
      const result = await usecase.execute(1, replay, { expeditionId: 'exp-1' })

      expect(result.alreadyProcessed).toBe(false)
      expect(gateway.complete).toHaveBeenCalledWith('exp-1', replay)
      expect(goblinRepo.saveGoblin).toHaveBeenCalled()
      expect(gateway.updateReplay).toHaveBeenCalledWith('exp-1', result.enrichedReplay)
      expect(runner.runInTransaction).toHaveBeenCalledTimes(1)
    })

    it('自動周回の確定結果をPTのセッションサマリへ加算する', async () => {
      const goblin = createTestGoblin({ id: 1, level: 1, experience: 0 })
      const party = createTestParty({
        autoExpeditionEnabled: true,
        autoExpeditionSessionId: 'session-a',
      })
      const replay = createTestReplay({
        meta: {
          ...createTestReplay().meta,
          autoExpeditionSessionId: 'session-a',
        },
        summary: {
          success: true,
          maxFloorReached: 3,
          xpGained: 100,
          goldGained: 50,
          casualties: [],
          treasureDrops: [{ templateId: 'wooden_club' }],
        },
      })
      const partyRepo = createMockPartyRepository([party])
      const usecase = new CompleteExpeditionUseCase(
        createMockGoblinRepository([goblin]),
        partyRepo,
        createMockBaseStateRepository(createTestBaseState()),
      )

      await usecase.execute(1, replay)

      expect(partyRepo.saveParty).toHaveBeenCalledWith(expect.objectContaining({
        autoExpeditionEnabled: true,
        autoExpeditionSummary: expect.objectContaining({
          sessionId: 'session-a',
          runCount: 1,
          xpGained: 100,
          goldGained: 50,
          rewardItems: [{ templateId: 'wooden_club', count: 1 }],
        }),
      }))
    })
  })
})
