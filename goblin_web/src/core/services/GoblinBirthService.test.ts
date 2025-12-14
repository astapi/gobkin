import { describe, it, expect, beforeEach } from 'vitest'
import { GoblinBirthService, type BirthEvaluationState } from './GoblinBirthService'

describe('GoblinBirthService', () => {
  let service: GoblinBirthService
  let mockRandom: () => number

  beforeEach(() => {
    // 固定値を返すモック乱数生成器
    mockRandom = () => 0.5
    service = new GoblinBirthService(mockRandom)
  })

  describe('evaluateBirths', () => {
    it('空き枠がない場合は新しいゴブリンを生成しない', () => {
      const state: BirthEvaluationState = {
        currentGoblins: Array(8).fill(null).map((_, i) => ({
          id: i,
          name: `Goblin${i}`,
          race: 'ゴブリン',
          level: 1,
          experience: 0,
          avatar: '/test.png',
          stats: { hp: 70, atk: 13, sp: 10, spd: 11, def: 11 }
        })),
        capacity: 8,
        rank: 1,
        now: Date.now(),
        lastSpawnTime: Date.now() - 60000,
        slimeCaveCleared: false,
        firstBonusGranted: false,
      }

      const result = service.evaluateBirths(state)

      expect(result.newborns).toHaveLength(0)
      expect(result.availableSlots).toBe(0)
    })

    it('スライム洞窟クリア時に初回ボーナスで1体を生成', () => {
      const state: BirthEvaluationState = {
        currentGoblins: [],
        capacity: 8,
        rank: 1,
        now: Date.now(),
        lastSpawnTime: Date.now(),
        slimeCaveCleared: true,
        firstBonusGranted: false,
      }

      const result = service.evaluateBirths(state)

      expect(result.newborns).toHaveLength(1)
      expect(result.firstBonusGranted).toBe(true)
      expect(result.newborns[0].level).toBe(1)
      expect(result.newborns[0].race).toBe('ゴブリン')
    })

    it('初回ボーナス受け取り済みの場合は再度生成しない', () => {
      const state: BirthEvaluationState = {
        currentGoblins: [],
        capacity: 8,
        rank: 1,
        now: Date.now(),
        lastSpawnTime: Date.now(),
        slimeCaveCleared: true,
        firstBonusGranted: true,
      }

      const result = service.evaluateBirths(state)

      expect(result.newborns).toHaveLength(0)
      expect(result.firstBonusGranted).toBe(true)
    })

    it('10秒経過した場合にランク1で1体生成', () => {
      const now = Date.now()
      const state: BirthEvaluationState = {
        currentGoblins: [],
        capacity: 8,
        rank: 1,
        now,
        lastSpawnTime: now - 10000, // 10秒前
        slimeCaveCleared: false,
        firstBonusGranted: false,
      }

      const result = service.evaluateBirths(state)

      expect(result.newborns).toHaveLength(1)
      expect(result.updatedLastSpawnTime).toBe(now - 10000 + 10000)
    })

    it('20秒経過した場合にランク1で2体生成', () => {
      const now = Date.now()
      const state: BirthEvaluationState = {
        currentGoblins: [],
        capacity: 8,
        rank: 1,
        now,
        lastSpawnTime: now - 20000, // 20秒前
        slimeCaveCleared: false,
        firstBonusGranted: false,
      }

      const result = service.evaluateBirths(state)

      expect(result.newborns).toHaveLength(2)
    })

    it('ランク2の場合は1インターバルで2体生成', () => {
      const now = Date.now()
      const state: BirthEvaluationState = {
        currentGoblins: [],
        capacity: 8,
        rank: 2,
        now,
        lastSpawnTime: now - 10000, // 10秒前
        slimeCaveCleared: false,
        firstBonusGranted: false,
      }

      const result = service.evaluateBirths(state)

      expect(result.newborns).toHaveLength(2)
    })

    it('ランク5の場合は1インターバルで3体生成', () => {
      const now = Date.now()
      const state: BirthEvaluationState = {
        currentGoblins: [],
        capacity: 8,
        rank: 5,
        now,
        lastSpawnTime: now - 10000, // 10秒前
        slimeCaveCleared: false,
        firstBonusGranted: false,
      }

      const result = service.evaluateBirths(state)

      expect(result.newborns).toHaveLength(3)
    })

    it('空き枠を超えて生成しない', () => {
      const now = Date.now()
      const state: BirthEvaluationState = {
        currentGoblins: Array(6).fill(null).map((_, i) => ({
          id: i,
          name: `Goblin${i}`,
          race: 'ゴブリン',
          level: 1,
          experience: 0,
          avatar: '/test.png',
          stats: { hp: 70, atk: 13, sp: 10, spd: 11, def: 11 }
        })),
        capacity: 8, // 空き枠は2
        rank: 5,
        now,
        lastSpawnTime: now - 10000,
        slimeCaveCleared: false,
        firstBonusGranted: false,
      }

      const result = service.evaluateBirths(state)

      expect(result.newborns).toHaveLength(2) // 3体生成可能だが空き枠が2
      expect(result.availableSlots).toBe(0)
    })

    it('nextGoblinIdを正しく管理', () => {
      const state: BirthEvaluationState = {
        currentGoblins: [],
        capacity: 8,
        rank: 1,
        now: Date.now(),
        lastSpawnTime: Date.now() - 10000,
        slimeCaveCleared: false,
        firstBonusGranted: false,
        nextGoblinId: 100,
      }

      const result = service.evaluateBirths(state)

      expect(result.newborns[0].id).toBe(100)
      expect(result.nextGoblinId).toBe(101)
    })

    it('nextGoblinIdが未指定の場合は既存ゴブリンIDから計算', () => {
      const state: BirthEvaluationState = {
        currentGoblins: [
          {
            id: 5,
            name: 'Goblin5',
            race: 'ゴブリン',
            level: 1,
            experience: 0,
            avatar: '/test.png',
            stats: { hp: 70, atk: 13, sp: 10, spd: 11, def: 11 }
          },
        ],
        capacity: 8,
        rank: 1,
        now: Date.now(),
        lastSpawnTime: Date.now() - 10000,
        slimeCaveCleared: false,
        firstBonusGranted: false,
      }

      const result = service.evaluateBirths(state)

      expect(result.newborns[0].id).toBe(6)
      expect(result.nextGoblinId).toBe(7)
    })
  })

  describe('ゴブリン生成', () => {
    it('生成されたゴブリンは正しいステータス範囲内', () => {
      const state: BirthEvaluationState = {
        currentGoblins: [],
        capacity: 8,
        rank: 1,
        now: Date.now(),
        lastSpawnTime: Date.now() - 10000,
        slimeCaveCleared: false,
        firstBonusGranted: false,
      }

      const result = service.evaluateBirths(state)
      const goblin = result.newborns[0]

      expect(goblin.stats.hp).toBeGreaterThanOrEqual(55)
      expect(goblin.stats.hp).toBeLessThanOrEqual(80)
      expect(goblin.stats.atk).toBeGreaterThanOrEqual(10)
      expect(goblin.stats.atk).toBeLessThanOrEqual(16)
      expect(goblin.stats.sp).toBeGreaterThanOrEqual(7)
      expect(goblin.stats.sp).toBeLessThanOrEqual(13)
      expect(goblin.stats.spd).toBeGreaterThanOrEqual(8)
      expect(goblin.stats.spd).toBeLessThanOrEqual(14)
      expect(goblin.stats.def).toBeGreaterThanOrEqual(8)
      expect(goblin.stats.def).toBeLessThanOrEqual(14)
    })

    it('evaluateBirthsで生成されたゴブリンはデフォルト個体値1を持つ', () => {
      const state: BirthEvaluationState = {
        currentGoblins: [],
        capacity: 8,
        rank: 1,
        now: Date.now(),
        lastSpawnTime: Date.now() - 10000,
        slimeCaveCleared: false,
        firstBonusGranted: false,
      }

      const result = service.evaluateBirths(state)
      const goblin = result.newborns[0]

      expect(goblin.individualValue).toBe(1)
    })

    it('createNewGoblinで個体値を指定できる', () => {
      const goblin = service.createNewGoblin(1, 32)
      expect(goblin.individualValue).toBe(32)
    })

    it('createNewGoblinで個体値を省略した場合はデフォルト値1', () => {
      const goblin = service.createNewGoblin(1)
      expect(goblin.individualValue).toBe(1)
    })

    it('個体値は1〜64の範囲にクランプされる', () => {
      const goblinLow = service.createNewGoblin(1, 0)
      expect(goblinLow.individualValue).toBe(1)

      const goblinHigh = service.createNewGoblin(2, 100)
      expect(goblinHigh.individualValue).toBe(64)
    })

    it('生成されたゴブリンはランダムな名前を持つ', () => {
      const state: BirthEvaluationState = {
        currentGoblins: [],
        capacity: 8,
        rank: 1,
        now: Date.now(),
        lastSpawnTime: Date.now() - 10000,
        slimeCaveCleared: false,
        firstBonusGranted: false,
      }

      const result = service.evaluateBirths(state)
      const goblin = result.newborns[0]

      expect(goblin.name).toBeTruthy()
      expect(typeof goblin.name).toBe('string')
      expect(goblin.name.length).toBeGreaterThan(0)
    })
  })
})
