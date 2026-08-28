import { GoblinBirthService } from '../GoblinBirthService'
import { applyGoblinJob } from '../../../shared/data/goblinJobs'
import {
  calculateGoblinBaseAccuracy,
  calculateGoblinBaseAtk,
  calculateGoblinBaseAttackCount,
  calculateGoblinBaseDef,
  calculateGoblinBaseEvasion,
  calculateGoblinBaseHp,
  getGoblinBaseAttributeMaximums,
  getGoblinBaseAttributes,
  getGoblinBaseAttributesAtLevel,
  getGoblinHpLevelScale,
} from '../../../shared/utils/goblinHp'

/**
 * シード付き乱数生成器（テスト再現性のため）
 */
function createSeededRng(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 0x100000000
    return (state >>> 0) / 0x100000000
  }
}

function sequenceRng(values: number[]): () => number {
  let index = 0
  return () => values[index++] ?? 0
}

describe('GoblinBirthService', () => {
  it('固定した因子元から＋値と因子を使って生成できる', () => {
    const service = new GoblinBirthService(() => 0)
    const goblin = service.createNewGoblinFromFactorSources(99, 24, ['slime'], 2)

    expect(goblin.id).toBe(99)
    expect(goblin.plusValue).toBe(24)
    expect(goblin.factors).toEqual(['slime'])
    expect(goblin.raceId).toBe('slime')
  })

  it('ウルフゴブリンは＋5以上でのみ誕生候補になる', () => {
    const belowThreshold = new GoblinBirthService(() => 0)
      .createNewGoblinFromFactorSources(1, 4, ['wolf'])
    const atThreshold = new GoblinBirthService(() => 0)
      .createNewGoblinFromFactorSources(2, 5, ['wolf'])

    expect(belowThreshold.raceId).toBe('goblin')
    expect(atThreshold.raceId).toBe('wolf')
  })

  describe('createNewGoblin の引数パターン', () => {
    it('plusValue を直接指定した場合、その値が使われる', () => {
      const rng = createSeededRng(100)
      const service = new GoblinBirthService(rng)
      const goblin = service.createNewGoblin(1, 32)

      expect(goblin.plusValue).toBe(32)
    })

    it('全引数省略時は＋0になる', () => {
      const rng = createSeededRng(300)
      const service = new GoblinBirthService(rng)
      const goblin = service.createNewGoblin(1)

      expect(goblin.plusValue).toBe(0)
    })
  })

  describe('生成されるゴブリンの基本構造', () => {
    it('必須フィールドが全て存在する', () => {
      const rng = createSeededRng(700)
      const service = new GoblinBirthService(rng)
      const goblin = service.createNewGoblin(42)

      expect(goblin.id).toBe(42)
      expect(typeof goblin.name).toBe('string')
      expect(goblin.name.length).toBeGreaterThan(0)
      expect(goblin.race).toBe('ゴブリン')
      expect(goblin.level).toBe(1)
      expect(goblin.experience).toBe(0)
      expect(goblin.stats).toBeDefined()
      expect(goblin.stats.hp).toBeGreaterThan(0)
      expect(goblin.stats.atk).toBeGreaterThan(0)
      expect(goblin.stats.def).toBeGreaterThan(0)
    })

    it('誕生時の基本能力値は種族基準値から-5〜+3の範囲で決まる', () => {
      const iterations = 100
      for (let i = 0; i < iterations; i++) {
        const rng = createSeededRng(i * 13)
        const service = new GoblinBirthService(rng)
        const goblin = service.createNewGoblin(i)

        expect(goblin.baseAttributes).toBeDefined()
        for (const value of Object.values(goblin.baseAttributes!)) {
          expect(value).toBeGreaterThanOrEqual(5)
          expect(value).toBeLessThanOrEqual(13)
        }
      }
    })

    it('基本能力値はレベルごとに+1され、種族最大値で止まる', () => {
      const rng = sequenceRng([0, 5 / 8, 5 / 8, 5 / 8, 5 / 8, 5 / 8, 5 / 8])
      const service = new GoblinBirthService(rng)
      const goblin = service.createNewGoblin(1)

      expect(goblin.baseAttributes).toEqual({
        power: 10,
        wisdom: 10,
        spirit: 10,
        vitality: 10,
        agility: 10,
        luck: 10,
      })
      expect(getGoblinBaseAttributeMaximums(goblin)).toEqual({
        power: 20,
        wisdom: 20,
        spirit: 20,
        vitality: 20,
        agility: 20,
        luck: 20,
      })
      expect(getGoblinBaseAttributesAtLevel(goblin, 1)).toEqual(goblin.baseAttributes)
      expect(getGoblinBaseAttributesAtLevel(goblin, 11)).toEqual(getGoblinBaseAttributeMaximums(goblin))

      expect(getGoblinBaseAttributeMaximums({ race: 'スライムゴブリン', raceId: 'slime' }).vitality).toBe(20)
      expect(getGoblinBaseAttributeMaximums({ race: 'ウルフゴブリン', raceId: 'wolf' }).agility).toBe(20)
      expect(getGoblinBaseAttributeMaximums({ race: 'ホブゴブリン', raceId: 'hobgoblin' }).power).toBe(20)
      expect(getGoblinBaseAttributeMaximums({ race: 'オークゴブリン', raceId: 'orc' }).vitality).toBe(20)
    })

    it('種族ごとのLv1HPが新計算式で決まる', () => {
      const rng = sequenceRng([0, 5 / 8, 5 / 8, 5 / 8, 5 / 8, 5 / 8, 5 / 8])
      const service = new GoblinBirthService(rng)
      const goblin = service.createNewGoblin(1)

      expect(goblin.stats.hp).toBe(19)
      expect(calculateGoblinBaseHp(1, { race: 'スライムゴブリン', raceId: 'slime' })).toBe(23)
      expect(calculateGoblinBaseHp(1, { race: 'ウルフゴブリン', raceId: 'wolf' })).toBe(20)
      expect(calculateGoblinBaseHp(1, { race: 'ホブゴブリン', raceId: 'hobgoblin' })).toBe(23)
      expect(calculateGoblinBaseHp(1, { race: 'オークゴブリン', raceId: 'orc' })).toBe(26)
    })

    it('種族ごとのLv1基礎ステータスが式どおり決まる', () => {
      expect(calculateGoblinBaseAtk(1, { race: 'ゴブリン' })).toBe(11)
      expect(calculateGoblinBaseAtk(1, { race: 'スライムゴブリン' })).toBe(9)
      expect(calculateGoblinBaseAtk(1, { race: 'ウルフゴブリン' })).toBe(11)
      expect(calculateGoblinBaseAtk(1, { race: 'ホブゴブリン' })).toBe(11)
      expect(calculateGoblinBaseAtk(1, { race: 'オークゴブリン' })).toBe(12)

      expect(calculateGoblinBaseDef(1, { race: 'ゴブリン' })).toBe(11)
      expect(calculateGoblinBaseDef(1, { race: 'スライムゴブリン' })).toBe(11)
      expect(calculateGoblinBaseDef(1, { race: 'ウルフゴブリン' })).toBe(11)
      expect(calculateGoblinBaseDef(1, { race: 'ホブゴブリン' })).toBe(11)
      expect(calculateGoblinBaseDef(1, { race: 'オークゴブリン' })).toBe(12)

      expect(calculateGoblinBaseAccuracy(1, { race: 'ゴブリン' })).toBe(62)
      expect(calculateGoblinBaseAccuracy(1, { race: 'スライムゴブリン' })).toBe(60)
      expect(calculateGoblinBaseAccuracy(1, { race: 'ウルフゴブリン' })).toBe(62)
      expect(calculateGoblinBaseAccuracy(1, { race: 'ホブゴブリン' })).toBe(62)
      expect(calculateGoblinBaseAccuracy(1, { race: 'オークゴブリン' })).toBe(61)

      expect(calculateGoblinBaseEvasion(1, { race: 'ゴブリン' })).toBe(11)
      expect(calculateGoblinBaseEvasion(1, { race: 'スライムゴブリン' })).toBe(10)
      expect(calculateGoblinBaseEvasion(1, { race: 'ウルフゴブリン' })).toBe(11)
      expect(calculateGoblinBaseEvasion(1, { race: 'ホブゴブリン' })).toBe(11)
      expect(calculateGoblinBaseEvasion(1, { race: 'オークゴブリン' })).toBe(9)

      expect(calculateGoblinBaseAttackCount(1, { race: 'ゴブリン' })).toBe(2)
      expect(calculateGoblinBaseAttackCount(1, { race: 'スライムゴブリン' })).toBe(2)
      expect(calculateGoblinBaseAttackCount(1, { race: 'ウルフゴブリン' })).toBe(2)
      expect(calculateGoblinBaseAttackCount(1, { race: 'ホブゴブリン' })).toBe(2)
      expect(calculateGoblinBaseAttackCount(1, { race: 'オークゴブリン' })).toBe(2)
    })

    it('純ゴブリンはジョブ変更時にジョブ係数でHPが変わる', () => {
      const rng = createSeededRng(703)
      const service = new GoblinBirthService(rng)
      const goblin = service.createNewGoblin(1)

      expect(applyGoblinJob(goblin, 'guard').stats.hp).toBe(24)
      expect(applyGoblinJob(goblin, 'warrior').stats.hp).toBe(25)
      expect(applyGoblinJob(goblin, 'thief').stats.hp).toBe(19)
      expect(applyGoblinJob(goblin, 'mage').stats.hp).toBe(18)
    })

    it('Lv依存式は指定された区分で変化する', () => {
      expect(getGoblinHpLevelScale(30, 'ゴブリン')).toBeCloseTo(3)
      expect(getGoblinHpLevelScale(31, 'ゴブリン')).toBeCloseTo(3.15)
      expect(getGoblinHpLevelScale(80, 'ゴブリン')).toBeCloseTo(12)
      expect(getGoblinHpLevelScale(81, 'スライムゴブリン')).toBeCloseTo(12.45)
      expect(getGoblinHpLevelScale(120, 'ゴブリン')).toBeCloseTo(18.75)
      expect(getGoblinHpLevelScale(120, 'ホブゴブリン')).toBeCloseTo(30)
    })

    it('＋値は0以上の整数に正規化される', () => {
      const rng = createSeededRng(800)
      const service = new GoblinBirthService(rng)

      const goblinLow = service.createNewGoblin(1, -5)
      expect(goblinLow.plusValue).toBe(0)

      const rng2 = createSeededRng(801)
      const service2 = new GoblinBirthService(rng2)
      const goblinHigh = service2.createNewGoblin(2, 100)
      expect(goblinHigh.plusValue).toBe(100)
    })

    it('同じシードで同じゴブリンが生成される（決定論的）', () => {
      const rng1 = createSeededRng(999)
      const service1 = new GoblinBirthService(rng1)
      const goblin1 = service1.createNewGoblin(1, 10)

      const rng2 = createSeededRng(999)
      const service2 = new GoblinBirthService(rng2)
      const goblin2 = service2.createNewGoblin(1, 10)

      expect(goblin1.name).toBe(goblin2.name)
      expect(goblin1.stats).toEqual(goblin2.stats)
      expect(goblin1.plusValue).toBe(goblin2.plusValue)
    })

    it('因子を継承した純ゴブリンは抽選枠内で亜種固有スキルを継承する', () => {
      const parent = {
        id: 1,
        name: '親ゴブリン',
        race: 'ゴブリン',
        raceId: 'goblin' as const,
        level: 1,
        experience: 0,
        avatar: '/src/assets/goblin/goblin.png',
        stats: {
          hp: 19,
          atk: 11,
          magicAtk: 10,
          def: 11,
          magicDef: 10,
          attackCount: 2,
          accuracy: 62,
          evasion: 11,
          magicHeal: 10,
          criticalRate: 0,
        },
        skills: [],
        factors: ['wolf'],
      }
      const rng = sequenceRng([0, 0.99, 0, 0, 0, 0])
      const service = new GoblinBirthService(rng)

      const goblin = service.createNewGoblin(2, 10, [parent], 1)

      expect(goblin.raceId).toBe('goblin')
      expect(goblin.factors).toEqual(['wolf'])
      expect(goblin.skills.map((skill) => skill.id)).toEqual([
        'goblin_pack_tactics',
        'talent_accuracy_150',
        'attack_count_up_2',
        'equipment_accuracy_200',
        'additional_damage_13',
      ])
    })
  })
})
