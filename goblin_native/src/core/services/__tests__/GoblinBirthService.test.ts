import { GoblinBirthService } from '../GoblinBirthService'
import { calculateIndividualValue, AREA_LEVEL_IV_RANGES, BASE_RANK_BONUS } from '../BaseRankSystem'
import { applyGoblinJob } from '../../../shared/data/goblinJobs'
import {
  calculateGoblinBaseAccuracy,
  calculateGoblinBaseAtk,
  calculateGoblinBaseAttackCount,
  calculateGoblinBaseDef,
  calculateGoblinBaseEvasion,
  calculateGoblinBaseHp,
  getGoblinBaseAttributes,
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
  describe('createNewGoblin の引数パターン', () => {
    it('individualValue を直接指定した場合、その値が使われる', () => {
      const rng = createSeededRng(100)
      const service = new GoblinBirthService(rng)
      const goblin = service.createNewGoblin(1, 32)

      expect(goblin.individualValue).toBe(32)
    })

    it('individualValue=undefined, areaLevel/baseRank指定 → 自動計算される', () => {
      const rng = createSeededRng(200)
      const service = new GoblinBirthService(rng)
      const goblin = service.createNewGoblin(1, undefined, undefined, 3, 2)

      // areaLevel=3: [12,20], baseRank=2: bonus=2 → 14〜22
      const [min, max] = AREA_LEVEL_IV_RANGES[3]
      const bonus = BASE_RANK_BONUS[2]
      expect(goblin.individualValue).toBeGreaterThanOrEqual(min + bonus)
      expect(goblin.individualValue).toBeLessThanOrEqual(max + bonus)
    })

    it('全引数省略時は個体値が1になる', () => {
      const rng = createSeededRng(300)
      const service = new GoblinBirthService(rng)
      const goblin = service.createNewGoblin(1)

      expect(goblin.individualValue).toBe(1)
    })

    it('playback.tsx と同じ呼び出しパターンで正しく動作する', () => {
      // playback.tsx: createNewGoblin(nextId, undefined, goblins, areaLevel, rank)
      const rng = createSeededRng(400)
      const service = new GoblinBirthService(rng)
      const areaLevel = 5
      const rank = 3
      const goblin = service.createNewGoblin(1, undefined, [], areaLevel, rank)

      // areaLevel=5: [26,36], baseRank=3: bonus=4 → 30〜40
      const [min, max] = AREA_LEVEL_IV_RANGES[areaLevel]
      const bonus = BASE_RANK_BONUS[rank]
      expect(goblin.individualValue).toBeGreaterThanOrEqual(min + bonus)
      expect(goblin.individualValue).toBeLessThanOrEqual(max + bonus)
      // 個体値1ではないことを確認（Codex botの指摘が誤りであることの証明）
      expect(goblin.individualValue).toBeGreaterThan(1)
    })

    it('areaLevelのみ指定でbaseRank未指定 → デフォルト1になる', () => {
      const rng = createSeededRng(500)
      const service = new GoblinBirthService(rng)
      // areaLevel指定、baseRank未指定 → calculateIndividualValue は呼ばれず IV=1
      const goblin = service.createNewGoblin(1, undefined, undefined, 3)

      expect(goblin.individualValue).toBe(1)
    })

    it('baseRankのみ指定でareaLevel未指定 → デフォルト1になる', () => {
      const rng = createSeededRng(600)
      const service = new GoblinBirthService(rng)
      const goblin = service.createNewGoblin(1, undefined, undefined, undefined, 3)

      expect(goblin.individualValue).toBe(1)
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

    it('Lv1の基礎ステータス式がそのまま反映される', () => {
      const iterations = 100
      for (let i = 0; i < iterations; i++) {
        const rng = createSeededRng(i * 13)
        const service = new GoblinBirthService(rng)
        const goblin = service.createNewGoblin(i)

        expect(goblin.stats.hp).toBe(19)
        expect(goblin.stats.atk).toBe(11)
        expect(goblin.stats.def).toBe(11)
        expect(goblin.stats.attackCount).toBe(2)
        expect(goblin.stats.accuracy).toBe(62)
        expect(goblin.stats.evasion).toBe(11)
      }
    })

    it('種族ごとの基本能力値が設定される', () => {
      const rng = createSeededRng(701)
      const service = new GoblinBirthService(rng)

      expect(service.createNewGoblin(1).baseAttributes).toEqual({
        power: 10,
        wisdom: 10,
        spirit: 10,
        vitality: 10,
        agility: 10,
        luck: 10,
      })
      expect(getGoblinBaseAttributes({ race: 'スライムゴブリン' }).vitality).toBe(13)
      expect(getGoblinBaseAttributes({ race: 'ウルフゴブリン' }).agility).toBe(13)
      expect(getGoblinBaseAttributes({ race: 'ホブゴブリン' }).power).toBe(13)
      expect(getGoblinBaseAttributes({ race: 'オークゴブリン' }).vitality).toBe(15)
    })

    it('種族ごとのLv1HPが新計算式で決まる', () => {
      const rng = createSeededRng(702)
      const service = new GoblinBirthService(rng)
      const goblin = service.createNewGoblin(1)

      expect(goblin.stats.hp).toBe(19)
      expect(calculateGoblinBaseHp(1, { race: 'スライムゴブリン' })).toBe(29)
      expect(calculateGoblinBaseHp(1, { race: 'ウルフゴブリン' })).toBe(20)
      expect(calculateGoblinBaseHp(1, { race: 'ホブゴブリン' })).toBe(25)
      expect(calculateGoblinBaseHp(1, { race: 'オークゴブリン' })).toBe(38)
    })

    it('種族ごとのLv1基礎ステータスが式どおり決まる', () => {
      expect(calculateGoblinBaseAtk(1, { race: 'ゴブリン' })).toBe(11)
      expect(calculateGoblinBaseAtk(1, { race: 'スライムゴブリン' })).toBe(9)
      expect(calculateGoblinBaseAtk(1, { race: 'ウルフゴブリン' })).toBe(12)
      expect(calculateGoblinBaseAtk(1, { race: 'ホブゴブリン' })).toBe(15)
      expect(calculateGoblinBaseAtk(1, { race: 'オークゴブリン' })).toBe(17)

      expect(calculateGoblinBaseDef(1, { race: 'ゴブリン' })).toBe(11)
      expect(calculateGoblinBaseDef(1, { race: 'スライムゴブリン' })).toBe(15)
      expect(calculateGoblinBaseDef(1, { race: 'ウルフゴブリン' })).toBe(11)
      expect(calculateGoblinBaseDef(1, { race: 'ホブゴブリン' })).toBe(12)
      expect(calculateGoblinBaseDef(1, { race: 'オークゴブリン' })).toBe(17)

      expect(calculateGoblinBaseAccuracy(1, { race: 'ゴブリン' })).toBe(62)
      expect(calculateGoblinBaseAccuracy(1, { race: 'スライムゴブリン' })).toBe(60)
      expect(calculateGoblinBaseAccuracy(1, { race: 'ウルフゴブリン' })).toBe(64)
      expect(calculateGoblinBaseAccuracy(1, { race: 'ホブゴブリン' })).toBe(65)
      expect(calculateGoblinBaseAccuracy(1, { race: 'オークゴブリン' })).toBe(64)

      expect(calculateGoblinBaseEvasion(1, { race: 'ゴブリン' })).toBe(11)
      expect(calculateGoblinBaseEvasion(1, { race: 'スライムゴブリン' })).toBe(10)
      expect(calculateGoblinBaseEvasion(1, { race: 'ウルフゴブリン' })).toBe(14)
      expect(calculateGoblinBaseEvasion(1, { race: 'ホブゴブリン' })).toBe(12)
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

    it('個体値は1〜64にクランプされる', () => {
      const rng = createSeededRng(800)
      const service = new GoblinBirthService(rng)

      const goblinLow = service.createNewGoblin(1, -5)
      expect(goblinLow.individualValue).toBe(1)

      const rng2 = createSeededRng(801)
      const service2 = new GoblinBirthService(rng2)
      const goblinHigh = service2.createNewGoblin(2, 100)
      expect(goblinHigh.individualValue).toBe(64)
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
      expect(goblin1.individualValue).toBe(goblin2.individualValue)
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

      const goblin = service.createNewGoblin(2, 10, [parent], undefined, 1)

      expect(goblin.raceId).toBe('goblin')
      expect(goblin.factors).toEqual(['wolf'])
      expect(goblin.skills.map((skill) => skill.id)).toEqual([
        'goblin_pack_tactics',
        'exp_bonus_70',
        'talent_accuracy_150',
        'attack_count_up_2',
        'equipment_accuracy_200',
        'additional_damage_13',
      ])
    })
  })
})

describe('calculateIndividualValue', () => {
  it('areaLevel=1, baseRank=1 → 1〜8の範囲', () => {
    for (let seed = 0; seed < 100; seed++) {
      const rng = createSeededRng(seed)
      const iv = calculateIndividualValue(1, 1, rng)
      expect(iv).toBeGreaterThanOrEqual(1)
      expect(iv).toBeLessThanOrEqual(8)
    }
  })

  it('拠点ランクボーナスが加算される', () => {
    // 固定乱数(常に0を返す) → ベース値は範囲の最小値
    const fixedZero = () => 0
    const ivRank1 = calculateIndividualValue(1, 1, fixedZero) // [1,8] + 0 = 1
    const ivRank3 = calculateIndividualValue(1, 3, fixedZero) // [1,8] + 4 = 5

    expect(ivRank1).toBe(1)
    expect(ivRank3).toBe(5)
  })

  it('高エリアレベルほどベース個体値が高い', () => {
    const fixedHalf = () => 0.5
    const ivLow = calculateIndividualValue(1, 1, fixedHalf)
    const ivHigh = calculateIndividualValue(8, 1, fixedHalf)

    expect(ivHigh).toBeGreaterThan(ivLow)
  })

  it('結果は1〜64にクランプされる', () => {
    // 最大ケース: areaLevel=8 [50,60] + rank7 bonus=12 → 最大72 → クランプ64
    const fixedOne = () => 0.999
    const iv = calculateIndividualValue(8, 7, fixedOne)
    expect(iv).toBeLessThanOrEqual(64)

    // 最小ケース
    const fixedZero = () => 0
    const ivMin = calculateIndividualValue(1, 1, fixedZero)
    expect(ivMin).toBeGreaterThanOrEqual(1)
  })

  it('範囲外の低areaLevelはデフォルト範囲[1,8]にフォールバック', () => {
    const fixedZero = () => 0
    const iv = calculateIndividualValue(0, 1, fixedZero)
    expect(iv).toBe(1)
  })

  it('areaLevel=9以上は最高エリア帯の範囲を使う', () => {
    const fixedZero = () => 0
    const iv = calculateIndividualValue(99, 1, fixedZero)
    expect(iv).toBe(50)
  })
})
