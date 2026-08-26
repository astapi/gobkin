import {
  BASE_RANK_CONFIGS,
  captureDungeon,
  checkRankUpAvailable,
  createInitialBaseState,
  performRankUp,
} from '../BaseRankSystem'
import type { BaseState } from '../../../shared/types/BaseState'

describe('BaseRankSystem', () => {
  describe('checkRankUpAvailable', () => {
    it('最大ランク(7)の場合はランクアップ不可', () => {
      const baseState: BaseState = {
        ...createInitialBaseState(),
        rank: 7,
      }
      const result = checkRankUpAvailable(baseState)
      expect(result).toEqual({ canRankUp: false })
    })

    it('次ランクの制圧条件ダンジョンが未制圧なら不可（requirementに理由が入る）', () => {
      const baseState: BaseState = {
        ...createInitialBaseState(),
        rank: 1,
        capturedDungeons: [],
      }
      const result = checkRankUpAvailable(baseState)
      expect(result.canRankUp).toBe(false)
      expect(result.nextRank).toBe(2)
      expect(result.requirement).toContain('goblin_village_1')
    })

    it('次ランクの制圧条件ダンジョンを制圧済みならランクアップ可能', () => {
      const baseState: BaseState = {
        ...createInitialBaseState(),
        rank: 1,
        capturedDungeons: ['goblin_village_1'],
      }
      const result = checkRankUpAvailable(baseState)
      expect(result).toEqual({ canRankUp: true, nextRank: 2 })
    })

    it('BASE_RANK_CONFIGSの各ランクは制圧条件を満たせばランクアップ可能と判定される', () => {
      for (let i = 0; i < BASE_RANK_CONFIGS.length - 1; i++) {
        const current = BASE_RANK_CONFIGS[i]
        const next = BASE_RANK_CONFIGS[i + 1]
        const baseState: BaseState = {
          ...createInitialBaseState(),
          rank: current.rank,
          capturedDungeons: [next.unlockCondition.dungeonId],
        }
        const result = checkRankUpAvailable(baseState)
        expect(result.canRankUp).toBe(true)
        expect(result.nextRank).toBe(next.rank)
      }
    })
  })

  describe('captureDungeon', () => {
    it('未制圧のダンジョンを制圧リストに追加する', () => {
      const baseState = createInitialBaseState()
      const result = captureDungeon('goblin_village_1', baseState)
      expect(result.capturedDungeons).toEqual(['goblin_village_1'])
    })

    it('同じダンジョンを重複して制圧しても増えない', () => {
      const baseState: BaseState = {
        ...createInitialBaseState(),
        capturedDungeons: ['goblin_village_1'],
      }
      const result = captureDungeon('goblin_village_1', baseState)
      expect(result.capturedDungeons).toEqual(['goblin_village_1'])
    })

    it('元のbaseStateオブジェクトを変更せず新しいオブジェクトを返す（イミュータブル）', () => {
      const baseState = createInitialBaseState()
      const result = captureDungeon('goblin_village_1', baseState)
      expect(baseState.capturedDungeons).toEqual([])
      expect(result).not.toBe(baseState)
    })

    it('ランクアップとは無関係にランクは変化しない', () => {
      const baseState = createInitialBaseState()
      const result = captureDungeon('goblin_village_1', baseState)
      expect(result.rank).toBe(baseState.rank)
    })
  })

  describe('performRankUp', () => {
    it('制圧済み・ゴールド十分な場合はランクアップに成功する', () => {
      const baseState: BaseState = {
        ...createInitialBaseState(),
        capturedDungeons: ['goblin_village_1'],
        gold: 100, // ランク2のupgradeCostちょうど
      }
      const result = performRankUp(baseState)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.state.rank).toBe(2)
        expect(result.state.gold).toBe(0)
        expect(result.state.currentMaxParties).toBe(2)
        expect(result.state.currentMaxGoblins).toBe(20)
        expect(result.state.capacity).toBe(20)
      }
    })

    it('ゴールドが1足りないだけでも失敗する（境界値）', () => {
      const baseState: BaseState = {
        ...createInitialBaseState(),
        capturedDungeons: ['goblin_village_1'],
        gold: 99, // upgradeCost(100)に1不足
      }
      const result = performRankUp(baseState)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('ゴールドが不足')
        expect(result.error).toContain('100')
        expect(result.error).toContain('99')
      }
    })

    it('ダンジョン未制圧の場合はゴールドが足りていても失敗する', () => {
      const baseState: BaseState = {
        ...createInitialBaseState(),
        capturedDungeons: [],
        gold: 100000,
      }
      const result = performRankUp(baseState)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('goblin_village_1')
      }
    })

    it('既に最大ランクの場合は失敗する', () => {
      const baseState: BaseState = {
        ...createInitialBaseState(),
        rank: 7,
        gold: 1000000,
      }
      const result = performRankUp(baseState)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('ランクアップできません')
      }
    })

    it('ランクアップ後のbaseStateは元のオブジェクトを変更しない（イミュータブル）', () => {
      const baseState: BaseState = {
        ...createInitialBaseState(),
        capturedDungeons: ['goblin_village_1'],
        gold: 100,
      }
      const result = performRankUp(baseState)
      expect(baseState.rank).toBe(1)
      expect(baseState.gold).toBe(100)
      if (result.success) {
        expect(result.state).not.toBe(baseState)
      }
    })

    it('ゴールドがちょうど必要額ぴったりなら成功する境界値（ランク3: 500G）', () => {
      const baseState: BaseState = {
        ...createInitialBaseState(),
        rank: 2,
        capturedDungeons: ['goblin_village_1', 'human_village'],
        gold: 500,
      }
      const result = performRankUp(baseState)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.state.rank).toBe(3)
        expect(result.state.gold).toBe(0)
      }
    })

    it('全ランクを連続して最後まで正常にランクアップできる', () => {
      let baseState: BaseState = {
        ...createInitialBaseState(),
        gold: 1_000_000,
      }

      for (let i = 0; i < BASE_RANK_CONFIGS.length - 1; i++) {
        const nextConfig = BASE_RANK_CONFIGS[i + 1]
        baseState = captureDungeon(nextConfig.unlockCondition.dungeonId, baseState)
        const result = performRankUp(baseState)
        expect(result.success).toBe(true)
        if (result.success) {
          baseState = result.state
        }
      }

      expect(baseState.rank).toBe(BASE_RANK_CONFIGS[BASE_RANK_CONFIGS.length - 1].rank)
      // 最終ランクからはこれ以上ランクアップできない
      const finalResult = performRankUp(baseState)
      expect(finalResult.success).toBe(false)
    })
  })

  describe('createInitialBaseState', () => {
    it('ランク1の初期状態を返す', () => {
      const baseState = createInitialBaseState()
      expect(baseState.rank).toBe(1)
      expect(baseState.capturedDungeons).toEqual([])
      expect(baseState.currentMaxParties).toBe(BASE_RANK_CONFIGS[0].maxParties)
      expect(baseState.currentMaxGoblins).toBe(BASE_RANK_CONFIGS[0].maxGoblins)
      expect(baseState.capacity).toBe(BASE_RANK_CONFIGS[0].maxGoblins)
      expect(baseState.gold).toBeGreaterThan(0)
    })
  })

  describe('BASE_RANK_CONFIGS の整合性', () => {
    it('ランクは1から7まで連番で定義されている', () => {
      expect(BASE_RANK_CONFIGS.map((c) => c.rank)).toEqual([1, 2, 3, 4, 5, 6, 7])
    })

    it('upgradeCostとmaxParties/maxGoblinsはランクが上がるほど増加する', () => {
      for (let i = 1; i < BASE_RANK_CONFIGS.length; i++) {
        expect(BASE_RANK_CONFIGS[i].upgradeCost).toBeGreaterThan(BASE_RANK_CONFIGS[i - 1].upgradeCost)
        expect(BASE_RANK_CONFIGS[i].maxParties).toBeGreaterThanOrEqual(BASE_RANK_CONFIGS[i - 1].maxParties)
        expect(BASE_RANK_CONFIGS[i].maxGoblins).toBeGreaterThan(BASE_RANK_CONFIGS[i - 1].maxGoblins)
      }
    })
  })
})
