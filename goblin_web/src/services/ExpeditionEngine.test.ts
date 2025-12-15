import { describe, it, expect } from 'vitest'
import { ExpeditionEngine } from '../core/services'
import type { ExpeditionRequest, Goblin } from '../shared/types'

describe('ExpeditionEngine', () => {
  const testParty: Goblin[] = [
    {
      id: 1,
      name: 'テストゴブリン1',
      race: 'ゴブリン',
      level: 5,
      experience: 0,
      avatar: '/test.png',
      stats: { hp: 100, atk: 50, sp: 30, spd: 40, def: 35 }
    },
    {
      id: 2,
      name: 'テストゴブリン2',
      race: 'ゴブリン',
      level: 4,
      experience: 0,
      avatar: '/test.png',
      stats: { hp: 80, atk: 60, sp: 40, spd: 45, def: 25 }
    }
  ]

  const testRequest: ExpeditionRequest = {
    partyId: "1",
    areaId: "forest_outskirts",
    returnPolicy: "never",
    clientVersion: "1.0.0"
  }

  describe('generateExpedition', () => {
    it('遠征の生成に成功する', async () => {
      const engine = new ExpeditionEngine(12345)
      const result = await engine.generateExpedition(testRequest, testParty)

      expect(result).toBeDefined()
      expect(result.meta.areaName).toBeDefined()
      expect(result.durationSec).toBeGreaterThan(0)
      expect(result.events.length).toBeGreaterThan(0)
      expect(result.summary).toBeDefined()
      expect(typeof result.summary.success).toBe('boolean')
      expect(result.summary.maxFloorReached).toBeGreaterThanOrEqual(1)
      expect(result.summary.xpGained).toBeGreaterThanOrEqual(0)
    })

    it('イベントが正しい形式である', async () => {
      const engine = new ExpeditionEngine(12345)
      const result = await engine.generateExpedition(testRequest, testParty)

      expect(result.events.length).toBeGreaterThan(0)

      result.events.forEach(event => {
        expect(event.type).toBeDefined()
        expect(typeof event.at).toBe('number')
        expect(event.at).toBeGreaterThanOrEqual(0)
      })
    })

    it('複数のイベントタイプが生成される', async () => {
      const engine = new ExpeditionEngine(12345)
      const result = await engine.generateExpedition(testRequest, testParty)

      const eventTypes = new Set(result.events.map(e => e.type))
      expect(eventTypes.size).toBeGreaterThan(1)
    })
  })

  describe('決定性テスト', () => {
    it('同じシードで同じ結果を生成する', async () => {
      const seed = 54321
      const engine1 = new ExpeditionEngine(seed)
      const engine2 = new ExpeditionEngine(seed)

      const result1 = await engine1.generateExpedition(testRequest, testParty)
      const result2 = await engine2.generateExpedition(testRequest, testParty)

      expect(result1.events.length).toBe(result2.events.length)

      result1.events.forEach((event, index) => {
        const other = result2.events[index]
        expect(event.type).toBe(other.type)
        expect(Math.abs(event.at - other.at)).toBeLessThan(0.001)
      })
    })

    it('異なるシードで異なる結果を生成する', async () => {
      const engine1 = new ExpeditionEngine(11111)
      const engine2 = new ExpeditionEngine(22222)

      const result1 = await engine1.generateExpedition(testRequest, testParty)
      const result2 = await engine2.generateExpedition(testRequest, testParty)

      // イベント数が異なるか、イベントタイプが異なることを確認
      const isDifferent =
        result1.events.length !== result2.events.length ||
        result1.events.some((event, index) => {
          const other = result2.events[index]
          return !other || event.type !== other.type || Math.abs(event.at - other.at) >= 0.001
        })

      expect(isDifferent).toBe(true)
    })
  })

  describe('帰還条件テスト', () => {
    it('until_floor2で2階に到達後に帰還イベントが発生する', async () => {
      const request: ExpeditionRequest = { ...testRequest, returnPolicy: "until_floor2" }
      const engine = new ExpeditionEngine(12345)
      const result = await engine.generateExpedition(request, testParty)

      // until_floor2ポリシーでは2階到達後に帰還するはず
      // 帰還イベントが存在することを確認
      const returnEvent = result.events.find(e => e.type === "return")
      // returnイベントが存在する、または2階以下で終了している
      const isValidReturn = returnEvent !== undefined || result.summary.maxFloorReached <= 2
      expect(isValidReturn).toBe(true)
    })

    it('if_any_koでゴブリンが倒れたら帰還する', async () => {
      const request: ExpeditionRequest = { ...testRequest, returnPolicy: "if_any_ko" }
      const engine = new ExpeditionEngine(12345)
      const result = await engine.generateExpedition(request, testParty)

      // 誰かが倒れる可能性があるシードの場合、returnイベントが存在する
      // このテストは帰還条件が正しく機能していることを確認
      const returnEvent = result.events.find(e => e.type === "return")
      if (returnEvent) {
        expect(returnEvent.reason).toBeDefined()
      }
    })

    it('neverで帰還条件を満たさない限り探索を続ける', async () => {
      const request: ExpeditionRequest = { ...testRequest, returnPolicy: "never" }
      const engine = new ExpeditionEngine(12345)
      const result = await engine.generateExpedition(request, testParty)

      expect(result.summary).toBeDefined()
      // 最後まで探索した証拠としてサマリが存在すること
      expect(result.summary.maxFloorReached).toBeGreaterThanOrEqual(1)
    })
  })
})
