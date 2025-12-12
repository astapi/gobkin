import { describe, it, expect } from 'vitest'
import {
  getExpForNextLevel,
  getTotalExpForLevel,
  calculateLevelFromExp,
  addExperience,
  getExpProgress,
} from './ExperienceSystem'

describe('ExperienceSystem', () => {
  describe('getExpForNextLevel', () => {
    it('LV1→2は10 expが必要', () => {
      expect(getExpForNextLevel(1)).toBe(10)
    })

    it('LV50以下は指数1.5の曲線', () => {
      expect(getExpForNextLevel(10)).toBe(316)
      expect(getExpForNextLevel(50)).toBe(3536)
    })

    it('LV51-100は指数2.0の曲線', () => {
      expect(getExpForNextLevel(51)).toBe(26010)
      expect(getExpForNextLevel(100)).toBe(100000)
    })

    it('LV101-150は指数2.5の曲線', () => {
      expect(getExpForNextLevel(101)).toBe(1025188)
      expect(getExpForNextLevel(150)).toBe(2755676)
    })

    it('LV151-200は指数3.0の曲線', () => {
      expect(getExpForNextLevel(151)).toBe(34429510)
      expect(getExpForNextLevel(199)).toBe(78805990)
    })

    it('LV200（上限）では0を返す', () => {
      expect(getExpForNextLevel(200)).toBe(0)
    })
  })

  describe('getTotalExpForLevel', () => {
    it('LV1の累計経験値は0', () => {
      expect(getTotalExpForLevel(1)).toBe(0)
    })

    it('LV2の累計経験値は10', () => {
      expect(getTotalExpForLevel(2)).toBe(10)
    })

    it('LV10の累計経験値が正しく計算される', () => {
      const total = getTotalExpForLevel(10)
      expect(total).toBeGreaterThan(0)
      // LV1→2(10) + LV2→3(28) + ... の累計
      let manual = 0
      for (let i = 1; i < 10; i++) {
        manual += getExpForNextLevel(i)
      }
      expect(total).toBe(manual)
    })
  })

  describe('calculateLevelFromExp', () => {
    it('経験値0ならLV1', () => {
      expect(calculateLevelFromExp(0)).toBe(1)
    })

    it('経験値10でLV2', () => {
      expect(calculateLevelFromExp(10)).toBe(2)
    })

    it('経験値が累計に達したらレベルアップ', () => {
      const expForLv3 = getTotalExpForLevel(3)
      expect(calculateLevelFromExp(expForLv3)).toBe(3)
    })

    it('経験値が足りなければレベルアップしない', () => {
      const expForLv3 = getTotalExpForLevel(3)
      expect(calculateLevelFromExp(expForLv3 - 1)).toBe(2)
    })
  })

  describe('addExperience', () => {
    it('経験値を加算してもレベルアップしない場合', () => {
      const result = addExperience(1, 0, 5)
      expect(result.newLevel).toBe(1)
      expect(result.oldLevel).toBe(1)
      expect(result.levelsGained).toBe(0)
      expect(result.remainingExp).toBe(5)
      expect(result.didLevelUp).toBe(false)
    })

    it('経験値10でLV1→2にレベルアップ', () => {
      const result = addExperience(1, 0, 10)
      expect(result.newLevel).toBe(2)
      expect(result.oldLevel).toBe(1)
      expect(result.levelsGained).toBe(1)
      expect(result.remainingExp).toBe(0)
      expect(result.didLevelUp).toBe(true)
    })

    it('余剰経験値が次のレベルに持ち越される', () => {
      const result = addExperience(1, 0, 15)
      expect(result.newLevel).toBe(2)
      expect(result.remainingExp).toBe(5)
    })

    it('複数レベル同時にアップ可能', () => {
      // LV1→2: 10, LV2→3: 28, 合計38
      const result = addExperience(1, 0, 38)
      expect(result.newLevel).toBe(3)
      expect(result.levelsGained).toBe(2)
      expect(result.remainingExp).toBe(0)
    })

    it('LV200（上限）ではそれ以上レベルアップしない', () => {
      const result = addExperience(200, 0, 999999)
      expect(result.newLevel).toBe(200)
      expect(result.levelsGained).toBe(0)
      expect(result.didLevelUp).toBe(false)
    })
  })

  describe('getExpProgress', () => {
    it('経験値0なら進捗0%', () => {
      expect(getExpProgress(1, 0)).toBe(0)
    })

    it('経験値5/10なら進捗50%', () => {
      expect(getExpProgress(1, 5)).toBe(0.5)
    })

    it('経験値10/10なら進捗100%（レベルアップ直前）', () => {
      expect(getExpProgress(1, 10)).toBe(1.0)
    })

    it('LV200では進捗100%', () => {
      expect(getExpProgress(200, 0)).toBe(1.0)
    })
  })

  describe('スライムの洞窟でのレベルアップ検証', () => {
    it('ボス戦前（平均10 exp）でLV1→2にレベルアップする', () => {
      // フロア1: 5 exp, フロア2: 5 exp = 合計10 exp
      const result = addExperience(1, 0, 10)
      expect(result.newLevel).toBe(2)
      expect(result.didLevelUp).toBe(true)
    })

    it('ボス戦後（15 exp追加）でさらに経験値が蓄積される', () => {
      // ボス前: 10 exp（LV2）
      let result = addExperience(1, 0, 10)
      expect(result.newLevel).toBe(2)

      // ボス: 15 exp追加
      result = addExperience(result.newLevel, result.remainingExp, 15)
      expect(result.newLevel).toBe(2) // LV2→3には28 exp必要なのでまだLV2
      expect(result.remainingExp).toBe(15) // 次のレベルまで残り13 exp
    })
  })
})
