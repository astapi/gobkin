import { describe, it, expect, beforeEach } from 'vitest'
import { BaseManagementService, type BaseState } from './BaseManagementService'
import type { Goblin } from '../../shared/types'

describe('BaseManagementService', () => {
  let service: BaseManagementService
  let mockRandom: () => number

  beforeEach(() => {
    // 固定値を返すモック乱数生成器
    mockRandom = () => 0.5
    service = new BaseManagementService(mockRandom)
  })

  describe('evaluateBirths', () => {
    it('空き枠がない場合は新しいゴブリンを生成しない', () => {
      const state: BaseState = {
        goblins: Array(8).fill(null).map((_, i) => ({
          id: i,
          name: `Goblin${i}`,
          race: 'ゴブリン',
          level: 1,
          avatar: '/test.png',
          stats: { hp: 70, atk: 13, sp: 10, spd: 11, def: 11 },
          equipment: [],
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
      const state: BaseState = {
        goblins: [],
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
      const state: BaseState = {
        goblins: [],
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
      const state: BaseState = {
        goblins: [],
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
      const state: BaseState = {
        goblins: [],
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
      const state: BaseState = {
        goblins: [],
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
      const state: BaseState = {
        goblins: [],
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
      const state: BaseState = {
        goblins: Array(6).fill(null).map((_, i) => ({
          id: i,
          name: `Goblin${i}`,
          race: 'ゴブリン',
          level: 1,
          avatar: '/test.png',
          stats: { hp: 70, atk: 13, sp: 10, spd: 11, def: 11 },
          equipment: [],
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
      const state: BaseState = {
        goblins: [],
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
      const state: BaseState = {
        goblins: [
          {
            id: 5,
            name: 'Goblin5',
            race: 'ゴブリン',
            level: 1,
            avatar: '/test.png',
            stats: { hp: 70, atk: 13, sp: 10, spd: 11, def: 11 },
            equipment: [],
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

  describe('expelGoblin', () => {
    let goblins: Goblin[]

    beforeEach(() => {
      goblins = [
        {
          id: 1,
          name: 'Goblin1',
          race: 'ゴブリン',
          level: 1,
          avatar: '/test.png',
          stats: { hp: 70, atk: 13, sp: 10, spd: 11, def: 11 },
          equipment: [],
        },
        {
          id: 2,
          name: 'Goblin2',
          race: 'ゴブリン',
          level: 1,
          avatar: '/test.png',
          stats: { hp: 70, atk: 13, sp: 10, spd: 11, def: 11 },
          equipment: [],
        },
      ]
    })

    it('指定したIDのゴブリンを削除', () => {
      const result = service.expelGoblin(goblins, 1)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(2)
    })

    it('存在しないIDの場合はエラーをスロー', () => {
      expect(() => {
        service.expelGoblin(goblins, 999)
      }).toThrow('ID 999 のゴブリンは存在しません')
    })
  })

  describe('ゴブリン生成', () => {
    it('生成されたゴブリンは正しいステータス範囲内', () => {
      const state: BaseState = {
        goblins: [],
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

    it('生成されたゴブリンは装備スロットを持つ', () => {
      const state: BaseState = {
        goblins: [],
        capacity: 8,
        rank: 1,
        now: Date.now(),
        lastSpawnTime: Date.now() - 10000,
        slimeCaveCleared: false,
        firstBonusGranted: false,
      }

      const result = service.evaluateBirths(state)
      const goblin = result.newborns[0]

      expect(goblin.equipment).toHaveLength(3)
      expect(goblin.equipment[0].slotIndex).toBe(0)
      expect(goblin.equipment[0].itemId).toBeNull()
    })

    it('生成されたゴブリンはランダムな名前を持つ', () => {
      const state: BaseState = {
        goblins: [],
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
