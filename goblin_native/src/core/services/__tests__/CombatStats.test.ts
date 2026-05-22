import { GoblinBirthService } from '../GoblinBirthService'
import { GoblinStatCalculator } from '../GoblinStatCalculator'
import { BattleSystem, getDamageModifier, getAccuracyModifier, getHitRateRandomModifier, getRowWeight, selectTarget } from '../BattleSystem'
import { ExpeditionEngine } from '../ExpeditionEngine'
import { getDefaultSkillsForRace } from '../../../shared/data/raceSkills'
import { getCharacterSkill } from '../../../shared/data/skillCatalog'
import { EquipmentService } from '../EquipmentService'
import { getEquipmentTemplate } from '../../../shared/data/equipmentPoolLoader'
import { factorDatabase } from '../../../shared/data/factors'
import type { Goblin, Enemy } from '../../../shared/types'

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

/**
 * テスト用の最小限のゴブリンを作成
 */
function createTestGoblin(
  overrides: Omit<Partial<Goblin>, 'stats'> & { stats?: Partial<Goblin['stats']> & { agility?: number } } = {}
): Goblin {
  const race = overrides.race ?? 'ゴブリン'
  const agilityOverride = overrides.stats?.agility ?? overrides.baseAttributes?.agility
  const { agility: _ignoredAgility, ...statsOverrides } = overrides.stats ?? {}
  return {
    id: 1,
    name: 'テストゴブリン',
    race,
    level: 1,
    experience: 0,
    avatar: '/test.png',
    stats: { hp: 60, atk: 12, magicAtk: 0, def: 10, attackCount: 2, accuracy: 20, evasion: 15, magicHeal: 10, criticalRate: 0, ...statsOverrides },
    skills: overrides.skills ?? getDefaultSkillsForRace(race),
    factors: [],
    ...overrides,
    baseAttributes: overrides.baseAttributes,
    ...(agilityOverride !== undefined ? { agility: agilityOverride } : {}),
  } as Goblin
}

/**
 * テスト用の最小限の敵を作成
 */
function createTestEnemy(overrides: Partial<Enemy> & { agility?: number } = {}): Enemy {
  const { agility, ...rest } = overrides
  return {
    id: 'E_TEST',
    name: 'テスト敵',
    attackType: 'melee',
    raceTags: ['beast'],
    level: 1,
    hp: 30,
    baseAttributes: {
      power: 5,
      wisdom: 5,
      spirit: 5,
      vitality: 5,
      agility: overrides.baseAttributes?.agility ?? agility ?? 5,
      luck: 5,
    },
    atk: 5,
    def: 5,
    attackCount: 1,
    accuracy: 20,
    evasion: 10,
    exp: 10,
    gold: 10,
    ...rest,
  }
}

// =========================================================================
// getDamageModifier / getAccuracyModifier
// =========================================================================
describe('getDamageModifier', () => {
  it('1回目は1.0', () => {
    expect(getDamageModifier(1)).toBe(1.0)
  })

  it('遠距離攻撃軽減はrange通常攻撃だけを軽減する', () => {
    const defender = createTestGoblin({
      id: 1,
      stats: { hp: 300, atk: 1, agility: 1, def: 10, attackCount: 0, accuracy: 999, evasion: 0 },
      skills: [{ id: 'ranged_attack_reduction_50', rangedAttackDamageReductionPercent: 50 }],
    })
    const rangedAttacker = createTestEnemy({
      id: 'RANGED',
      name: '弓兵',
      attackType: 'range',
      hp: 300,
      atk: 90,
      def: 1,
      agility: 100,
      attackCount: 1,
      accuracy: 999,
      evasion: 0,
    })
    const meleeAttacker = createTestEnemy({
      id: 'MELEE',
      name: '兵士',
      attackType: 'melee' as const,
      hp: 300,
      atk: 90,
      def: 1,
      agility: 100,
      attackCount: 1,
      accuracy: 999,
      evasion: 0,
    })

    const rangedResult = new BattleSystem().executeBattle(
      [defender],
      [defender.stats.hp],
      [[], [], [], [], [], [rangedAttacker]],
      () => 0.5,
      1,
    )
    const meleeResult = new BattleSystem().executeBattle(
      [defender],
      [defender.stats.hp],
      [[meleeAttacker]],
      () => 0.5,
      1,
    )

    const rangedDamage = rangedResult.detailedLog.find(log => log.actorId === 'RANGED' && log.action === '通常攻撃')!.targets[0].totalDamage
    const meleeDamage = meleeResult.detailedLog.find(log => log.actorId === 'MELEE' && log.action === '通常攻撃')!.targets[0].totalDamage

    expect(rangedDamage).toBeGreaterThanOrEqual(Math.floor(meleeDamage * 0.45))
    expect(rangedDamage).toBeLessThanOrEqual(Math.ceil(meleeDamage * 0.55))
  })

  it('2回目は1.0', () => {
    expect(getDamageModifier(2)).toBe(1.0)
  })

  it('3回目は0.9', () => {
    expect(getDamageModifier(3)).toBeCloseTo(0.9, 5)
  })

  it('4回目は0.81', () => {
    expect(getDamageModifier(4)).toBeCloseTo(0.81, 5)
  })

  it('10回目は0.9^8 ≈ 0.4305', () => {
    expect(getDamageModifier(10)).toBeCloseTo(Math.pow(0.9, 8), 4)
  })
})

describe('getAccuracyModifier', () => {
  it('1回目は1.0', () => {
    expect(getAccuracyModifier(1)).toBe(1.0)
  })

  it('2回目は0.6', () => {
    expect(getAccuracyModifier(2)).toBeCloseTo(0.6, 5)
  })

  it('3回目は0.54', () => {
    expect(getAccuracyModifier(3)).toBeCloseTo(0.54, 5)
  })

  it('4回目は0.486', () => {
    expect(getAccuracyModifier(4)).toBeCloseTo(0.486, 5)
  })

  it('10回目は0.6 * 0.9^8 ≈ 0.2583', () => {
    expect(getAccuracyModifier(10)).toBeCloseTo(0.6 * Math.pow(0.9, 8), 4)
  })
})

describe('getHitRateRandomModifier', () => {
  it('rng=0 のとき 0.95 になる', () => {
    expect(getHitRateRandomModifier(() => 0)).toBeCloseTo(0.95, 5)
  })

  it('rng=0.5 のとき 1.0 になる', () => {
    expect(getHitRateRandomModifier(() => 0.5)).toBeCloseTo(1.0, 5)
  })

  it('rng が 1 未満なら 1.05 未満に収まる', () => {
    expect(getHitRateRandomModifier(() => 0.999999)).toBeLessThan(1.05)
  })
})

describe('BattleSystem — 戦闘ログ', () => {
  it('攻撃対象の詳細を列番号の小さい順に並べる', () => {
    const battle = new BattleSystem()
    const details = new Map([
      ['row3', {
        targetId: 'row3',
        targetName: '列3',
        targetRow: 3,
        totalDamage: 10,
        hitCount: 1,
        defeated: false,
        targetHP: 90,
      }],
      ['row1', {
        targetId: 'row1',
        targetName: '列1',
        targetRow: 1,
        totalDamage: 20,
        hitCount: 2,
        defeated: false,
        targetHP: 80,
      }],
      ['row2', {
        targetId: 'row2',
        targetName: '列2',
        targetRow: 2,
        totalDamage: 10,
        hitCount: 1,
        defeated: false,
        targetHP: 90,
      }],
    ])

    const sorted = (battle as any).getSortedTargetDetails(details)

    expect(sorted.map((detail: { targetName: string }) => detail.targetName)).toEqual(['列1', '列2', '列3'])
  })
})

// =========================================================================
// GoblinBirthService — 新ステータスの生成
// =========================================================================
describe('GoblinBirthService — 戦闘ステータス生成', () => {
  it('生成されたゴブリンにattackCount, accuracy, evasionが含まれる', () => {
    const rng = createSeededRng(100)
    const service = new GoblinBirthService(rng)
    const goblin = service.createNewGoblin(1)

    expect(goblin.stats.attackCount).toBeDefined()
    expect(goblin.stats.accuracy).toBeDefined()
    expect(goblin.stats.evasion).toBeDefined()
  })

  it('ゴブリンのattackCountは算出式で2になる', () => {
    const rng = createSeededRng(200)
    const service = new GoblinBirthService(rng)
    const goblin = service.createNewGoblin(1)

    expect(goblin.race).toBe('ゴブリン')
    expect(goblin.stats.attackCount).toBe(2)
  })

  it('accuracyは誕生時の基本能力値ゆらぎ込みの範囲に収まる', () => {
    for (let i = 0; i < 100; i++) {
      const rng = createSeededRng(i * 7)
      const service = new GoblinBirthService(rng)
      const goblin = service.createNewGoblin(i)

      expect(goblin.stats.accuracy).toBeGreaterThanOrEqual(55)
      expect(goblin.stats.accuracy).toBeLessThanOrEqual(70)
    }
  })

  it('evasionは誕生時の基本能力値ゆらぎ込みの範囲に収まる', () => {
    for (let i = 0; i < 100; i++) {
      const rng = createSeededRng(i * 11)
      const service = new GoblinBirthService(rng)
      const goblin = service.createNewGoblin(i)

      expect(goblin.stats.evasion).toBeGreaterThanOrEqual(5)
      expect(goblin.stats.evasion).toBeLessThanOrEqual(15)
    }
  })

  it('effectiveStatsにも新ステータスが反映される', () => {
    const rng = createSeededRng(300)
    const service = new GoblinBirthService(rng)
    const goblin = service.createNewGoblin(1)

    expect(goblin.effectiveStats).toBeDefined()
    expect(goblin.effectiveStats!.attackCount).toBe(goblin.stats.attackCount)
    expect(goblin.effectiveStats!.accuracy).toBe(goblin.stats.accuracy)
    expect(goblin.effectiveStats!.evasion).toBe(goblin.stats.evasion)
  })
})

// =========================================================================
// GoblinStatCalculator — 新ステータスの計算
// =========================================================================
describe('GoblinStatCalculator — 戦闘ステータス計算', () => {
  it('基本ステータスがそのまま反映される（因子/装備なし）', () => {
    const goblin = createTestGoblin()
    const result = GoblinStatCalculator.calculate(goblin)

    expect(result.attackCount).toBe(2)
    expect(result.accuracy).toBe(20)
    expect(result.evasion).toBe(15)
  })

  it('装備のaccuracy_flatが加算される', () => {
    const goblin = createTestGoblin()
    const bonuses = [{ stat: 'accuracy_flat' as const, value: 10 }]
    const result = GoblinStatCalculator.calculate(goblin, bonuses)

    expect(result.accuracy).toBe(30)
  })

  it('装備のevasion_flatが加算される', () => {
    const goblin = createTestGoblin()
    const bonuses = [{ stat: 'evasion_flat' as const, value: 5 }]
    const result = GoblinStatCalculator.calculate(goblin, bonuses)

    expect(result.evasion).toBe(20)
  })

  it('装備のattackCount_flatが加算される', () => {
    const goblin = createTestGoblin()
    const bonuses = [{ stat: 'attackCount_flat' as const, value: 1 }]
    const result = GoblinStatCalculator.calculate(goblin, bonuses)

    expect(result.attackCount).toBe(3)
  })

  it('magicHealは精神とレベル式から算出される', () => {
    const goblin = createTestGoblin({
      level: 3,
      baseAttributes: { power: 10, wisdom: 10, spirit: 10, vitality: 10, agility: 10, luck: 10 },
    })
    const result = GoblinStatCalculator.calculate(goblin)

    expect(result.magicHeal).toBe(18)
  })

  it('[才能]スキルは各基礎ステータス式へ1.5倍を適用する', () => {
    const baseAttributes = { power: 10, wisdom: 10, spirit: 10, vitality: 10, agility: 10, luck: 10 }
    const skillCases = [
      ['talent_hp_150', 'hp', 62],
      ['talent_atk_150', 'atk', 22],
      ['talent_def_150', 'def', 22],
      ['talent_magicAtk_150', 'magicAtk', 22],
      ['talent_magicDef_150', 'magicDef', 22],
      ['talent_attackCount_150', 'attackCount', 3],
      ['talent_evasion_150', 'evasion', 22],
      ['talent_accuracy_150', 'accuracy', 102],
    ] as const

    for (const [skillId, stat, expected] of skillCases) {
      const goblin = createTestGoblin({
        level: 3,
        skills: [getCharacterSkill(skillId)],
        baseAttributes,
      })
      const result = GoblinStatCalculator.calculate(goblin)

      expect(result[stat]).toBe(expected)
    }

    const criticalGoblin = createTestGoblin({
      level: 3,
      skills: [getCharacterSkill('talent_criticalRate_150')],
      baseAttributes: { power: 10, wisdom: 10, spirit: 10, vitality: 10, agility: 30, luck: 15 },
    })

    expect(GoblinStatCalculator.calculate(criticalGoblin).criticalRate).toBe(14)
  })

  it('magicHealに因子・装備補正が適用される', () => {
    factorDatabase.test_magic_heal = {
      id: 'test_magic_heal',
      name: 'テスト回復因子',
      description: 'テスト用',
      inheritProbability: 1,
      effects: [{ type: 'stat_bonus', target: 'magicHeal', value: 10 }],
    }
    const goblin = createTestGoblin({
      level: 3,
      baseAttributes: { power: 10, wisdom: 10, spirit: 10, vitality: 10, agility: 10, luck: 10 },
      factors: ['test_magic_heal'],
    })
    const bonuses = [{ stat: 'magicHeal_flat' as const, value: 3 }]
    const result = GoblinStatCalculator.calculate(goblin, bonuses)

    expect(result.magicHeal).toBe(31)
    delete factorDatabase.test_magic_heal
  })

  it('魔法回復量HP変換スキルはmagicHealを減らさずHPへ加算する', () => {
    const baseGoblin = createTestGoblin({
      level: 3,
      skills: [],
      baseAttributes: { power: 10, wisdom: 10, spirit: 10, vitality: 10, agility: 10, luck: 10 },
    })
    const skilledGoblin = createTestGoblin({
      level: 3,
      skills: [{ id: 'magic_heal_to_hp_10', magicHealToHpPercent: 10 }],
      baseAttributes: { power: 10, wisdom: 10, spirit: 10, vitality: 10, agility: 10, luck: 10 },
    })
    const bonuses = [{ stat: 'magicHeal_flat' as const, value: 20 }]
    const baseResult = GoblinStatCalculator.calculate(baseGoblin, bonuses)
    const skilledResult = GoblinStatCalculator.calculate(skilledGoblin, bonuses)

    expect(skilledResult.magicHeal).toBe(baseResult.magicHeal)
    expect(skilledResult.hp).toBe(baseResult.hp + Math.floor(skilledResult.magicHeal * 0.1))
  })

  it('装備のattackCount_flatがマイナスでも攻撃回数は最低1になる', () => {
    const goblin = createTestGoblin()
    const bonuses = [
      { stat: 'attackCount_flat' as const, value: -0.6 },
      { stat: 'attackCount_flat' as const, value: -0.6 },
    ]
    const result = GoblinStatCalculator.calculate(goblin, bonuses)

    expect(result.attackCount).toBe(1)
  })

  it('装備の%ボーナスが乗算される', () => {
    const goblin = createTestGoblin({
      stats: { hp: 60, atk: 12, def: 10, attackCount: 2, accuracy: 100, evasion: 100 },
    })
    const bonuses = [
      { stat: 'atk_percent' as const, value: 50 },
      { stat: 'def_percent' as const, value: 30 },
    ]
    const result = GoblinStatCalculator.calculate(goblin, bonuses)

    expect(result.atk).toBe(18)  // 12 * 1.5
    expect(result.def).toBe(13)  // 10 * 1.3
  })

  it('ウルフゴブリンは攻撃回数が+2される', () => {
    const goblin = createTestGoblin({
      race: 'ウルフゴブリン',
      stats: { hp: 60, atk: 12, agility: 10, def: 10, attackCount: 3, accuracy: 20, evasion: 15 },
    })
    const result = GoblinStatCalculator.calculate(goblin)

    expect(result.attackCount).toBe(5)
  })

  it('スライムゴブリンは鎧の能力値が1.3倍になる', () => {
    const goblin = createTestGoblin({ race: 'スライムゴブリン' })
    const result = GoblinStatCalculator.calculate(goblin, [
      { stat: 'def_flat', value: 10, sourceCategory: 'armor' },
    ])

    expect(result.def).toBe(23)
  })

  it('ウルフゴブリンは装備の命中精度補正が2倍になる', () => {
    const goblin = createTestGoblin({ race: 'ウルフゴブリン' })
    const result = GoblinStatCalculator.calculate(goblin, [
      { stat: 'accuracy_flat', value: 10, sourceCategory: 'weapon' },
    ])

    expect(result.accuracy).toBe(40)
  })

  it('アイテム魔法攻撃力スキルは装備の魔法攻撃力補正を2倍にする', () => {
    const goblin = createTestGoblin({
      skills: [{ id: 'equipment_magic_atk_200', equipmentStatMultipliers: { magic_atk_flat: 2 } }],
    })
    const result = GoblinStatCalculator.calculate(goblin, [
      { stat: 'magic_atk_flat', value: 10, sourceCategory: 'wand' },
    ])

    expect(result.magicAtk).toBe(20)
  })

  it('アイテム魔法攻撃力スキルは他の装備ステータス補正を強化しない', () => {
    const goblin = createTestGoblin({
      skills: [{ id: 'equipment_magic_atk_200', equipmentStatMultipliers: { magic_atk_flat: 2 } }],
    })
    const result = GoblinStatCalculator.calculate(goblin, [
      { stat: 'accuracy_flat', value: 10, sourceCategory: 'wand' },
    ])

    expect(result.accuracy).toBe(30)
  })

  it('剣装備スキルは剣カテゴリ装備の能力値を倍率強化する', () => {
    const goblin = createTestGoblin({
      skills: [{ id: 'sword_mastery_150', weaponSubCategoryMultiplier: { sword: 1.5 } }],
    })
    const result = GoblinStatCalculator.calculate(goblin, [
      { stat: 'atk_flat', value: 10, sourceCategory: 'weapon', sourceSubCategory: 'sword' },
    ])

    expect(result.atk).toBe(27)
  })

  it('剣装備スキルは弓カテゴリ装備の能力値を強化しない', () => {
    const goblin = createTestGoblin({
      skills: [{ id: 'sword_mastery_150', weaponSubCategoryMultiplier: { sword: 1.5 } }],
    })
    const result = GoblinStatCalculator.calculate(goblin, [
      { stat: 'atk_flat', value: 10, sourceCategory: 'weapon', sourceSubCategory: 'bow' },
    ])

    expect(result.atk).toBe(22)
  })

  it('爪装備スキルは爪カテゴリ装備の能力値を倍率強化する', () => {
    const goblin = createTestGoblin({
      skills: [{ id: 'claw_mastery_150', weaponSubCategoryMultiplier: { claw: 1.5 } }],
    })
    const result = GoblinStatCalculator.calculate(goblin, [
      { stat: 'atk_flat', value: 10, sourceCategory: 'weapon', sourceSubCategory: 'claw' },
    ])

    expect(result.atk).toBe(27)
  })

  it('爪装備スキルは剣カテゴリ装備の能力値を強化しない', () => {
    const goblin = createTestGoblin({
      skills: [{ id: 'claw_mastery_150', weaponSubCategoryMultiplier: { claw: 1.5 } }],
    })
    const result = GoblinStatCalculator.calculate(goblin, [
      { stat: 'atk_flat', value: 10, sourceCategory: 'weapon', sourceSubCategory: 'sword' },
    ])

    expect(result.atk).toBe(22)
  })

  it('ワンド装備スキルはワンドカテゴリ装備の能力値を倍率強化する', () => {
    const goblin = createTestGoblin({
      skills: [{ id: 'wand_mastery_150', equipmentCategoryMultiplier: { wand: 1.5 } }],
    })
    const result = GoblinStatCalculator.calculate(goblin, [
      { stat: 'magic_atk_flat', value: 10, sourceCategory: 'wand' },
    ])

    expect(result.magicAtk).toBe(15)
  })

  it('ワンド装備スキルはロッドカテゴリ装備の能力値を強化しない', () => {
    const goblin = createTestGoblin({
      skills: [{ id: 'wand_mastery_150', equipmentCategoryMultiplier: { wand: 1.5 } }],
    })
    const result = GoblinStatCalculator.calculate(goblin, [
      { stat: 'magic_atk_flat', value: 10, sourceCategory: 'rod' },
    ])

    expect(result.magicAtk).toBe(10)
  })

  it('ロッド装備スキルはロッドカテゴリ装備の能力値を倍率強化する', () => {
    const goblin = createTestGoblin({
      skills: [{ id: 'rod_mastery_150', equipmentCategoryMultiplier: { rod: 1.5 } }],
    })
    const result = GoblinStatCalculator.calculate(goblin, [
      { stat: 'magic_atk_flat', value: 10, sourceCategory: 'rod' },
    ])

    expect(result.magicAtk).toBe(15)
  })

  it('ロッド装備スキルはワンドカテゴリ装備の能力値を強化しない', () => {
    const goblin = createTestGoblin({
      skills: [{ id: 'rod_mastery_150', equipmentCategoryMultiplier: { rod: 1.5 } }],
    })
    const result = GoblinStatCalculator.calculate(goblin, [
      { stat: 'magic_atk_flat', value: 10, sourceCategory: 'wand' },
    ])

    expect(result.magicAtk).toBe(10)
  })

  it('シールド装備スキルはシールドカテゴリ装備の能力値を倍率強化する', () => {
    const goblin = createTestGoblin({
      skills: [{ id: 'shield_mastery_200', equipmentCategoryMultiplier: { shield: 2.0 } }],
    })
    const result = GoblinStatCalculator.calculate(goblin, [
      { stat: 'def_flat', value: 10, sourceCategory: 'shield' },
      { stat: 'magic_def_flat', value: 10, sourceCategory: 'shield' },
    ])

    expect(result.def).toBe(30)
    expect(result.magicDef).toBe(31)
  })

  it('ローブ装備スキルはローブカテゴリ装備の能力値を倍率強化する', () => {
    const goblin = createTestGoblin({
      skills: [{ id: 'robe_mastery_200', equipmentCategoryMultiplier: { robe: 2.0 } }],
    })
    const result = GoblinStatCalculator.calculate(goblin, [
      { stat: 'magic_def_flat', value: 10, sourceCategory: 'robe' },
      { stat: 'hp_percent', value: 10, sourceCategory: 'robe' },
    ])

    expect(result.magicDef).toBe(31)
    expect(result.hp).toBe(72)
  })

  it('EquipmentServiceは装備カテゴリをボーナスへ保持する', () => {
    const bonuses = EquipmentService.calculateEquipmentBonuses([
      { id: 'eq1', templateId: 'sword_cypress_stick', slotIndex: 0, goblinId: 1 },
    ])

    expect(bonuses[0].sourceCategory).toBe('weapon')
  })

  it('EquipmentServiceは武器サブカテゴリをボーナスへ保持する', () => {
    const bonuses = EquipmentService.calculateEquipmentBonuses([
      { id: 'eq1', templateId: 'sword_cypress_stick', slotIndex: 0, goblinId: 1 },
    ])

    expect(bonuses[0].sourceSubCategory).toBe('sword')
  })

  it('EquipmentServiceは称号付き装備のプラス補正を倍率適用する', () => {
    const bonuses = EquipmentService.calculateEquipmentBonuses([
      { id: 'eq1', templateId: 'sword_broad', slotIndex: 0, goblinId: 1, titleId: 'masterwork' },
    ])

    expect(bonuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ stat: 'atk_flat', value: 15, sourceCategory: 'weapon' }),
      expect.objectContaining({ stat: 'def_flat', value: 3, sourceCategory: 'weapon' }),
    ]))
  })

  it('EquipmentServiceは称号付き装備のマイナス補正を倍率適用する', () => {
    const bonuses = EquipmentService.calculateEquipmentBonuses([
      { id: 'eq1', templateId: 'armor_armor', slotIndex: 0, goblinId: 1, titleId: 'masterwork' },
    ])

    expect(bonuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ stat: 'critical_rate_percent', value: -2, sourceCategory: 'armor' }),
      expect.objectContaining({ stat: 'def_flat', value: 13, sourceCategory: 'armor' }),
      expect.objectContaining({ stat: 'hp_flat', value: 19, sourceCategory: 'armor' }),
    ]))
  })

  it('EquipmentServiceは武器能力値を通常ボーナスとして扱う', () => {
    const bonuses = EquipmentService.calculateEquipmentBonuses([
      { id: 'eq1', templateId: 'sword_broad', slotIndex: 0, goblinId: 1 },
    ])

    expect(bonuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ stat: 'accuracy_flat', value: 32, sourceCategory: 'weapon' }),
      expect.objectContaining({ stat: 'attackCount_flat', value: -0.2, sourceCategory: 'weapon' }),
    ]))
  })

  it('EquipmentServiceは同一装備数に応じたペナルティ倍率を返す', () => {
    expect(EquipmentService.getDuplicatePenaltyPercent(1)).toBe(100)
    expect(EquipmentService.getDuplicatePenaltyPercent(2)).toBe(100)
    expect(EquipmentService.getDuplicatePenaltyPercent(3)).toBe(90)
    expect(EquipmentService.getDuplicatePenaltyPercent(4)).toBe(80)
    expect(EquipmentService.getDuplicatePenaltyPercent(5)).toBe(70)
    expect(EquipmentService.getDuplicatePenaltyPercent(7)).toBe(70)
    expect(EquipmentService.getDuplicatePenaltyPercent(8)).toBe(60)
    expect(EquipmentService.getDuplicatePenaltyPercent(9)).toBe(50)
    expect(EquipmentService.getDuplicatePenaltyPercent(10)).toBe(40)
    expect(EquipmentService.getDuplicatePenaltyPercent(11)).toBe(30)
    expect(EquipmentService.getDuplicatePenaltyPercent(12)).toBe(40)
    expect(EquipmentService.getDuplicatePenaltyPercent(13)).toBe(10)
    expect(EquipmentService.getDuplicatePenaltyPercent(14)).toBe(1)
    expect(EquipmentService.getDuplicatePenaltyPercent(20)).toBe(1)
  })

  it('EquipmentServiceは同一装備3個の能力値を90%にする', () => {
    const bonuses = EquipmentService.calculateEquipmentBonuses([
      { id: 'eq1', templateId: 'sword_broad', slotIndex: 0, goblinId: 1 },
      { id: 'eq2', templateId: 'sword_broad', slotIndex: 1, goblinId: 1 },
      { id: 'eq3', templateId: 'sword_broad', slotIndex: 2, goblinId: 1 },
    ])

    expect(bonuses.filter((bonus) => bonus.stat === 'atk_flat')).toEqual([
      expect.objectContaining({ value: 10.8 }),
      expect.objectContaining({ value: 10.8 }),
      expect.objectContaining({ value: 10.8 }),
    ])
  })

  it('EquipmentServiceは称号補正後の能力値に同一装備ペナルティを適用する', () => {
    const bonuses = EquipmentService.calculateEquipmentBonuses([
      { id: 'eq1', templateId: 'sword_broad', slotIndex: 0, goblinId: 1, titleId: 'masterwork' },
      { id: 'eq2', templateId: 'sword_broad', slotIndex: 1, goblinId: 1 },
      { id: 'eq3', templateId: 'sword_broad', slotIndex: 2, goblinId: 1 },
    ])

    expect(bonuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ stat: 'atk_flat', value: 13.5, sourceCategory: 'weapon' }),
    ]))
  })

  it('EquipmentServiceは称号付き装備のパッシブスキルにも倍率適用する', () => {
    const skills = EquipmentService.collectGrantedSkills([
      { id: 'eq1', templateId: 'sword_broad', slotIndex: 0, goblinId: 1, titleId: 'masterwork' },
    ])

    expect(skills).toEqual(expect.arrayContaining([
      expect.objectContaining({ defToHpPercent: 2 }),
    ]))
  })

  it('EquipmentServiceは装備に応じた物理ダメージ軽減スキルを付与・解除する', () => {
    const goblin = createTestGoblin({ skills: [] })
    const equipment = { id: 'eq1', templateId: 'armor_armor', slotIndex: -1, goblinId: null }

    const equipResult = EquipmentService.equip(goblin, equipment, 0, [])

    expect(equipResult.success).toBe(true)
    expect(goblin.skills.some((skill) => skill.physicalDamageReductionPercent === 6)).toBe(true)

    EquipmentService.unequip(equipment, goblin)

    expect(goblin.skills.some((skill) => skill.physicalDamageReductionPercent === 6)).toBe(false)
  })

  it('ローブ装備は魔法防御・HP%・魔法耐性スキルを持つ', () => {
    const bonuses = EquipmentService.calculateEquipmentBonuses([
      { id: 'eq1', templateId: 'robe_robe', slotIndex: 0, goblinId: 1 },
    ])
    const skills = EquipmentService.collectGrantedSkills([
      { id: 'eq1', templateId: 'robe_robe', slotIndex: 0, goblinId: 1 },
    ])

    expect(bonuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ stat: 'magic_def_flat', value: 16, sourceCategory: 'robe' }),
      expect.objectContaining({ stat: 'hp_percent', value: 6, sourceCategory: 'robe' }),
    ]))
    expect(skills).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'magic_resistant_4_5', magicDamageTakenMultiplier: 0.8 }),
      expect.objectContaining({ id: 'magic_reduction_6', magicDamageReductionPercent: 6 }),
    ]))
  })

  it('EquipmentServiceは爪装備に応じた攻撃回数スキルを付与・解除する', () => {
    const goblin = createTestGoblin({ skills: [] })
    const equipment = { id: 'eq1', templateId: 'claw_kaiser', slotIndex: -1, goblinId: null }

    const equipResult = EquipmentService.equip(goblin, equipment, 0, [])

    expect(equipResult.success).toBe(true)
    expect(goblin.skills.some((skill) => skill.statBonuses?.attackCount === 8)).toBe(true)

    EquipmentService.unequip(equipment, goblin)

    expect(goblin.skills.some((skill) => skill.statBonuses?.attackCount === 8)).toBe(false)
  })

  it('melee武器には[武器]近距離攻撃スキルが付与される', () => {
    const template = getEquipmentTemplate('sword_cypress_stick')

    expect(template?.grantedSkills?.some((skill) => skill.id === 'weapon_melee_attack')).toBe(true)
  })

  it('ranged武器には[武器]遠距離攻撃スキルが付与される', () => {
    const template = getEquipmentTemplate('bow_short')

    expect(template?.grantedSkills?.some((skill) => skill.id === 'weapon_ranged_attack')).toBe(true)
  })
})

describe('BattleSystem - 2回行動', () => {
  it('2回行動スキルを持つユニットは1ターンに2回行動する', () => {
    const battleSystem = new BattleSystem()
    const rng = createSeededRng(1234)
    const attacker = createTestGoblin({
      id: 1,
      skills: [getCharacterSkill('two_actions')],
      stats: { atk: 20, attackCount: 1, accuracy: 999, criticalRate: 0, agility: 50 },
      battleActionPolicy: { attackRate: 100, clericMagicRate: 0, mageMagicRate: 0 },
    })
    const enemy = createTestEnemy({
      id: 'DOUBLE_ACTION_TARGET',
      hp: 999,
      atk: 1,
      def: 1,
      attackCount: 1,
      accuracy: 0,
      evasion: 0,
      agility: 1,
      battleActionPolicy: { attackRate: 0, clericMagicRate: 0, mageMagicRate: 0 },
    })

    const result = battleSystem.executeBattle([attacker], [60], [[enemy]], rng, 1)
    const attackerLogs = result.detailedLog.filter(
      log => log.turn === 1 && log.actorId === '1' && log.action === '通常攻撃',
    )

    expect(attackerLogs).toHaveLength(2)
  })

  it('2回行動スキルがないユニットは1ターンに1回だけ行動する', () => {
    const battleSystem = new BattleSystem()
    const rng = createSeededRng(1234)
    const attacker = createTestGoblin({
      id: 1,
      stats: { atk: 20, attackCount: 1, accuracy: 999, criticalRate: 0, agility: 50 },
      battleActionPolicy: { attackRate: 100, clericMagicRate: 0, mageMagicRate: 0 },
    })
    const enemy = createTestEnemy({
      id: 'SINGLE_ACTION_TARGET',
      hp: 999,
      atk: 1,
      def: 1,
      attackCount: 1,
      accuracy: 0,
      evasion: 0,
      agility: 1,
      battleActionPolicy: { attackRate: 0, clericMagicRate: 0, mageMagicRate: 0 },
    })

    const result = battleSystem.executeBattle([attacker], [60], [[enemy]], rng, 1)
    const attackerLogs = result.detailedLog.filter(
      log => log.turn === 1 && log.actorId === '1' && log.action === '通常攻撃',
    )

    expect(attackerLogs).toHaveLength(1)
  })
})

// =========================================================================
// BattleSystem — 命中判定と複数回攻撃（集約ログ）
// =========================================================================
describe('BattleSystem — 命中判定と複数回攻撃', () => {
  it('攻撃回数3の場合、1つのログエントリにまとまる', () => {
    const allies = [createTestGoblin({
      stats: { hp: 100, atk: 50, agility: 100, def: 10, attackCount: 3, accuracy: 999, evasion: 10 },
    })]
    const enemies = [[createTestEnemy({ hp: 9999, agility: 1, evasion: 0 })]]

    const rng = createSeededRng(42)
    const battle = new BattleSystem()
    const result = battle.executeBattle(allies, [100], enemies, rng, 1)

    const allyAttackLogs = result.detailedLog.filter(log => log.action === '通常攻撃' && log.isAlly)
    // 1ユニットにつき1ログ
    expect(allyAttackLogs.length).toBe(1)
    expect(allyAttackLogs[0].attackCount).toBe(3)
  })

  it('集約ログにattackCount, hitCount, targetsが含まれる', () => {
    const allies = [createTestGoblin({
      stats: { hp: 100, atk: 50, agility: 100, def: 10, attackCount: 3, accuracy: 999, evasion: 10 },
    })]
    const enemies = [[createTestEnemy({ hp: 9999, agility: 1, evasion: 0 })]]

    const rng = createSeededRng(42)
    const battle = new BattleSystem()
    const result = battle.executeBattle(allies, [100], enemies, rng, 1)

    const log = result.detailedLog.find(log => log.action === '通常攻撃' && log.isAlly)!
    expect(log.attackCount).toBe(3)
    expect(log.hitCount).toBeGreaterThan(0)
    expect(log.targets.length).toBeGreaterThan(0)
    expect(log.targets[0].totalDamage).toBeGreaterThan(0)
    expect(log.targets[0].hitCount).toBeGreaterThan(0)
  })

  it('通常攻撃のダメージ減衰はミスを除いた命中HIT番号で決まる', () => {
    const fakeDamageCalculator = {
      calcDamage: jest.fn(() => 100),
    }
    const battle = new BattleSystem(undefined, fakeDamageCalculator as any)
    const attacker: any = {
      combatant: {
        id: '1',
        name: '攻撃者',
        atk: 100,
        def: 0,
        attackCount: 3,
        accuracy: 999,
        evasion: 0,
        raceTags: ['goblin'],
      },
      currentHP: 100,
      maxHP: 100,
      power: 10,
      agility: 10,
      luck: 10,
      attackCount: 3,
      accuracy: 999,
      evasion: 0,
      isAlly: true,
      originalIndex: 0,
      damageReduction: 0,
      physicalDamageReduction: 0,
      rangedAttackDamageReduction: 0,
      magicDamageReduction: 0,
      breathDamageReduction: 0,
      shieldBarrierDamageReduction: 0,
      shieldBarrierBreathDamageReduction: 0,
      magicBarrierDamageReduction: 0,
      physicalDamageDealtMultiplier: 1,
      physicalDamagePercent: 0,
      magicAtk: 0,
      magicHeal: 0,
      criticalRate: 0,
      criticalDamageBonusPercent: 0,
      spellDamagePercent: 0,
      magicFieldDamageMultiplier: 1,
      row: 0,
      rowSlot: 0,
      level: 1,
      spellCharges: [],
      skills: [],
      battleActionPolicy: {},
      isDefending: false,
      attackType: 'melee' as const,
    }
    const target: any = {
      ...attacker,
      combatant: {
        id: 'E',
        name: '対象',
        atk: 0,
        def: 0,
        attackCount: 0,
        accuracy: 0,
        evasion: 0,
        raceTags: ['human'],
      },
      currentHP: 1000,
      maxHP: 1000,
      isAlly: false,
    }
    const rolls = [
      0.99, // critical判定: 非クリティカル
      0.5, 0.99, // 1試行目: 命中率乱数, ミス
      0.5, 0.99, // 2試行目: 命中率乱数, ミス
      0.5, 0.0,  // 3試行目: 命中率乱数, 初命中
    ]
    const rng = () => rolls.shift() ?? 0

    const result = (battle as any).executeBasicAttack(
      attacker,
      [target],
      [attacker],
      [attacker],
      1,
      [],
      new Set(),
      new Set(),
      rng,
      3,
      0,
    )

    const detail = [...result.targetDetails.values()][0]
    expect(result.totalHitCount).toBe(1)
    expect(detail.totalDamage).toBe(100)
  })

  it('会心威力スキルは会心時の通常攻撃ダメージを増加させる', () => {
    const fakeDamageCalculator = {
      calcDamage: jest.fn(() => 100),
    }
    const battle = new BattleSystem(undefined, fakeDamageCalculator as any)
    const attacker: any = {
      combatant: {
        id: '1',
        name: '攻撃者',
        atk: 100,
        def: 0,
        attackCount: 1,
        accuracy: 999,
        evasion: 0,
        raceTags: ['goblin'],
      },
      currentHP: 100,
      maxHP: 100,
      power: 10,
      agility: 10,
      luck: 10,
      attackCount: 1,
      accuracy: 999,
      evasion: 0,
      isAlly: true,
      originalIndex: 0,
      damageReduction: 0,
      physicalDamageReduction: 0,
      rangedAttackDamageReduction: 0,
      magicDamageReduction: 0,
      breathDamageReduction: 0,
      shieldBarrierDamageReduction: 0,
      shieldBarrierBreathDamageReduction: 0,
      magicBarrierDamageReduction: 0,
      physicalDamageDealtMultiplier: 1,
      physicalDamagePercent: 0,
      magicAtk: 0,
      magicHeal: 0,
      criticalRate: 100,
      criticalDamageBonusPercent: 50,
      spellDamagePercent: 0,
      magicFieldDamageMultiplier: 1,
      row: 0,
      rowSlot: 0,
      level: 1,
      spellCharges: [],
      skills: [{ id: 'critical_damage_50', criticalDamageBonusPercent: 50 }],
      battleActionPolicy: {},
      isDefending: false,
      attackType: 'melee',
    }
    const target: any = {
      ...attacker,
      combatant: {
        id: 'E',
        name: '対象',
        atk: 0,
        def: 0,
        attackCount: 0,
        accuracy: 0,
        evasion: 0,
        raceTags: ['human'],
      },
      currentHP: 1000,
      maxHP: 1000,
      isAlly: false,
      criticalRate: 0,
      criticalDamageBonusPercent: 0,
    }

    const result = (battle as any).executeBasicAttack(
      attacker,
      [target],
      [attacker],
      [attacker],
      1,
      [],
      new Set(),
      new Set(),
      () => 0,
      1,
      100,
    )

    const detail = [...result.targetDetails.values()][0]
    expect(result.isCritical).toBe(true)
    expect(detail.totalDamage).toBe(150)
  })

  it('命中精度0・回避極大でほぼ全ミスになる', () => {
    const allies = [createTestGoblin({
      stats: { hp: 100, atk: 50, agility: 100, def: 10, attackCount: 1, accuracy: 0, evasion: 10 },
    })]
    const enemies = [[createTestEnemy({ hp: 9999, agility: 1, evasion: 999 })]]

    const rng = createSeededRng(1)
    const battle = new BattleSystem()
    const result = battle.executeBattle(allies, [100], enemies, rng, 100)

    const allyAttackLogs = result.detailedLog.filter(log => log.action === '通常攻撃' && log.isAlly)
    const totalAttacks = allyAttackLogs.reduce((sum, log) => sum + log.attackCount, 0)
    const totalHits = allyAttackLogs.reduce((sum, log) => sum + log.hitCount, 0)

    // 命中率下限5%なので、ほとんどがミスになるはず（90%以上ミス）
    expect((totalAttacks - totalHits) / totalAttacks).toBeGreaterThan(0.8)
  })

  it('命中精度極大・回避0でほぼ全ヒットになる', () => {
    const allies = [createTestGoblin({
      stats: { hp: 100, atk: 50, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 10 },
    })]
    const enemies = [[createTestEnemy({ hp: 9999, agility: 1, evasion: 0 })]]

    const rng = createSeededRng(2)
    const battle = new BattleSystem()
    const result = battle.executeBattle(allies, [100], enemies, rng, 100)

    const allyAttackLogs = result.detailedLog.filter(log => log.action === '通常攻撃' && log.isAlly)
    const totalAttacks = allyAttackLogs.reduce((sum, log) => sum + log.attackCount, 0)
    const totalHits = allyAttackLogs.reduce((sum, log) => sum + log.hitCount, 0)

    // 命中率上限95%なので、ほぼ全ヒット（80%以上ヒット）
    expect(totalHits / totalAttacks).toBeGreaterThan(0.8)
  })

  it('全ミス時はhitCount=0でtargetsが空になる', () => {
    // accuracy=0, evasion=999で強制的に全ミス状態を作る
    const allies = [createTestGoblin({
      stats: { hp: 100, atk: 50, agility: 100, def: 10, attackCount: 1, accuracy: 0, evasion: 10 },
    })]
    const enemies = [[createTestEnemy({ hp: 9999, agility: 1, evasion: 999 })]]

    const rng = createSeededRng(3)
    const battle = new BattleSystem()
    const result = battle.executeBattle(allies, [100], enemies, rng, 50)

    const missedLog = result.detailedLog.find(
      log => log.action === '通常攻撃' && log.isAlly && log.hitCount === 0
    )
    expect(missedLog).toBeDefined()
    expect(missedLog!.targets.length).toBe(0)
  })

  it('敵も複数回攻撃でき、1つのログにまとまる', () => {
    const allies = [createTestGoblin({
      stats: { hp: 9999, atk: 5, agility: 1, def: 10, attackCount: 1, accuracy: 20, evasion: 0 },
    })]
    const enemies = [[createTestEnemy({ hp: 9999, agility: 100, attackCount: 3, accuracy: 999, evasion: 10 })]]

    const rng = createSeededRng(10)
    const battle = new BattleSystem()
    const result = battle.executeBattle(allies, [9999], enemies, rng, 1)

    const enemyAttackLogs = result.detailedLog.filter(
      log => log.action === '通常攻撃' && !log.isAlly
    )
    // 1ユニットにつき1ログ
    expect(enemyAttackLogs.length).toBe(1)
    expect(enemyAttackLogs[0].attackCount).toBe(3)
  })

  it('残りHP低下で回避率が下がる（HP1 vs 全快で比較）', () => {
    const statsBase = { hp: 100, atk: 5, agility: 1, def: 10, attackCount: 1, accuracy: 20, evasion: 30 }

    // 全快ケース
    let hitCountFull = 0
    let totalFull = 0
    for (let seed = 0; seed < 50; seed++) {
      const allies = [createTestGoblin({ stats: statsBase })]
      const enemies = [[createTestEnemy({ hp: 9999, agility: 100, attackCount: 1, accuracy: 30, evasion: 0 })]]
      const rng = createSeededRng(seed)
      const battle = new BattleSystem()
      const result = battle.executeBattle(allies, [100], enemies, rng, 5)
      const logs = result.detailedLog.filter(log => log.action === '通常攻撃' && !log.isAlly)
      totalFull += logs.reduce((sum, log) => sum + log.attackCount, 0)
      hitCountFull += logs.reduce((sum, log) => sum + log.hitCount, 0)
    }

    // HP1ケース
    let hitCountLow = 0
    let totalLow = 0
    for (let seed = 0; seed < 50; seed++) {
      const allies = [createTestGoblin({ stats: statsBase })]
      const enemies = [[createTestEnemy({ hp: 9999, agility: 100, attackCount: 1, accuracy: 30, evasion: 0 })]]
      const rng = createSeededRng(seed)
      const battle = new BattleSystem()
      const result = battle.executeBattle(allies, [1], enemies, rng, 5)
      const logs = result.detailedLog.filter(log => log.action === '通常攻撃' && !log.isAlly)
      totalLow += logs.reduce((sum, log) => sum + log.attackCount, 0)
      hitCountLow += logs.reduce((sum, log) => sum + log.hitCount, 0)
    }

    const hitRateFull = hitCountFull / totalFull
    const hitRateLow = hitCountLow / totalLow

    // HP1だと回避率が半減するので、敵の命中率が上がるはず
    expect(hitRateLow).toBeGreaterThan(hitRateFull)
  })

  it('actorRowが正しく記録される', () => {
    const allies = [createTestGoblin({
      stats: { hp: 100, atk: 50, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 10 },
    })]
    const enemies = [[createTestEnemy({ hp: 9999, agility: 1, evasion: 0 })]]

    const rng = createSeededRng(42)
    const battle = new BattleSystem()
    const result = battle.executeBattle(allies, [100], enemies, rng, 1)

    const allyLog = result.detailedLog.find(log => log.action === '通常攻撃' && log.isAlly)!
    expect(allyLog.actorRow).toBe(1) // 最初の味方は列1（1-based）
  })

  it('ターゲットのtargetRowが正しく記録される', () => {
    const allies = [createTestGoblin({
      stats: { hp: 100, atk: 50, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 10 },
    })]
    const enemies = [
      [createTestEnemy({ id: 'E1', name: '前列敵', hp: 9999, agility: 1, evasion: 0 })],
      [createTestEnemy({ id: 'E2', name: '後列敵', hp: 9999, agility: 1, evasion: 0 })],
    ]

    const rng = createSeededRng(42)
    const battle = new BattleSystem()
    const result = battle.executeBattle(allies, [100], enemies, rng, 1)

    const allyLog = result.detailedLog.find(log => log.action === '通常攻撃' && log.isAlly)!
    expect(allyLog.targets.length).toBeGreaterThan(0)
    for (const target of allyLog.targets) {
      expect(target.targetRow).toBeGreaterThanOrEqual(1)
    }
  })

  it('2列攻撃は対象の1列後ろの敵にも個別命中で攻撃する', () => {
    const attacker = createTestGoblin({
      stats: { hp: 100, atk: 50, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 10 },
      skills: [{ id: 'two_column_attack', twoColumnAttack: true }],
      battleActionPolicy: { attackRate: 100, clericMagicRate: 0, mageMagicRate: 0 },
    })
    const enemies = [
      [createTestEnemy({ id: 'E_FRONT', name: '前列敵', hp: 9999, agility: 1, evasion: 0 })],
      [createTestEnemy({ id: 'E_BACK', name: '後列敵', hp: 9999, agility: 1, evasion: 0 })],
    ]

    const result = new BattleSystem().executeBattle([attacker], [100], enemies, () => 0, 1)
    const log = result.detailedLog.find(entry => entry.action === '通常攻撃' && entry.isAlly)!

    expect(log.attackCount).toBe(1)
    expect(log.hitCount).toBe(2)
    expect(log.targets.map(target => target.targetId)).toEqual(['E_FRONT', 'E_BACK'])
    expect(log.targets.map(target => target.targetRow)).toEqual([1, 2])
    expect(log.targets.find(target => target.targetId === 'E_FRONT')!.piercingHitCount).toBeUndefined()
    expect(log.targets.find(target => target.targetId === 'E_BACK')!.piercingHitCount).toBe(1)
    const frontDamage = log.targets.find(target => target.targetId === 'E_FRONT')!.totalDamage
    const backDamage = log.targets.find(target => target.targetId === 'E_BACK')!.totalDamage
    expect(backDamage).toBe(Math.floor(frontDamage * 0.5))
  })

  it('2列攻撃の追加対象は主対象のミスと独立して命中判定される', () => {
    const attacker = createTestGoblin({
      stats: { hp: 100, atk: 50, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 10 },
      skills: [{ id: 'two_column_attack', twoColumnAttack: true }],
      battleActionPolicy: { attackRate: 100, clericMagicRate: 0, mageMagicRate: 0 },
    })
    const enemies = [
      [createTestEnemy({ id: 'E_FRONT', name: '前列敵', hp: 9999, agility: 1, evasion: 999 })],
      [createTestEnemy({ id: 'E_BACK', name: '後列敵', hp: 9999, agility: 1, evasion: 0 })],
    ]

    const result = new BattleSystem().executeBattle([attacker], [100], enemies, () => 0.5, 1)
    const log = result.detailedLog.find(entry => entry.action === '通常攻撃' && entry.isAlly)!

    expect(log.attackCount).toBe(1)
    expect(log.hitCount).toBe(1)
    expect(log.targets.map(target => target.targetId)).toEqual(['E_BACK'])
    expect(log.targets.map(target => target.targetRow)).toEqual([2])
  })

  it('2列攻撃は6列目を対象にした場合は追加攻撃しない', () => {
    const attacker = createTestGoblin({
      stats: { hp: 100, atk: 50, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 10 },
      skills: [{ id: 'two_column_attack', twoColumnAttack: true }],
      battleActionPolicy: { attackRate: 100, clericMagicRate: 0, mageMagicRate: 0 },
    })
    const enemies = [
      [],
      [],
      [],
      [],
      [],
      [createTestEnemy({ id: 'E_ROW_6', name: '6列目敵', hp: 9999, agility: 1, evasion: 0 })],
    ]

    const result = new BattleSystem().executeBattle([attacker], [100], enemies, () => 0, 1)
    const log = result.detailedLog.find(entry => entry.action === '通常攻撃' && entry.isAlly)!

    expect(log.attackCount).toBe(1)
    expect(log.hitCount).toBe(1)
    expect(log.targets.map(target => target.targetId)).toEqual(['E_ROW_6'])
    expect(log.targets.map(target => target.targetRow)).toEqual([6])
  })

  it('ウルフゴブリンの追加ダメージは通常攻撃へ固定値で加算される', () => {
    const enemies = [[createTestEnemy({ hp: 9999, agility: 1, evasion: 0, def: 0 })]]
    const rngA = createSeededRng(42)
    const rngB = createSeededRng(42)

    const normalResult = new BattleSystem().executeBattle([
      createTestGoblin({
        race: 'ゴブリン',
        stats: { hp: 100, atk: 50, agility: 100, def: 10, attackCount: 3, accuracy: 999, evasion: 10 },
      }),
    ], [100], enemies, rngA, 1)
    const wolfResult = new BattleSystem().executeBattle([
      createTestGoblin({
        race: 'ウルフゴブリン',
        stats: { hp: 100, atk: 50, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 10 },
      }),
    ], [100], [[createTestEnemy({ hp: 9999, agility: 1, evasion: 0, def: 0 })]], rngB, 1)

    const normalLog = normalResult.detailedLog.find(log => log.action === '通常攻撃' && log.isAlly)!
    const wolfLog = wolfResult.detailedLog.find(log => log.action === '通常攻撃' && log.isAlly)!
    const normalDamage = normalLog.targets[0].totalDamage
    const wolfDamage = wolfLog.targets[0].totalDamage

    expect(wolfLog.hitCount).toBe(normalLog.hitCount)
    expect(wolfDamage - normalDamage).toBe(13 * wolfLog.hitCount)
  })

  it.each([
    {
      name: '魔獣特攻',
      skillId: 'beast_slayer_2_0' as const,
      raceTags: ['slime'],
    },
    {
      name: 'アンデッド特攻',
      skillId: 'undead_slayer_2_0' as const,
      raceTags: ['skeleton'],
    },
    {
      name: '人間特攻',
      skillId: 'human_slayer_2_0' as const,
      raceTags: ['elf'],
    },
    {
      name: '魔族特攻',
      skillId: 'demon_race_slayer_2_0' as const,
      raceTags: ['construct'],
    },
    {
      name: 'ドラゴン特攻',
      skillId: 'dragon_slayer_2_0' as const,
      raceTags: ['dragon'],
    },
  ])('$name は通常攻撃へ適用される', ({ skillId, raceTags }) => {
    const plainEnemy = [[createTestEnemy({ raceTags, hp: 9999, agility: 1, evasion: 0, def: 0 })]]
    const buffedEnemy = [[createTestEnemy({ raceTags, hp: 9999, agility: 1, evasion: 0, def: 0 })]]
    const rngA = createSeededRng(77)
    const rngB = createSeededRng(77)

    const plainResult = new BattleSystem().executeBattle([
      createTestGoblin({
        race: 'ゴブリン',
        stats: { hp: 100, atk: 50, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 10 },
        skills: [],
      }),
    ], [100], plainEnemy, rngA, 1)
    const buffedResult = new BattleSystem().executeBattle([
      createTestGoblin({
        race: 'ゴブリン',
        stats: { hp: 100, atk: 50, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 10 },
        skills: [getCharacterSkill(skillId)],
      }),
    ], [100], buffedEnemy, rngB, 1)

    const plainLog = plainResult.detailedLog.find(log => log.action === '通常攻撃' && log.isAlly)!
    const buffedLog = buffedResult.detailedLog.find(log => log.action === '通常攻撃' && log.isAlly)!

    expect(buffedLog.hitCount).toBe(plainLog.hitCount)
    expect(buffedLog.targets[0].totalDamage).toBe(plainLog.targets[0].totalDamage * 2)
  })

  it('スライムゴブリンより後列の仲間は通常攻撃ダメージが軽減される', () => {
    const protectedAllies = [
      createTestGoblin({
        id: 1,
        race: 'スライムゴブリン',
        stats: { hp: 9999, atk: 1, agility: 10, def: 0, attackCount: 1, accuracy: 1, evasion: 0 },
      }),
      createTestGoblin({
        id: 2,
        race: 'ゴブリン',
        stats: { hp: 9999, atk: 1, agility: 1, def: 0, attackCount: 1, accuracy: 1, evasion: 0 },
      }),
    ]
    const plainAllies = [
      createTestGoblin({
        id: 1,
        race: 'ゴブリン',
        stats: { hp: 9999, atk: 1, agility: 10, def: 0, attackCount: 1, accuracy: 1, evasion: 0 },
      }),
      createTestGoblin({
        id: 2,
        race: 'ゴブリン',
        stats: { hp: 9999, atk: 1, agility: 1, def: 0, attackCount: 1, accuracy: 1, evasion: 0 },
      }),
    ]
    const enemies = [[createTestEnemy({
      hp: 9999,
      atk: 90,
      def: 0,
      agility: 100,
      attackCount: 20,
      accuracy: 999,
      evasion: 0,
    })]]

    const protectedResult = new BattleSystem().executeBattle(protectedAllies, [9999, 9999], enemies, createSeededRng(7), 1)
    const plainResult = new BattleSystem().executeBattle(plainAllies, [9999, 9999], [[createTestEnemy({
      hp: 9999,
      atk: 90,
      def: 0,
      agility: 100,
      attackCount: 20,
      accuracy: 999,
      evasion: 0,
    })]], createSeededRng(7), 1)

    const protectedRear = protectedResult.detailedLog.find(log => log.action === '通常攻撃' && !log.isAlly)!.targets.find(target => target.targetId === '2')
    const plainRear = plainResult.detailedLog.find(log => log.action === '通常攻撃' && !log.isAlly)!.targets.find(target => target.targetId === '2')

    expect(protectedRear).toBeDefined()
    expect(plainRear).toBeDefined()
    expect(protectedRear!.hitCount).toBe(plainRear!.hitCount)
    expect(protectedRear!.totalDamage).toBeLessThan(plainRear!.totalDamage)
  })

  it('後列防護持ちが複数いても最前列の1体分だけ適用する', () => {
    const allies = [
      createTestGoblin({
        id: 1,
        skills: [{ id: 'rear_guard_front', protectRearAllyNormalAttackMultiplier: 2 / 3 }],
        stats: { hp: 9999, atk: 1, agility: 10, def: 0, attackCount: 1, accuracy: 1, evasion: 0 },
      }),
      createTestGoblin({
        id: 2,
        skills: [{ id: 'rear_guard_middle', protectRearAllyNormalAttackMultiplier: 2 / 3 }],
        stats: { hp: 9999, atk: 1, agility: 5, def: 0, attackCount: 1, accuracy: 1, evasion: 0 },
      }),
      createTestGoblin({
        id: 3,
        skills: [],
        stats: { hp: 9999, atk: 1, agility: 1, def: 0, attackCount: 1, accuracy: 1, evasion: 0 },
      }),
    ]
    const enemy = createTestEnemy({
      hp: 9999,
      atk: 90,
      def: 0,
      agility: 100,
      attackCount: 20,
      accuracy: 999,
      evasion: 0,
    })

    const result = new BattleSystem().executeBattle(allies, [9999, 9999, 9999], [[enemy]], createSeededRng(7), 1)
    const rear = result.detailedLog.find(log => log.action === '通常攻撃' && !log.isAlly)!.targets.find(target => target.targetId === '3')

    expect(rear).toBeDefined()
    expect(rear!.totalDamage).toBe(124)
  })

  it('魔法保護持ちより後列の仲間は魔法ダメージが2/3に軽減される', () => {
    const protectedAllies = [
      createTestGoblin({
        id: 1,
        stats: { hp: 9999, atk: 1, agility: 10, def: 0, magicDef: 0, attackCount: 1, accuracy: 1, evasion: 0 },
        skills: [getCharacterSkill('magic_rear_guard')],
      }),
      createTestGoblin({
        id: 2,
        stats: { hp: 9999, atk: 1, agility: 1, def: 0, magicDef: 0, attackCount: 1, accuracy: 1, evasion: 0 },
      }),
    ]
    const plainAllies = [
      createTestGoblin({
        id: 1,
        stats: { hp: 9999, atk: 1, agility: 10, def: 0, magicDef: 0, attackCount: 1, accuracy: 1, evasion: 0 },
      }),
      createTestGoblin({
        id: 2,
        stats: { hp: 9999, atk: 1, agility: 1, def: 0, magicDef: 0, attackCount: 1, accuracy: 1, evasion: 0 },
      }),
    ]
    const caster = createTestEnemy({
      id: 'CASTER',
      hp: 9999,
      atk: 1,
      magicAtk: 120,
      def: 0,
      magicDef: 0,
      agility: 100,
      attackCount: 0,
      accuracy: 999,
      evasion: 0,
      spells: [{ spellId: 'fireball' }],
      battleActionPolicy: { attackRate: 0, clericMagicRate: 0, mageMagicRate: 100 },
    })

    const protectedResult = new BattleSystem().executeBattle(protectedAllies, [9999, 9999], [[caster]], () => 0.5, 1)
    const plainResult = new BattleSystem().executeBattle(plainAllies, [9999, 9999], [[createTestEnemy({
      ...caster,
      spells: [{ spellId: 'fireball' }],
      battleActionPolicy: { attackRate: 0, clericMagicRate: 0, mageMagicRate: 100 },
    })]], () => 0.5, 1)

    const protectedRear = protectedResult.detailedLog.find(log => log.action === 'ファイヤーボール')!.targets.find(target => target.targetId === '2')
    const plainRear = plainResult.detailedLog.find(log => log.action === 'ファイヤーボール')!.targets.find(target => target.targetId === '2')

    expect(protectedRear).toBeDefined()
    expect(plainRear).toBeDefined()
    expect(protectedRear!.hitCount).toBe(plainRear!.hitCount)
    expect(protectedRear!.totalDamage).toBeGreaterThanOrEqual(Math.floor(plainRear!.totalDamage * 0.62))
    expect(protectedRear!.totalDamage).toBeLessThanOrEqual(Math.ceil(plainRear!.totalDamage * 0.68))
  })

  it('遠征戦闘でもスライムゴブリンの後列防護が適用される', () => {
    const protectedPartyState = [
      {
        id: '1',
        name: '前列スライム',
        race: 'スライムゴブリン',
        currentHP: 9999,
        maxHP: 9999,
        baseHP: 9999,
        atk: 1,
        def: 0,
        agility: 10,
        attackCount: 1,
        accuracy: 1,
        evasion: 0,
        isKO: false,
        isDead: false,
        skills: getDefaultSkillsForRace('スライムゴブリン'),
        factors: [],
        level: 1,
        avatar: '/slime.png',
      },
      {
        id: '2',
        name: '後列ゴブリン',
        race: 'ゴブリン',
        currentHP: 9999,
        maxHP: 9999,
        baseHP: 9999,
        atk: 1,
        def: 0,
        agility: 1,
        attackCount: 1,
        accuracy: 1,
        evasion: 0,
        isKO: false,
        isDead: false,
        skills: getDefaultSkillsForRace('ゴブリン'),
        factors: [],
        level: 1,
        avatar: '/goblin.png',
      },
    ]
    const plainPartyState = [
      {
        ...protectedPartyState[0],
        race: 'ゴブリン',
        skills: getDefaultSkillsForRace('ゴブリン'),
        name: '前列ゴブリン',
      },
      { ...protectedPartyState[1] },
    ]
    const enemies = [[createTestEnemy({
      hp: 9999,
      atk: 90,
      def: 0,
      agility: 100,
      attackCount: 20,
      accuracy: 999,
      evasion: 0,
    })]]

    const protectedEngine = new ExpeditionEngine(7)
    const plainEngine = new ExpeditionEngine(7)

    const protectedCombat = (protectedEngine as any).resolveCombat(protectedPartyState, enemies, { areaLevel: 1 }, false)
    const plainCombat = (plainEngine as any).resolveCombat(plainPartyState, [[createTestEnemy({
      hp: 9999,
      atk: 90,
      def: 0,
      agility: 100,
      attackCount: 20,
      accuracy: 999,
      evasion: 0,
    })]], { areaLevel: 1 }, false)

    const protectedRear = protectedCombat.detailedLog.find((log: any) => log.action === '通常攻撃' && !log.isAlly)!.targets.find((target: any) => target.targetId === '2')
    const plainRear = plainCombat.detailedLog.find((log: any) => log.action === '通常攻撃' && !log.isAlly)!.targets.find((target: any) => target.targetId === '2')

    expect(protectedRear).toBeDefined()
    expect(plainRear).toBeDefined()
    expect(protectedRear.hitCount).toBe(plainRear.hitCount)
    expect(protectedRear.totalDamage).toBeLessThan(plainRear.totalDamage)
  })

  it('物理ダメージ軽減スキルは通常攻撃ダメージを軽減する', () => {
    const reducedAllies = [
      createTestGoblin({
        id: 1,
        skills: [{ id: 'physical_reduction_10', physicalDamageReductionPercent: 10 }],
        stats: { hp: 9999, atk: 1, agility: 1, def: 0, attackCount: 1, accuracy: 1, evasion: 0 },
      }),
    ]
    const plainAllies = [
      createTestGoblin({
        id: 1,
        skills: [],
        stats: { hp: 9999, atk: 1, agility: 1, def: 0, attackCount: 1, accuracy: 1, evasion: 0 },
      }),
    ]
    const enemy = [[createTestEnemy({
      hp: 9999,
      atk: 100,
      def: 0,
      agility: 100,
      attackCount: 1,
      accuracy: 999,
      evasion: 0,
    })]]

    const reducedResult = new BattleSystem().executeBattle(reducedAllies, [9999], enemy, createSeededRng(11), 1)
    const plainResult = new BattleSystem().executeBattle(plainAllies, [9999], [[createTestEnemy({
      hp: 9999,
      atk: 100,
      def: 0,
      agility: 100,
      attackCount: 1,
      accuracy: 999,
      evasion: 0,
    })]], createSeededRng(11), 1)

    const reducedDamage = reducedResult.detailedLog.find((log) => log.action === '通常攻撃' && !log.isAlly)!.targets[0].totalDamage
    const plainDamage = plainResult.detailedLog.find((log) => log.action === '通常攻撃' && !log.isAlly)!.targets[0].totalDamage

    expect(reducedDamage).toBeLessThan(plainDamage)
  })

  it('物理ダメージ軽減スキルは呪文ダメージを軽減しない', () => {
    const reducedAllies = [
      createTestGoblin({
        id: 1,
        skills: [{ id: 'physical_reduction_10', physicalDamageReductionPercent: 10 }],
        stats: { hp: 9999, atk: 1, agility: 1, def: 0, attackCount: 1, accuracy: 1, evasion: 0 },
      }),
    ]
    const plainAllies = [
      createTestGoblin({
        id: 1,
        skills: [],
        stats: { hp: 9999, atk: 1, agility: 1, def: 0, attackCount: 1, accuracy: 1, evasion: 0 },
      }),
    ]
    const caster = [[createTestEnemy({
      hp: 9999,
      atk: 100,
      def: 0,
      agility: 100,
      attackCount: 1,
      accuracy: 999,
      evasion: 0,
      spells: [{ spellId: 'magic_arrow' }],
    })]]

    const reducedResult = new BattleSystem().executeBattle(reducedAllies, [9999], caster, createSeededRng(17), 1)
    const plainResult = new BattleSystem().executeBattle(plainAllies, [9999], [[createTestEnemy({
      hp: 9999,
      atk: 100,
      def: 0,
      agility: 100,
      attackCount: 1,
      accuracy: 999,
      evasion: 0,
      spells: [{ spellId: 'magic_arrow' }],
    })]], createSeededRng(17), 1)

    const reducedDamage = reducedResult.detailedLog.find((log) => log.action === 'マジックアロー' && !log.isAlly)!.targets[0].totalDamage
    const plainDamage = plainResult.detailedLog.find((log) => log.action === 'マジックアロー' && !log.isAlly)!.targets[0].totalDamage

    expect(reducedDamage).toBe(plainDamage)
  })

  it('近距離攻撃持ちは後列ほど通常攻撃ダメージが下がる', () => {
    const enemy = [[createTestEnemy({ hp: 9999, def: 0, agility: 1, evasion: 0 })]]
    const frontAttacker = createTestGoblin({
      id: 1,
      skills: [{ id: 'weapon_melee_attack', enablesMeleeRowDamagePenalty: true }],
      stats: { hp: 100, atk: 100, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
    })
    const rearAttacker = createTestGoblin({
      id: 2,
      skills: [{ id: 'weapon_melee_attack', enablesMeleeRowDamagePenalty: true }],
      stats: { hp: 100, atk: 100, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
    })

    const frontResult = new BattleSystem().executeBattle([frontAttacker], [100], enemy, createSeededRng(21), 1)
    const rearResult = new BattleSystem().executeBattle(
      [
        createTestGoblin({ id: 99, stats: { hp: 1, atk: 1, agility: 1, def: 999, attackCount: 0, accuracy: 0, evasion: 999 } }),
        createTestGoblin({ id: 98, stats: { hp: 1, atk: 1, agility: 1, def: 999, attackCount: 0, accuracy: 0, evasion: 999 } }),
        createTestGoblin({ id: 97, stats: { hp: 1, atk: 1, agility: 1, def: 999, attackCount: 0, accuracy: 0, evasion: 999 } }),
        createTestGoblin({ id: 96, stats: { hp: 1, atk: 1, agility: 1, def: 999, attackCount: 0, accuracy: 0, evasion: 999 } }),
        createTestGoblin({ id: 95, stats: { hp: 1, atk: 1, agility: 1, def: 999, attackCount: 0, accuracy: 0, evasion: 999 } }),
        rearAttacker,
      ],
      [1, 1, 1, 1, 1, 100],
      [[createTestEnemy({ hp: 9999, def: 0, agility: 1, evasion: 0 })]],
      createSeededRng(21),
      1,
    )

    const frontDamage = frontResult.detailedLog.find((log) => log.actorId === '1' && log.action === '通常攻撃')!.targets[0].totalDamage
    const rearDamage = rearResult.detailedLog.find((log) => log.actorId === '2' && log.action === '通常攻撃')!.targets[0].totalDamage

    expect(rearDamage).toBeLessThan(frontDamage)
  })

  it('遠距離攻撃持ちは後列ほど通常攻撃ダメージが上がる', () => {
    const frontAttacker = createTestGoblin({
      id: 1,
      skills: [{ id: 'weapon_ranged_attack', enablesRangedRowDamagePenalty: true }],
      stats: { hp: 100, atk: 100, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
    })
    const rearAttacker = createTestGoblin({
      id: 2,
      skills: [{ id: 'weapon_ranged_attack', enablesRangedRowDamagePenalty: true }],
      stats: { hp: 100, atk: 100, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
    })

    const frontResult = new BattleSystem().executeBattle(
      [frontAttacker],
      [100],
      [[createTestEnemy({ hp: 9999, def: 0, agility: 1, evasion: 0 })]],
      createSeededRng(22),
      1,
    )
    const rearResult = new BattleSystem().executeBattle(
      [
        createTestGoblin({ id: 99, stats: { hp: 1, atk: 1, agility: 1, def: 999, attackCount: 0, accuracy: 0, evasion: 999 } }),
        createTestGoblin({ id: 98, stats: { hp: 1, atk: 1, agility: 1, def: 999, attackCount: 0, accuracy: 0, evasion: 999 } }),
        createTestGoblin({ id: 97, stats: { hp: 1, atk: 1, agility: 1, def: 999, attackCount: 0, accuracy: 0, evasion: 999 } }),
        createTestGoblin({ id: 96, stats: { hp: 1, atk: 1, agility: 1, def: 999, attackCount: 0, accuracy: 0, evasion: 999 } }),
        createTestGoblin({ id: 95, stats: { hp: 1, atk: 1, agility: 1, def: 999, attackCount: 0, accuracy: 0, evasion: 999 } }),
        rearAttacker,
      ],
      [1, 1, 1, 1, 1, 100],
      [[createTestEnemy({ hp: 9999, def: 0, agility: 1, evasion: 0 })]],
      createSeededRng(22),
      1,
    )

    const frontDamage = frontResult.detailedLog.find((log) => log.actorId === '1' && log.action === '通常攻撃')!.targets[0].totalDamage
    const rearDamage = rearResult.detailedLog.find((log) => log.actorId === '2' && log.action === '通常攻撃')!.targets[0].totalDamage

    expect(rearDamage).toBeGreaterThan(frontDamage)
  })

  it('遠近両方持ちは全列で同じ通常攻撃ダメージ補正になる', () => {
    const dualSkills = [
      { id: 'weapon_melee_attack', enablesMeleeRowDamagePenalty: true },
      { id: 'weapon_ranged_attack', enablesRangedRowDamagePenalty: true },
    ]
    const frontAttacker = createTestGoblin({
      id: 1,
      skills: dualSkills,
      stats: { hp: 100, atk: 100, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
    })
    const rearAttacker = createTestGoblin({
      id: 2,
      skills: dualSkills,
      stats: { hp: 100, atk: 100, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
    })

    const frontResult = new BattleSystem().executeBattle(
      [frontAttacker],
      [100],
      [[createTestEnemy({ hp: 9999, def: 0, agility: 1, evasion: 0 })]],
      createSeededRng(23),
      1,
    )
    const rearResult = new BattleSystem().executeBattle(
      [
        createTestGoblin({ id: 99, stats: { hp: 1, atk: 1, agility: 1, def: 999, attackCount: 0, accuracy: 0, evasion: 999 } }),
        createTestGoblin({ id: 98, stats: { hp: 1, atk: 1, agility: 1, def: 999, attackCount: 0, accuracy: 0, evasion: 999 } }),
        createTestGoblin({ id: 97, stats: { hp: 1, atk: 1, agility: 1, def: 999, attackCount: 0, accuracy: 0, evasion: 999 } }),
        createTestGoblin({ id: 96, stats: { hp: 1, atk: 1, agility: 1, def: 999, attackCount: 0, accuracy: 0, evasion: 999 } }),
        createTestGoblin({ id: 95, stats: { hp: 1, atk: 1, agility: 1, def: 999, attackCount: 0, accuracy: 0, evasion: 999 } }),
        rearAttacker,
      ],
      [1, 1, 1, 1, 1, 100],
      [[createTestEnemy({ hp: 9999, def: 0, agility: 1, evasion: 0 })]],
      createSeededRng(23),
      1,
    )

    const frontDamage = frontResult.detailedLog.find((log) => log.actorId === '1' && log.action === '通常攻撃')!.targets[0].totalDamage
    const rearDamage = rearResult.detailedLog.find((log) => log.actorId === '2' && log.action === '通常攻撃')!.targets[0].totalDamage

    expect(rearDamage).toBe(30)
  })

  it('敵のmelee攻撃は後列ほど通常攻撃ダメージが下がる', () => {
    const target = createTestGoblin({
      id: 1,
      stats: { hp: 999, atk: 1, agility: 1, def: 10, attackCount: 0, accuracy: 0, evasion: 0 },
    })
    const frontEnemy = createTestEnemy({
      id: 'FRONT_MELEE',
      attackType: 'melee',
      hp: 999,
      atk: 100,
      def: 1,
      agility: 100,
      attackCount: 1,
      accuracy: 999,
      evasion: 0,
    })
    const rearEnemy = createTestEnemy({
      ...frontEnemy,
      id: 'REAR_MELEE',
    })

    const frontResult = new BattleSystem().executeBattle([target], [target.stats.hp], [[frontEnemy]], createSeededRng(24), 1)
    const rearResult = new BattleSystem().executeBattle(
      [target],
      [target.stats.hp],
      [[], [], [], [], [], [rearEnemy]],
      createSeededRng(24),
      1,
    )

    const frontDamage = frontResult.detailedLog.find((log) => log.actorId === 'FRONT_MELEE' && log.action === '通常攻撃')!.targets[0].totalDamage
    const rearDamage = rearResult.detailedLog.find((log) => log.actorId === 'REAR_MELEE' && log.action === '通常攻撃')!.targets[0].totalDamage

    expect(rearDamage).toBeLessThan(frontDamage)
  })

  it('敵のrange攻撃は後列ほど通常攻撃ダメージが上がる', () => {
    const target = createTestGoblin({
      id: 1,
      stats: { hp: 999, atk: 1, agility: 1, def: 10, attackCount: 0, accuracy: 0, evasion: 0 },
    })
    const frontEnemy = createTestEnemy({
      id: 'FRONT_RANGE',
      attackType: 'range',
      hp: 999,
      atk: 100,
      def: 1,
      agility: 100,
      attackCount: 1,
      accuracy: 999,
      evasion: 0,
    })
    const rearEnemy = createTestEnemy({
      ...frontEnemy,
      id: 'REAR_RANGE',
    })

    const frontResult = new BattleSystem().executeBattle([target], [target.stats.hp], [[frontEnemy]], createSeededRng(25), 1)
    const rearResult = new BattleSystem().executeBattle(
      [target],
      [target.stats.hp],
      [[], [], [], [], [], [rearEnemy]],
      createSeededRng(25),
      1,
    )

    const frontDamage = frontResult.detailedLog.find((log) => log.actorId === 'FRONT_RANGE' && log.action === '通常攻撃')!.targets[0].totalDamage
    const rearDamage = rearResult.detailedLog.find((log) => log.actorId === 'REAR_RANGE' && log.action === '通常攻撃')!.targets[0].totalDamage

    expect(rearDamage).toBeGreaterThan(frontDamage)
  })
})

// =========================================================================
// 隊列システム — getRowWeight
// =========================================================================
describe('getRowWeight', () => {
  it('1列のみの場合は重み1', () => {
    expect(getRowWeight(0, 1)).toBe(1)
  })

  it('2列: 列1=13/12, 列2=1/3', () => {
    expect(getRowWeight(0, 2)).toBe(13 / 12)
    expect(getRowWeight(1, 2)).toBe(1 / 3)
  })

  it('3列: 列1=13/12, 列2=1/3, 列3=1/4', () => {
    expect(getRowWeight(0, 3)).toBe(13 / 12)
    expect(getRowWeight(1, 3)).toBe(1 / 3)
    expect(getRowWeight(2, 3)).toBe(0.25)
  })

  it('6列: 13/12, 1/3, 1/8, 1/16, 1/32, 1/32（比率 65/20/7.5/3.75/1.875/1.875）', () => {
    expect(getRowWeight(0, 6)).toBe(13 / 12)
    expect(getRowWeight(1, 6)).toBe(1 / 3)
    expect(getRowWeight(2, 6)).toBe(0.125)
    expect(getRowWeight(3, 6)).toBe(0.0625)
    expect(getRowWeight(4, 6)).toBe(0.03125)
    expect(getRowWeight(5, 6)).toBe(0.03125)
  })
})

// =========================================================================
// 隊列システム — selectTarget
// =========================================================================
describe('selectTarget — 隊列ターゲット選択', () => {
  /**
   * テスト用のBattleUnit風オブジェクト
   */
  function makeMockUnit(id: string, row: number, rowSlot: number = 0) {
    return {
      combatant: { id, name: id, atk: 10, def: 10, attackCount: 1, accuracy: 20, evasion: 10, raceTags: [] as string[] },
      currentHP: 100,
      maxHP: 100,
      initialHP: 100,
      agility: 10,
      luck: 10,
      attackCount: 1,
      accuracy: 20,
      evasion: 10,
      isAlly: false,
      originalIndex: 0,
      damageReduction: 0,
      physicalDamageReduction: 0,
      rangedAttackDamageReduction: 0,
      magicDamageReduction: 0,
      breathDamageReduction: 0,
      shieldBarrierDamageReduction: 0,
      shieldBarrierBreathDamageReduction: 0,
      magicBarrierDamageReduction: 0,
      physicalDamageDealtMultiplier: 1,
      physicalDamagePercent: 0,
      magicAtk: 0,
      magicHeal: 0,
      criticalRate: 0,
      criticalDamageBonusPercent: 0,
      spellDamagePercent: 0,
      magicFieldDamageMultiplier: 1,
      row,
      rowSlot,
      level: 1,
      spellCharges: [],
      skills: [],
      battleActionPolicy: { attackRate: 100, clericMagicRate: 100, mageMagicRate: 100 },
      isDefending: false,
      attackType: 'melee' as const,
    }
  }

  it('1体しかいない場合はその1体が選ばれる', () => {
    const units = [makeMockUnit('A', 0)]
    const rng = createSeededRng(1)
    expect(selectTarget(units, rng).combatant.id).toBe('A')
  })

  it('前列が後列より多く狙われる（統計的検証）', () => {
    const units = [
      makeMockUnit('前列', 0),
      makeMockUnit('後列', 1),
    ]

    const counts: Record<string, number> = { '前列': 0, '後列': 0 }
    for (let i = 0; i < 10000; i++) {
      const rng = createSeededRng(i)
      const target = selectTarget(units, rng)
      counts[target.combatant.id]++
    }

    // 2列: 列1=13/12, 列2=1/3 → 前列≈76.5%, 後列≈23.5%
    expect(counts['前列'] / 10000).toBeGreaterThan(0.7)
    expect(counts['後列'] / 10000).toBeGreaterThan(0.18)
    expect(counts['前列']).toBeGreaterThan(counts['後列'])
  })

  it('3列の場合、前列ほど狙われやすい', () => {
    const units = [
      makeMockUnit('列1', 0),
      makeMockUnit('列2', 1),
      makeMockUnit('列3', 2),
    ]

    const counts: Record<string, number> = { '列1': 0, '列2': 0, '列3': 0 }
    for (let i = 0; i < 10000; i++) {
      const rng = createSeededRng(i)
      const target = selectTarget(units, rng)
      counts[target.combatant.id]++
    }

    // 3列: 1/2, 1/4, 1/4 → 列1≈50%, 列2≈25%, 列3≈25%
    expect(counts['列1']).toBeGreaterThan(counts['列2'])
    expect(counts['列1']).toBeGreaterThan(counts['列3'])
  })

  it('同一列に複数ユニットがいる場合、列内でも重み付き抽選', () => {
    // 列0にA(slot0)とB(slot1)の2体
    const units = [
      makeMockUnit('A', 0, 0),
      makeMockUnit('B', 0, 1),
    ]

    const counts: Record<string, number> = { 'A': 0, 'B': 0 }
    for (let i = 0; i < 10000; i++) {
      const rng = createSeededRng(i)
      const target = selectTarget(units, rng)
      counts[target.combatant.id]++
    }

    // 列内2体: slot0=13/12, slot1=1/3 → A≈76.5%, B≈23.5%
    expect(counts['A']).toBeGreaterThan(counts['B'])
    expect(counts['A'] / 10000).toBeGreaterThan(0.7)
    expect(counts['B'] / 10000).toBeGreaterThan(0.18)
  })

  it('前詰め: 列0が空で列1,2が生存 → 列1が最前列扱い', () => {
    // 列1と列2のユニットのみ（列0は全滅）
    const units = [
      makeMockUnit('列1ユニット', 1),
      makeMockUnit('列2ユニット', 2),
    ]

    const counts: Record<string, number> = { '列1ユニット': 0, '列2ユニット': 0 }
    for (let i = 0; i < 10000; i++) {
      const rng = createSeededRng(i)
      const target = selectTarget(units, rng)
      counts[target.combatant.id]++
    }

    // 前詰め後の2列分布: 約76.5% / 23.5%
    expect(counts['列1ユニット'] / 10000).toBeGreaterThan(0.7)
    expect(counts['列2ユニット'] / 10000).toBeGreaterThan(0.18)
    expect(counts['列1ユニット']).toBeGreaterThan(counts['列2ユニット'])
  })

  it('4列の分布: 13/12, 1/3, 1/8, 1/8 （比率 65/20/7.5/7.5）', () => {
    const units = [
      makeMockUnit('R0', 0),
      makeMockUnit('R1', 1),
      makeMockUnit('R2', 2),
      makeMockUnit('R3', 3),
    ]

    const counts: Record<string, number> = { R0: 0, R1: 0, R2: 0, R3: 0 }
    const N = 20000
    for (let i = 0; i < N; i++) {
      const rng = createSeededRng(i)
      counts[selectTarget(units, rng).combatant.id]++
    }

    // R0≈65%, R1≈20%, R2≈7.5%, R3≈7.5%
    expect(counts.R0 / N).toBeGreaterThan(0.58)
    expect(counts.R0 / N).toBeLessThan(0.72)
    expect(counts.R1 / N).toBeGreaterThan(0.14)
    expect(counts.R1 / N).toBeLessThan(0.26)
    // R2とR3はほぼ同率
    expect(Math.abs(counts.R2 - counts.R3) / N).toBeLessThan(0.05)
  })

  it('5列の分布: 1/2, 1/4, 1/8, 1/16, 1/16', () => {
    const units = [
      makeMockUnit('R0', 0),
      makeMockUnit('R1', 1),
      makeMockUnit('R2', 2),
      makeMockUnit('R3', 3),
      makeMockUnit('R4', 4),
    ]

    const counts: Record<string, number> = { R0: 0, R1: 0, R2: 0, R3: 0, R4: 0 }
    const N = 20000
    for (let i = 0; i < N; i++) {
      const rng = createSeededRng(i)
      counts[selectTarget(units, rng).combatant.id]++
    }

    // 各列は前の列より少ない
    expect(counts.R0).toBeGreaterThan(counts.R1)
    expect(counts.R1).toBeGreaterThan(counts.R2)
    expect(counts.R2).toBeGreaterThan(counts.R3)
    // R3とR4はほぼ同率（最後2列同率ルール）
    expect(Math.abs(counts.R3 - counts.R4) / N).toBeLessThan(0.05)
  })

  it('同一列3体: slot0が最も狙われ、slot1 > slot2', () => {
    const units = [
      makeMockUnit('A', 0, 0),
      makeMockUnit('B', 0, 1),
      makeMockUnit('C', 0, 2),
    ]

    const counts: Record<string, number> = { A: 0, B: 0, C: 0 }
    const N = 20000
    for (let i = 0; i < N; i++) {
      const rng = createSeededRng(i)
      counts[selectTarget(units, rng).combatant.id]++
    }

    // 3スロット: 1/2, 1/4, 1/4 → A≈50%, B≈25%, C≈25%
    expect(counts.A).toBeGreaterThan(counts.B)
    expect(counts.A).toBeGreaterThan(counts.C)
  })

  it('複合: 列0に2体、列1に1体、列2に1体 → 列0が最も狙われる', () => {
    const units = [
      makeMockUnit('列0A', 0, 0),
      makeMockUnit('列0B', 0, 1),
      makeMockUnit('列1X', 1, 0),
      makeMockUnit('列2Y', 2, 0),
    ]

    const counts: Record<string, number> = { '列0A': 0, '列0B': 0, '列1X': 0, '列2Y': 0 }
    const N = 20000
    for (let i = 0; i < N; i++) {
      const rng = createSeededRng(i)
      counts[selectTarget(units, rng).combatant.id]++
    }

    // 3列: 1/2, 1/4, 1/4 → 列0の合計≈50% > 列1≈25%
    expect(counts['列0A'] + counts['列0B']).toBeGreaterThan(counts['列1X'])
    expect(counts['列0A'] + counts['列0B']).toBeGreaterThan(counts['列2Y'])
  })

  it('前詰め: 列0,2,4が生存 → 3列として重み計算', () => {
    const units = [
      makeMockUnit('R0', 0),
      makeMockUnit('R2', 2),
      makeMockUnit('R4', 4),
    ]

    const counts: Record<string, number> = { R0: 0, R2: 0, R4: 0 }
    const N = 20000
    for (let i = 0; i < N; i++) {
      const rng = createSeededRng(i)
      counts[selectTarget(units, rng).combatant.id]++
    }

    // 3列前詰め: 1/2, 1/4, 1/4 → R0≈50%, R2≈25%, R4≈25%
    expect(counts.R0 / N).toBeGreaterThan(0.43)
    expect(counts.R0).toBeGreaterThan(counts.R2)
    expect(counts.R0).toBeGreaterThan(counts.R4)
  })
})

// =========================================================================
// 呪文チャージ
// =========================================================================
describe('spell charges', () => {
  it('ファイヤーボールは同じ敵IDの別個体を別ターゲットとして記録する', () => {
    const battleSystem = new BattleSystem()
    const caster = createTestEnemy({
      id: 'FIRE_CASTER',
      name: '火術師',
      level: 1,
      hp: 999,
      atk: 1,
      def: 1,
      agility: 100,
      attackCount: 0,
      skills: [
        { id: 'fireball', grantsSpellId: 'fireball' },
      ],
    })
    const allyA = createTestGoblin({
      id: 1,
      name: '前衛A',
      stats: { hp: 120, atk: 10, agility: 1, def: 10, attackCount: 1, accuracy: 20, evasion: 0 },
    })
    const allyB = createTestGoblin({
      id: 2,
      name: '前衛B',
      stats: { hp: 120, atk: 10, agility: 1, def: 10, attackCount: 1, accuracy: 20, evasion: 0 },
    })

    const result = battleSystem.executeBattle([allyA, allyB], [allyA.stats.hp, allyB.stats.hp], [[caster]], createSeededRng(1), 1)
    const spellLog = result.detailedLog.find(log => log.actorId === 'FIRE_CASTER' && log.action === 'ファイヤーボール')

    expect(spellLog?.targets).toHaveLength(2)
    expect(spellLog?.targets.map(target => target.targetId).sort()).toEqual(['1', '2'])
    expect(spellLog?.targets.every(target => target.hitCount === 1)).toBe(true)
  })

  it('同じ敵IDが複数いる場合はログ表示名にA/Bサフィックスを付ける', () => {
    const battleSystem = new BattleSystem()
    const attacker = createTestGoblin({
      id: 1,
      stats: { hp: 120, atk: 40, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
    })
    const enemyA = createTestEnemy({
      id: 'ORC002',
      name: 'オーク兵',
      hp: 60,
      def: 1,
      agility: 1,
      evasion: 0,
    })
    const enemyB = createTestEnemy({
      id: 'ORC002',
      name: 'オーク兵',
      hp: 60,
      def: 1,
      agility: 1,
      evasion: 0,
    })

    const result = battleSystem.executeBattle([attacker], [attacker.stats.hp], [[enemyA, enemyB]], createSeededRng(1), 1)
    const turnStartLog = result.detailedLog.find(log => log.action === 'turn_start')
    const attackLog = result.detailedLog.find(log => log.actorId === '1' && log.action === '通常攻撃')

    expect(turnStartLog?.turnState?.enemies.map(enemy => enemy.name)).toEqual(['Lv1 オーク兵A', 'Lv1 オーク兵B'])
    expect(attackLog?.targets[0]?.targetName).toBe('Lv1 オーク兵A')
  })

  it('ファイヤーボール2回は1戦闘で2回使える', () => {
    const battleSystem = new BattleSystem()
    const ally = createTestGoblin({
      level: 20,
      stats: { hp: 9999, atk: 12, agility: 1, def: 10, attackCount: 1, accuracy: 20, evasion: 15 },
    })
    const enemy = createTestEnemy({
      id: 'B_LICH_TEST',
      name: '死霊術師の残骸テスト',
      level: 11,
      hp: 999,
      atk: 1,
      def: 1,
      agility: 50,
      attackCount: 0,
      skills: [
        { id: 'fireball', grantsSpellId: 'fireball' },
        { id: 'fireball_twice', spellChargeBonusForId: 'fireball', extraSpellCharges: 1 },
      ],
    })

    const result = battleSystem.executeBattle([ally], [ally.stats.hp], [[enemy]], createSeededRng(42), 3)
    const spellLogs = result.detailedLog.filter(log => log.actorId === 'B_LICH_TEST' && log.action === 'ファイヤーボール')

    expect(spellLogs).toHaveLength(2)
  })

  it('魔力回復があると防御時に使用済み呪文を1つ回復して再使用できる', () => {
    const battleSystem = new BattleSystem()
    const ally = createTestGoblin({
      level: 20,
      stats: { hp: 9999, atk: 12, agility: 1, def: 10, attackCount: 1, accuracy: 20, evasion: 15 },
    })
    const enemy = createTestEnemy({
      id: 'MANA_GUARD',
      name: '魔力守兵',
      level: 20,
      hp: 999,
      atk: 1,
      def: 1,
      agility: 50,
      attackCount: 0,
      skills: [
        { id: 'grant_fireball', grantsSpellId: 'fireball' },
        { id: 'mana_recovery', recoverRandomUsedSpellOnDefend: true },
      ],
      battleActionPolicy: {
        attackRate: 0,
        mageMagicRate: 100,
        clericMagicRate: 100,
      },
    })

    const result = battleSystem.executeBattle([ally], [ally.stats.hp], [[enemy]], createSeededRng(42), 3)
    const spellLogs = result.detailedLog.filter(log => log.actorId === 'MANA_GUARD' && log.action === 'ファイヤーボール')
    const defendLogs = result.detailedLog.filter(log => log.actorId === 'MANA_GUARD' && log.action === '防御')

    expect(spellLogs).toHaveLength(2)
    expect(defendLogs).toHaveLength(1)
  })

  it('魔力回復がなくても防御では使用済み呪文を回復しない', () => {
    const battleSystem = new BattleSystem()
    const ally = createTestGoblin({
      level: 20,
      stats: { hp: 9999, atk: 12, agility: 1, def: 10, attackCount: 1, accuracy: 20, evasion: 15 },
    })
    const enemy = createTestEnemy({
      id: 'PLAIN_GUARD',
      name: '通常守兵',
      level: 20,
      hp: 999,
      atk: 1,
      def: 1,
      agility: 50,
      attackCount: 0,
      skills: [
        { id: 'grant_fireball', grantsSpellId: 'fireball' },
      ],
      battleActionPolicy: {
        attackRate: 0,
        mageMagicRate: 100,
        clericMagicRate: 100,
      },
    })

    const result = battleSystem.executeBattle([ally], [ally.stats.hp], [[enemy]], createSeededRng(42), 3)
    const spellLogs = result.detailedLog.filter(log => log.actorId === 'PLAIN_GUARD' && log.action === 'ファイヤーボール')
    const defendLogs = result.detailedLog.filter(log => log.actorId === 'PLAIN_GUARD' && log.action === '防御')

    expect(spellLogs).toHaveLength(1)
    expect(defendLogs).toHaveLength(2)
  })

  it('ブリザードはレベル15メイジ相当で使用できる', () => {
    const battleSystem = new BattleSystem()
    const enemy = createTestEnemy({
      id: 'ICE_MAGE',
      name: '氷術師',
      level: 15,
      hp: 999,
      atk: 1,
      def: 1,
      agility: 50,
      attackCount: 0,
      skills: [
        { id: 'blizzard', grantsSpellId: 'blizzard' },
      ],
    })
    const ally = createTestGoblin({
      stats: { hp: 400, atk: 12, agility: 1, def: 10, attackCount: 1, accuracy: 20, evasion: 15 },
    })

    const result = battleSystem.executeBattle([ally], [ally.stats.hp], [[enemy]], createSeededRng(7), 2)
    const spellLogs = result.detailedLog.filter(log => log.actorId === 'ICE_MAGE' && log.action === 'ブリザード')

    expect(spellLogs).toHaveLength(1)
  })

  it('魔法使い魔法は使用可能な習得呪文からランダムに選ぶ', () => {
    const caster = createTestEnemy({
      id: 'RANDOM_MAGE',
      name: 'ランダム術師',
      level: 13,
      hp: 999,
      atk: 1,
      magicAtk: 100,
      def: 1,
      agility: 100,
      attackCount: 0,
      spells: [{ spellId: 'magic_arrow' }, { spellId: 'fireball' }],
      battleActionPolicy: { attackRate: 0, clericMagicRate: 0, mageMagicRate: 100 },
    })
    const target = createTestGoblin({
      stats: { hp: 999, atk: 1, agility: 1, def: 10, attackCount: 0, accuracy: 20, evasion: 15 },
    })
    const rngValues = [0.5, 0.5, 0.99, 0.5, 0.5, 0.5]
    let rngIndex = 0
    const rng = () => rngValues[rngIndex++] ?? 0.5

    const result = new BattleSystem().executeBattle([target], [target.stats.hp], [[caster]], rng, 1)

    expect(result.detailedLog.some(log => log.actorId === 'RANDOM_MAGE' && log.action === 'ファイヤーボール')).toBe(true)
    expect(result.detailedLog.some(log => log.actorId === 'RANDOM_MAGE' && log.action === 'マジックアロー')).toBe(false)
  })

  it('僧侶魔法は全員のHPが80%超ならバリアを優先する', () => {
    const cleric = createTestGoblin({
      id: 1,
      stats: { hp: 300, atk: 1, agility: 100, def: 10, attackCount: 0, accuracy: 999, evasion: 0 },
      spells: [{ spellId: 'shield_barrier' }, { spellId: 'magic_barrier' }, { spellId: 'heal' }],
      battleActionPolicy: { attackRate: 0, clericMagicRate: 100, mageMagicRate: 0 },
    })
    const enemy = createTestEnemy({ hp: 999, atk: 1, def: 1, agility: 1, attackCount: 0 })

    const result = new BattleSystem().executeBattle([cleric], [270], [[enemy]], () => 0.5, 1)

    expect(result.detailedLog.some(log => log.actorId === '1' && log.action === 'シールドバリア')).toBe(true)
    expect(result.detailedLog.some(log => log.actorId === '1' && log.action === 'ヒール')).toBe(false)
  })

  it('僧侶魔法は79%以下の味方が複数いる場合にパーティヒールを優先する', () => {
    const wounded = createTestGoblin({
      id: 1,
      stats: { hp: 300, atk: 1, agility: 1, def: 10, attackCount: 0, accuracy: 999, evasion: 0 },
      battleActionPolicy: { attackRate: 0, clericMagicRate: 0, mageMagicRate: 0 },
    })
    const cleric = createTestGoblin({
      id: 2,
      stats: { hp: 300, atk: 1, agility: 100, def: 10, attackCount: 0, accuracy: 999, evasion: 0, magicHeal: 30 },
      spells: [{ spellId: 'heal' }, { spellId: 'party_heal' }],
      battleActionPolicy: { attackRate: 0, clericMagicRate: 100, mageMagicRate: 0 },
    })
    const enemy = createTestEnemy({ hp: 999, atk: 1, def: 1, agility: 1, attackCount: 0 })

    const result = new BattleSystem().executeBattle([wounded, cleric], [200, 200], [[enemy]], () => 0.5, 1)

    expect(result.detailedLog.some(log => log.actorId === '2' && log.action === 'パーティヒール')).toBe(true)
    expect(result.detailedLog.some(log => log.actorId === '2' && log.action === 'ヒール')).toBe(false)
  })

  it('僧侶魔法はパーティヒールがない場合に重症の味方へフルヒールを使う', () => {
    const wounded = createTestGoblin({
      id: 1,
      stats: { hp: 300, atk: 1, agility: 1, def: 10, attackCount: 0, accuracy: 999, evasion: 0 },
      battleActionPolicy: { attackRate: 0, clericMagicRate: 0, mageMagicRate: 0 },
    })
    const cleric = createTestGoblin({
      id: 2,
      stats: { hp: 300, atk: 1, agility: 100, def: 10, attackCount: 0, accuracy: 999, evasion: 0, magicHeal: 30 },
      spells: [{ spellId: 'heal' }, { spellId: 'heal_plus' }, { spellId: 'full_heal' }],
      battleActionPolicy: { attackRate: 0, clericMagicRate: 100, mageMagicRate: 0 },
    })
    const enemy = createTestEnemy({ hp: 999, atk: 1, def: 1, agility: 1, attackCount: 0 })

    const result = new BattleSystem().executeBattle([wounded, cleric], [120, 200], [[enemy]], () => 0.5, 1)

    expect(result.detailedLog.some(log => log.actorId === '2' && log.action === 'フルヒール')).toBe(true)
  })

  it('僧侶魔法は単体回復でヒールプラスをヒールより優先する', () => {
    const wounded = createTestGoblin({
      id: 1,
      stats: { hp: 300, atk: 1, agility: 1, def: 10, attackCount: 0, accuracy: 999, evasion: 0 },
      battleActionPolicy: { attackRate: 0, clericMagicRate: 0, mageMagicRate: 0 },
    })
    const cleric = createTestGoblin({
      id: 2,
      stats: { hp: 300, atk: 1, agility: 100, def: 10, attackCount: 0, accuracy: 999, evasion: 0, magicHeal: 30 },
      spells: [{ spellId: 'heal' }, { spellId: 'heal_plus' }],
      battleActionPolicy: { attackRate: 0, clericMagicRate: 100, mageMagicRate: 0 },
    })
    const enemy = createTestEnemy({ hp: 999, atk: 1, def: 1, agility: 1, attackCount: 0 })

    const result = new BattleSystem().executeBattle([wounded, cleric], [210, 300], [[enemy]], () => 0.5, 1)

    expect(result.detailedLog.some(log => log.actorId === '2' && log.action === 'ヒールプラス')).toBe(true)
    expect(result.detailedLog.some(log => log.actorId === '2' && log.action === 'ヒール')).toBe(false)
  })

  it('魔法支援持ちは味方のダメージ魔法に追撃する', () => {
    const caster = createTestGoblin({
      id: 1,
      level: 20,
      stats: { hp: 300, atk: 1, magicAtk: 100, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
      skills: [getCharacterSkill('grant_fireball')],
      battleActionPolicy: { attackRate: 0, clericMagicRate: 0, mageMagicRate: 100 },
    })
    const supporter = createTestGoblin({
      id: 2,
      stats: { hp: 300, atk: 80, agility: 50, def: 10, attackCount: 3, accuracy: 999, evasion: 0, criticalRate: 100 },
      effectiveStats: { hp: 300, atk: 80, magicAtk: 0, def: 10, magicDef: 10, attackCount: 3, accuracy: 999, evasion: 0, magicHeal: 10, criticalRate: 100 },
      baseAttributes: { power: 10, wisdom: 10, spirit: 10, vitality: 10, agility: 50, luck: 50 },
      skills: [getCharacterSkill('magic_support')],
      battleActionPolicy: { attackRate: 0, clericMagicRate: 0, mageMagicRate: 0 },
    })
    const enemy = createTestEnemy({ hp: 999, def: 1, evasion: 0, agility: 1 })

    const result = new BattleSystem().executeBattle(
      [caster, supporter],
      [caster.stats.hp, supporter.stats.hp],
      [[enemy]],
      () => 0,
      1,
    )
    const followUpLog = result.detailedLog.find(log => log.actorId === '2' && log.action === '魔法支援')

    expect(followUpLog?.attackCount).toBe(2)
    expect(followUpLog?.hitCount).toBe(2)
    expect(followUpLog?.isCritical).toBe(true)
    expect(followUpLog?.targets[0]?.totalDamage).toBeGreaterThan(0)
  })

  it('魔法支援は回復魔法では追撃しない', () => {
    const wounded = createTestGoblin({
      id: 1,
      stats: { hp: 300, atk: 1, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
    })
    const cleric = createTestGoblin({
      id: 2,
      stats: { hp: 300, atk: 1, agility: 50, def: 10, attackCount: 1, accuracy: 999, evasion: 0, magicHeal: 30 },
      skills: [getCharacterSkill('grant_heal')],
      battleActionPolicy: { attackRate: 0, clericMagicRate: 100, mageMagicRate: 0 },
    })
    const supporter = createTestGoblin({
      id: 3,
      stats: { hp: 300, atk: 80, agility: 40, def: 10, attackCount: 3, accuracy: 999, evasion: 0 },
      baseAttributes: { power: 10, wisdom: 10, spirit: 10, vitality: 10, agility: 50, luck: 50 },
      skills: [getCharacterSkill('magic_support')],
      battleActionPolicy: { attackRate: 0, clericMagicRate: 0, mageMagicRate: 0 },
    })
    const enemy = createTestEnemy({ hp: 999, atk: 1, def: 1, attackCount: 0, evasion: 0, agility: 1 })

    const result = new BattleSystem().executeBattle(
      [wounded, cleric, supporter],
      [200, cleric.stats.hp, supporter.stats.hp],
      [[enemy]],
      () => 0,
      1,
    )

    expect(result.detailedLog.some(log => log.action === 'ヒール')).toBe(true)
    expect(result.detailedLog.some(log => log.action === '魔法支援')).toBe(false)
  })

  it('打ち合い持ちは物理攻撃を受けた時に攻撃者へ反撃する', () => {
    const defender = createTestGoblin({
      id: 1,
      stats: { hp: 300, atk: 80, agility: 1, def: 10, attackCount: 10, accuracy: 999, evasion: 0, criticalRate: 100 },
      effectiveStats: { hp: 300, atk: 80, magicAtk: 0, def: 10, magicDef: 10, attackCount: 10, accuracy: 999, evasion: 0, magicHeal: 10, criticalRate: 100 },
      baseAttributes: { power: 100, wisdom: 10, spirit: 10, vitality: 10, agility: 1, luck: 10 },
      skills: [getCharacterSkill('counter_attack')],
      battleActionPolicy: { attackRate: 0, clericMagicRate: 0, mageMagicRate: 0 },
    })
    const enemy = createTestEnemy({
      id: 'ATTACKER',
      hp: 999,
      atk: 20,
      def: 1,
      accuracy: 999,
      evasion: 0,
      agility: 100,
    })

    const result = new BattleSystem().executeBattle(
      [defender],
      [defender.stats.hp],
      [[enemy]],
      () => 0,
      1,
    )
    const counterLog = result.detailedLog.find(log => log.actorId === '1' && log.action === '打ち合い')

    expect(counterLog?.attackCount).toBe(3)
    expect(counterLog?.hitCount).toBe(3)
    expect(counterLog?.isCritical).toBe(true)
    expect(counterLog?.targets[0]?.targetId).toBe('ATTACKER')
  })

  it('打ち合いによる反撃にも打ち合いが発生する', () => {
    const defender = createTestGoblin({
      id: 1,
      stats: { hp: 120, atk: 20, agility: 1, def: 10, attackCount: 10, accuracy: 999, evasion: 0, criticalRate: 0 },
      effectiveStats: { hp: 120, atk: 20, magicAtk: 0, def: 10, magicDef: 10, attackCount: 10, accuracy: 999, evasion: 0, magicHeal: 10, criticalRate: 0 },
      baseAttributes: { power: 100, wisdom: 10, spirit: 10, vitality: 10, agility: 1, luck: 10 },
      skills: [getCharacterSkill('counter_attack')],
      battleActionPolicy: { attackRate: 0, clericMagicRate: 0, mageMagicRate: 0 },
    })
    const enemy = createTestEnemy({
      id: 'ATTACKER',
      hp: 160,
      atk: 20,
      def: 10,
      attackCount: 1,
      accuracy: 999,
      evasion: 0,
      agility: 100,
      baseAttributes: { power: 100, wisdom: 10, spirit: 10, vitality: 10, agility: 100, luck: 10 },
      skills: [getCharacterSkill('counter_attack')],
    })

    const result = new BattleSystem().executeBattle(
      [defender],
      [defender.stats.hp],
      [[enemy]],
      () => 0,
      1,
    )
    const counterLogs = result.detailedLog.filter(log => log.action === '打ち合い')

    expect(counterLogs.some(log => log.actorId === '1' && log.targets[0]?.targetId === 'ATTACKER')).toBe(true)
    expect(counterLogs.some(log => log.actorId === 'ATTACKER' && log.targets[0]?.targetId === '1')).toBe(true)
  })

  it('打ち合いは力の発動率に失敗すると反撃しない', () => {
    const defender = createTestGoblin({
      id: 1,
      stats: { hp: 300, atk: 80, agility: 1, def: 10, attackCount: 10, accuracy: 999, evasion: 0, criticalRate: 100 },
      effectiveStats: { hp: 300, atk: 80, magicAtk: 0, def: 10, magicDef: 10, attackCount: 10, accuracy: 999, evasion: 0, magicHeal: 10, criticalRate: 100 },
      baseAttributes: { power: 0, wisdom: 10, spirit: 10, vitality: 10, agility: 1, luck: 10 },
      skills: [getCharacterSkill('counter_attack')],
      battleActionPolicy: { attackRate: 0, clericMagicRate: 0, mageMagicRate: 0 },
    })
    const enemy = createTestEnemy({
      id: 'ATTACKER',
      hp: 999,
      atk: 20,
      def: 1,
      accuracy: 999,
      evasion: 0,
      agility: 100,
    })

    const result = new BattleSystem().executeBattle(
      [defender],
      [defender.stats.hp],
      [[enemy]],
      () => 0,
      1,
    )

    expect(result.detailedLog.some(log => log.action === '打ち合い')).toBe(false)
  })

  it('反撃回避は反撃決定後に反撃をなかったことにする', () => {
    const attacker = createTestGoblin({
      id: 1,
      stats: { hp: 300, atk: 80, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
      skills: [getCharacterSkill('counter_avoidance_1_2')],
    })
    const defender = createTestEnemy({
      id: 'COUNTER',
      hp: 999,
      atk: 20,
      def: 1,
      attackCount: 10,
      accuracy: 999,
      evasion: 0,
      agility: 1,
      baseAttributes: { power: 100, wisdom: 10, spirit: 10, vitality: 10, agility: 1, luck: 10 },
      skills: [getCharacterSkill('counter_attack')],
    })
    const result = new BattleSystem().executeBattle(
      [attacker],
      [attacker.stats.hp],
      [[defender]],
      () => 0,
      1,
    )

    expect(result.detailedLog.some(log => log.action === '打ち合い')).toBe(false)
  })

  it('反撃回避に失敗した場合は反撃する', () => {
    const attacker = createTestGoblin({
      id: 1,
      stats: { hp: 300, atk: 80, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
      skills: [getCharacterSkill('counter_avoidance_1_2')],
    })
    const defender = createTestEnemy({
      id: 'COUNTER',
      hp: 999,
      atk: 20,
      def: 1,
      attackCount: 10,
      accuracy: 999,
      evasion: 0,
      agility: 1,
      baseAttributes: { power: 100, wisdom: 10, spirit: 10, vitality: 10, agility: 1, luck: 10 },
      skills: [getCharacterSkill('counter_attack')],
    })
    const result = new BattleSystem().executeBattle(
      [attacker],
      [attacker.stats.hp],
      [[defender]],
      () => 0.9,
      1,
    )

    expect(result.detailedLog.some(log => log.actorId === 'COUNTER' && log.action === '打ち合い')).toBe(true)
  })

  it('ヒールは魔法回復量ぶん最も傷ついた味方を回復する', () => {
    const battleSystem = new BattleSystem()
    const attacker = createTestGoblin({
      id: 1,
      stats: { hp: 300, atk: 55, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
    })
    const guard = createTestEnemy({
      id: 'GUARD',
      name: '護衛ガード',
      hp: 120,
      atk: 1,
      def: 1,
      agility: 1,
      attackCount: 0,
      evasion: 0,
    })
    const cleric = createTestEnemy({
      id: 'CLERIC',
      name: '護衛クレリック',
      hp: 80,
      atk: 1,
      def: 1,
      agility: 50,
      attackCount: 0,
      magicHeal: 45,
      skills: [{ id: 'grant_heal', grantsSpellId: 'heal' }],
    })

    const result = battleSystem.executeBattle([attacker], [attacker.stats.hp], [[guard], [cleric]], createSeededRng(11), 1)
    const healLog = result.detailedLog.find(log => log.actorId === 'CLERIC' && log.action === 'ヒール')

    // 攻撃者の攻撃が最前列の GUARD に偏るため、より傷ついた GUARD が回復対象になる
    expect(healLog?.targets[0].targetId).toBe('GUARD')
    expect(healLog?.targets[0].totalDamage).toBe(-45)
  })

  it('シールドバリアは味方パーティの通常攻撃ダメージを半減させる', () => {
    const attacker = createTestGoblin({
      id: 1,
      stats: { hp: 300, atk: 90, agility: 1, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
    })
    const guardedTarget = createTestEnemy({
      id: 'GUARD',
      name: '護衛ガード',
      hp: 999,
      atk: 1,
      def: 1,
      agility: 1,
      attackCount: 0,
      evasion: 0,
    })
    const cleric = createTestEnemy({
      id: 'CLERIC',
      name: '護衛クレリック',
      hp: 80,
      atk: 1,
      def: 1,
      agility: 100,
      attackCount: 0,
      skills: [{ id: 'grant_shield_barrier', grantsSpellId: 'shield_barrier' }],
    })

    const shieldedResult = new BattleSystem().executeBattle(
      [attacker],
      [attacker.stats.hp],
      [[guardedTarget], [cleric]],
      () => 0.5,
      1,
    )
    const plainResult = new BattleSystem().executeBattle(
      [attacker],
      [attacker.stats.hp],
      [[createTestEnemy({ ...guardedTarget })]],
      () => 0.5,
      1,
    )

    const shieldedDamage = shieldedResult.detailedLog.find(log => log.actorId === '1' && log.action === '通常攻撃')!.targets[0].totalDamage
    const plainDamage = plainResult.detailedLog.find(log => log.actorId === '1' && log.action === '通常攻撃')!.targets[0].totalDamage

    const barrierLog = shieldedResult.detailedLog.find(log => log.actorId === 'CLERIC' && log.action === 'シールドバリア')
    expect(barrierLog).toBeDefined()
    expect(barrierLog?.actionEffect).toBe('barrier')
    expect(barrierLog?.hitCount).toBe(0)
    expect(barrierLog?.targets).toEqual([])
    expect(shieldedDamage).toBeLessThan(plainDamage)
    expect(shieldedDamage).toBeGreaterThanOrEqual(Math.floor(plainDamage * 0.45))
    expect(shieldedDamage).toBeLessThanOrEqual(Math.ceil(plainDamage * 0.55))
  })

  it('シールドバリア後のターン開始ログに状態が残る', () => {
    const observer = createTestGoblin({
      id: 1,
      stats: { hp: 300, atk: 1, agility: 1, def: 10, attackCount: 0, accuracy: 999, evasion: 0 },
    })
    const cleric = createTestEnemy({
      id: 'CLERIC',
      name: '護衛クレリック',
      hp: 300,
      atk: 1,
      def: 1,
      agility: 100,
      attackCount: 0,
      skills: [{ id: 'grant_shield_barrier', grantsSpellId: 'shield_barrier' }],
    })

    const result = new BattleSystem().executeBattle(
      [observer],
      [observer.stats.hp],
      [[cleric]],
      createSeededRng(29),
      2,
    )
    const secondTurnStart = result.detailedLog.find(log => log.action === 'turn_start' && log.turn === 2)

    expect(secondTurnStart?.turnState?.enemies[0].shieldBarrierActive).toBe(true)
  })

  it('シールドバリアは元の物理軽減と乗算される', () => {
    const attacker = createTestGoblin({
      id: 1,
      stats: { hp: 300, atk: 90, agility: 1, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
    })
    const guardedTarget = createTestEnemy({
      id: 'GUARD',
      name: '護衛ガード',
      hp: 999,
      atk: 1,
      def: 1,
      agility: 1,
      attackCount: 0,
      evasion: 0,
      skills: [{ id: 'physical_reduction_50', physicalDamageReductionPercent: 50 }],
    })
    const cleric = createTestEnemy({
      id: 'CLERIC',
      name: '護衛クレリック',
      hp: 80,
      atk: 1,
      def: 1,
      agility: 100,
      attackCount: 0,
      skills: [{ id: 'grant_shield_barrier', grantsSpellId: 'shield_barrier' }],
    })

    const shieldedResult = new BattleSystem().executeBattle(
      [attacker],
      [attacker.stats.hp],
      [[guardedTarget], [cleric]],
      () => 0.5,
      1,
    )
    const plainResult = new BattleSystem().executeBattle(
      [attacker],
      [attacker.stats.hp],
      [[createTestEnemy({ ...guardedTarget })]],
      () => 0.5,
      1,
    )

    const shieldedDamage = shieldedResult.detailedLog.find(log => log.actorId === '1' && log.action === '通常攻撃')!.targets[0].totalDamage
    const plainDamage = plainResult.detailedLog.find(log => log.actorId === '1' && log.action === '通常攻撃')!.targets[0].totalDamage

    expect(shieldedDamage).toBeGreaterThanOrEqual(Math.floor(plainDamage * 0.45))
    expect(shieldedDamage).toBeLessThanOrEqual(Math.ceil(plainDamage * 0.55))
  })

  it('マジックフィールドは戦闘開始時に自動発動し味方の魔法ダメージを1.5倍にする', () => {
    const boostedCaster = createTestGoblin({
      id: 1,
      name: '支援クレリック',
      level: 13,
      spells: [{ spellId: 'magic_arrow' }],
      skills: [{ id: 'magic_field', partyMagicDamageMultiplier: 1.5 }],
      stats: { hp: 300, atk: 1, magicAtk: 100, agility: 100, def: 10, attackCount: 0, accuracy: 999, evasion: 0 },
    })
    const plainCaster = createTestGoblin({
      id: 1,
      name: '支援クレリック',
      level: 13,
      spells: [{ spellId: 'magic_arrow' }],
      skills: [],
      stats: { hp: 300, atk: 1, magicAtk: 100, agility: 100, def: 10, attackCount: 0, accuracy: 999, evasion: 0 },
    })
    const target = createTestEnemy({
      id: 'TARGET',
      name: '標的',
      hp: 999,
      atk: 1,
      def: 1,
      magicDef: 1,
      agility: 1,
      attackCount: 0,
      evasion: 0,
    })

    const boostedResult = new BattleSystem().executeBattle(
      [boostedCaster],
      [boostedCaster.stats.hp],
      [[target]],
      () => 0.5,
      1,
    )
    const plainResult = new BattleSystem().executeBattle(
      [plainCaster],
      [plainCaster.stats.hp],
      [[createTestEnemy({ ...target })]],
      () => 0.5,
      1,
    )

    const magicFieldLog = boostedResult.detailedLog.find(log => log.actionEffect === 'magic_field')
    const boostedDamage = boostedResult.detailedLog.find(log => log.actorId === '1' && log.action === 'マジックアロー')!.targets[0].totalDamage
    const plainDamage = plainResult.detailedLog.find(log => log.actorId === '1' && log.action === 'マジックアロー')!.targets[0].totalDamage
    const firstTurnStart = boostedResult.detailedLog.find(log => log.action === 'turn_start' && log.turn === 1)

    expect(magicFieldLog?.turn).toBe(0)
    expect(magicFieldLog?.action).toBe('マジックフィールド')
    expect(boostedResult.detailedLog.some(log => log.turn === 1 && log.actorId === '1' && log.action === 'マジックアロー')).toBe(true)
    expect(firstTurnStart?.turnState?.allyPartyEffects).toContain('magic_field')
    expect(boostedDamage).toBeGreaterThanOrEqual(Math.floor(plainDamage * 1.45))
    expect(boostedDamage).toBeLessThanOrEqual(Math.ceil(plainDamage * 1.55))
  })

  it('アタックアップ後は味方の通常攻撃ダメージが1.6倍になる', () => {
    const buffer = createTestGoblin({
      id: 1,
      name: '支援メイジ',
      level: 13,
      spells: [{ spellId: 'attack_up' }],
      stats: { hp: 300, atk: 1, agility: 100, def: 10, attackCount: 0, accuracy: 999, evasion: 0 },
    })
    const attacker = createTestGoblin({
      id: 2,
      name: '攻撃役',
      stats: { hp: 300, atk: 90, agility: 50, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
    })
    const target = createTestEnemy({
      id: 'TARGET',
      name: '標的',
      hp: 999,
      atk: 1,
      def: 1,
      agility: 1,
      attackCount: 0,
      evasion: 0,
    })

    const buffedResult = new BattleSystem().executeBattle(
      [buffer, attacker],
      [buffer.stats.hp, attacker.stats.hp],
      [[target]],
      () => 0.5,
      1,
    )
    const plainResult = new BattleSystem().executeBattle(
      [attacker],
      [attacker.stats.hp],
      [[createTestEnemy({ ...target })]],
      () => 0.5,
      1,
    )

    const attackUpLog = buffedResult.detailedLog.find(log => log.actorId === '1' && log.action === 'アタックアップ')
    const buffedDamage = buffedResult.detailedLog.find(log => log.actorId === '2' && log.action === '通常攻撃')!.targets[0].totalDamage
    const plainDamage = plainResult.detailedLog.find(log => log.actorId === '2' && log.action === '通常攻撃')!.targets[0].totalDamage

    expect(attackUpLog).toBeDefined()
    expect(attackUpLog?.actionEffect).toBe('attack_up')
    expect(attackUpLog?.targets).toEqual([])
    expect(buffedDamage).toBeGreaterThanOrEqual(Math.floor(plainDamage * 1.55))
    expect(buffedDamage).toBeLessThanOrEqual(Math.ceil(plainDamage * 1.65))
  })

  it('物理威力スキルは通常攻撃ダメージを増加させる', () => {
    const boostedAttacker = createTestGoblin({
      id: 1,
      skills: [{ id: 'physical_damage_50', physicalDamagePercent: 50 }],
      stats: { hp: 300, atk: 90, agility: 50, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
    })
    const plainAttacker = createTestGoblin({
      id: 1,
      skills: [],
      stats: { hp: 300, atk: 90, agility: 50, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
    })
    const target = createTestEnemy({
      id: 'TARGET',
      name: '標的',
      hp: 999,
      atk: 1,
      def: 1,
      agility: 1,
      attackCount: 0,
      evasion: 0,
    })

    const boostedResult = new BattleSystem().executeBattle(
      [boostedAttacker],
      [boostedAttacker.stats.hp],
      [[target]],
      () => 0.5,
      1,
    )
    const plainResult = new BattleSystem().executeBattle(
      [plainAttacker],
      [plainAttacker.stats.hp],
      [[createTestEnemy({ ...target })]],
      () => 0.5,
      1,
    )

    const boostedDamage = boostedResult.detailedLog.find(log => log.actorId === '1' && log.action === '通常攻撃')!.targets[0].totalDamage
    const plainDamage = plainResult.detailedLog.find(log => log.actorId === '1' && log.action === '通常攻撃')!.targets[0].totalDamage

    expect(boostedDamage).toBeGreaterThanOrEqual(Math.floor(plainDamage * 1.45))
    expect(boostedDamage).toBeLessThanOrEqual(Math.ceil(plainDamage * 1.55))
  })

  it('物理威力スキルは呪文ダメージを増加させない', () => {
    const boostedCaster = createTestGoblin({
      id: 1,
      level: 13,
      spells: [{ spellId: 'magic_arrow' }],
      skills: [{ id: 'physical_damage_50', physicalDamagePercent: 50 }],
      stats: { hp: 300, atk: 1, magicAtk: 100, agility: 100, def: 10, attackCount: 0, accuracy: 999, evasion: 0 },
    })
    const plainCaster = createTestGoblin({
      id: 1,
      level: 13,
      spells: [{ spellId: 'magic_arrow' }],
      skills: [],
      stats: { hp: 300, atk: 1, magicAtk: 100, agility: 100, def: 10, attackCount: 0, accuracy: 999, evasion: 0 },
    })
    const target = createTestEnemy({
      id: 'TARGET',
      name: '標的',
      hp: 999,
      atk: 1,
      def: 1,
      agility: 1,
      attackCount: 0,
      evasion: 0,
    })

    const boostedResult = new BattleSystem().executeBattle(
      [boostedCaster],
      [boostedCaster.stats.hp],
      [[target]],
      () => 0.5,
      1,
    )
    const plainResult = new BattleSystem().executeBattle(
      [plainCaster],
      [plainCaster.stats.hp],
      [[createTestEnemy({ ...target })]],
      () => 0.5,
      1,
    )

    const boostedDamage = boostedResult.detailedLog.find(log => log.actorId === '1' && log.action === 'マジックアロー')!.targets[0].totalDamage
    const plainDamage = plainResult.detailedLog.find(log => log.actorId === '1' && log.action === 'マジックアロー')!.targets[0].totalDamage

    expect(boostedDamage).toBe(plainDamage)
  })

  it('パーティヒールは魔法回復量+50で傷ついた味方全員を回復する', () => {
    const battleSystem = new BattleSystem()
    const attacker = createTestGoblin({
      id: 1,
      stats: { hp: 300, atk: 150, agility: 120, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
    })
    const cleric = createTestEnemy({
      id: 'CLERIC',
      name: '護衛クレリック',
      hp: 300,
      atk: 1,
      def: 1,
      agility: 50,
      attackCount: 0,
      magicHeal: 45,
      skills: [{ id: 'grant_party_heal', grantsSpellId: 'party_heal' }],
    })

    const result = battleSystem.executeBattle(
      [attacker],
      [attacker.stats.hp],
      [[cleric]],
      createSeededRng(23),
      1,
    )
    const healLog = result.detailedLog.find(log => log.actorId === 'CLERIC' && log.action === 'パーティヒール')

    expect(healLog?.targets.length).toBeGreaterThanOrEqual(1)
    expect(healLog?.targets[0].targetId).toBe('CLERIC')
    expect(healLog?.targets[0].totalDamage).toBe(-95)
  })

  it('攻撃行動率0のユニットは通常攻撃せず防御する', () => {
    const defender = createTestGoblin({
      id: 1,
      stats: { hp: 300, atk: 80, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
      battleActionPolicy: { attackRate: 0, clericMagicRate: 100, mageMagicRate: 100 },
    })
    const enemy = createTestEnemy({
      hp: 300,
      atk: 1,
      def: 1,
      agility: 1,
      attackCount: 0,
    })

    const result = new BattleSystem().executeBattle([defender], [defender.stats.hp], [[enemy]], createSeededRng(5), 1)

    expect(result.detailedLog.some(log => log.actorId === '1' && log.action === '防御')).toBe(true)
    expect(result.detailedLog.some(log => log.actorId === '1' && log.action === '通常攻撃')).toBe(false)
  })

  it('遠征戦闘でも攻撃行動率0のユニットは防御する', () => {
    const partyState = [{
      id: '1',
      name: '防御役',
      race: 'ゴブリン',
      currentHP: 300,
      maxHP: 300,
      baseHP: 300,
      atk: 80,
      magicAtk: 0,
      def: 10,
      magicDef: 0,
      agility: 100,
      attackCount: 1,
      accuracy: 999,
      evasion: 0,
      magicHeal: 0,
      isKO: false,
      isDead: false,
      skills: [],
      factors: [],
      spells: [],
      battleActionPolicy: { attackRate: 0, clericMagicRate: 100, mageMagicRate: 100 },
      level: 1,
      avatar: '/test.png',
    }]
    const enemy = createTestEnemy({
      hp: 300,
      atk: 1,
      def: 1,
      agility: 1,
      attackCount: 0,
    })
    const combat = (new ExpeditionEngine(1) as any).resolveCombat(partyState, [[enemy]], { areaLevel: 1 }, false)

    expect(combat.detailedLog.some((log: any) => log.actorId === '1' && log.action === '防御')).toBe(true)
    expect(combat.detailedLog.some((log: any) => log.actorId === '1' && log.action === '通常攻撃')).toBe(false)
  })

  it('防御後に受ける通常攻撃ダメージは半減する', () => {
    const defender = createTestGoblin({
      id: 1,
      stats: { hp: 999, atk: 1, agility: 100, def: 10, attackCount: 0, accuracy: 999, evasion: 0 },
      battleActionPolicy: { attackRate: 0, clericMagicRate: 100, mageMagicRate: 100 },
    })
    const plainTarget = createTestGoblin({
      id: 1,
      stats: { hp: 999, atk: 1, agility: 100, def: 10, attackCount: 0, accuracy: 999, evasion: 0 },
    })
    const enemy = createTestEnemy({
      id: 'ATTACKER',
      hp: 999,
      atk: 120,
      def: 1,
      agility: 1,
      attackCount: 1,
      accuracy: 999,
      evasion: 0,
    })

    const defendedResult = new BattleSystem().executeBattle([defender], [defender.stats.hp], [[enemy]], () => 0.5, 1)
    const plainResult = new BattleSystem().executeBattle([plainTarget], [plainTarget.stats.hp], [[createTestEnemy({ ...enemy })]], () => 0.5, 1)
    const defendedDamage = defendedResult.detailedLog.find(log => log.actorId === 'ATTACKER')!.targets[0].totalDamage
    const plainDamage = plainResult.detailedLog.find(log => log.actorId === 'ATTACKER')!.targets[0].totalDamage

    expect(defendedDamage).toBeLessThan(plainDamage)
    expect(defendedDamage).toBeGreaterThanOrEqual(Math.floor(plainDamage * 0.45))
    expect(defendedDamage).toBeLessThanOrEqual(Math.ceil(plainDamage * 0.55))
  })

  it('防御前に受けた通常攻撃ダメージは半減しない', () => {
    const defender = createTestGoblin({
      id: 1,
      stats: { hp: 999, atk: 1, agility: 1, def: 10, attackCount: 0, accuracy: 999, evasion: 0 },
      battleActionPolicy: { attackRate: 0, clericMagicRate: 100, mageMagicRate: 100 },
    })
    const plainTarget = createTestGoblin({
      id: 1,
      stats: { hp: 999, atk: 1, agility: 1, def: 10, attackCount: 0, accuracy: 999, evasion: 0 },
    })
    const enemy = createTestEnemy({
      id: 'FAST_ATTACKER',
      hp: 999,
      atk: 120,
      def: 1,
      agility: 100,
      attackCount: 1,
      accuracy: 999,
      evasion: 0,
    })

    const defendedResult = new BattleSystem().executeBattle([defender], [defender.stats.hp], [[enemy]], createSeededRng(13), 1)
    const plainResult = new BattleSystem().executeBattle([plainTarget], [plainTarget.stats.hp], [[createTestEnemy({ ...enemy })]], createSeededRng(13), 1)
    const defendedDamage = defendedResult.detailedLog.find(log => log.actorId === 'FAST_ATTACKER')!.targets[0].totalDamage
    const plainDamage = plainResult.detailedLog.find(log => log.actorId === 'FAST_ATTACKER')!.targets[0].totalDamage

    expect(defendedDamage).toBe(plainDamage)
  })

  it('防御状態は次ターン開始時に解除される', () => {
    const defender = createTestGoblin({
      id: 1,
      stats: { hp: 999, atk: 1, agility: 100, def: 10, attackCount: 0, accuracy: 999, evasion: 0 },
      battleActionPolicy: { attackRate: 0, clericMagicRate: 100, mageMagicRate: 100 },
    })
    const enemy = createTestEnemy({
      id: 'ORDER_ATTACKER',
      hp: 999,
      atk: 120,
      def: 1,
      agility: 1,
      attackCount: 1,
      accuracy: 999,
      evasion: 0,
    })

    const result = new BattleSystem().executeBattle([defender], [defender.stats.hp], [[enemy]], createSeededRng(37), 2)
    const firstTurnDefendLog = result.detailedLog.find(log => log.turn === 1 && log.actorId === '1' && log.action === '防御')
    const secondTurnStart = result.detailedLog.find(log => log.turn === 2 && log.action === 'turn_start')

    expect(firstTurnDefendLog).toBeDefined()
    expect(secondTurnStart?.turnState?.allies[0].isDefending).toBe(false)
  })

  it('僧侶魔法使用率0なら回復魔法を使わず防御できる', () => {
    const attacker = createTestGoblin({
      id: 1,
      stats: { hp: 300, atk: 150, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
    })
    const cleric = createTestEnemy({
      id: 'CLERIC_POLICY',
      hp: 300,
      atk: 1,
      def: 1,
      agility: 50,
      attackCount: 1,
      magicHeal: 80,
      accuracy: 999,
      evasion: 0,
      skills: [{ id: 'recovery_magic_lv7', recoveryMagicLevel: 7 }],
      battleActionPolicy: { attackRate: 0, clericMagicRate: 0, mageMagicRate: 100 },
    })

    const result = new BattleSystem().executeBattle([attacker], [attacker.stats.hp], [[cleric]], createSeededRng(23), 1)

    expect(result.detailedLog.some(log => log.actorId === 'CLERIC_POLICY' && log.action === 'ヒール')).toBe(false)
    expect(result.detailedLog.some(log => log.actorId === 'CLERIC_POLICY' && log.action === '防御')).toBe(true)
  })

  it('魔法使い魔法使用率0なら攻撃魔法を使わず防御できる', () => {
    const ally = createTestGoblin({
      id: 1,
      stats: { hp: 500, atk: 1, agility: 1, def: 10, attackCount: 0, accuracy: 999, evasion: 0 },
    })
    const mage = createTestEnemy({
      id: 'MAGE_POLICY',
      hp: 300,
      atk: 1,
      def: 1,
      agility: 100,
      attackCount: 1,
      skills: [{ id: 'grant_fireball', grantsSpellId: 'fireball' }],
      battleActionPolicy: { attackRate: 0, clericMagicRate: 100, mageMagicRate: 0 },
    })

    const result = new BattleSystem().executeBattle([ally], [ally.stats.hp], [[mage]], createSeededRng(31), 1)

    expect(result.detailedLog.some(log => log.actorId === 'MAGE_POLICY' && log.action === 'ファイヤーボール')).toBe(false)
    expect(result.detailedLog.some(log => log.actorId === 'MAGE_POLICY' && log.action === '防御')).toBe(true)
  })
})

describe('BattleSystem — ジョブ系スキル', () => {
  it('かばう持ちはHP半分以下の後列への通常攻撃を肩代わりする', () => {
    const battleSystem = new BattleSystem()
    const guard = createTestGoblin({
      id: 1,
      skills: [{ id: 'cover', coverLowHpAlly: true }],
      stats: { hp: 120, atk: 5, agility: 20, def: 20, attackCount: 1, accuracy: 999, evasion: 0 },
    })
    const rear = createTestGoblin({
      id: 2,
      name: '後衛',
      stats: { hp: 100, atk: 5, agility: 10, def: 5, attackCount: 1, accuracy: 0, evasion: 0 },
    })
    const enemy = createTestEnemy({
      atk: 50,
      agility: 100,
      accuracy: 999,
      evasion: 0,
    })

    const result = battleSystem.executeBattle([guard, rear], [guard.stats.hp, 40], [[enemy]], createSeededRng(3), 1)
    const enemyAttackLog = result.detailedLog.find(log => log.actorId === enemy.id && log.action === '通常攻撃')

    expect(enemyAttackLog?.targets[0]?.targetId).toBe(String(guard.id))
  })

  it('鼓舞持ちの後列はダメージが上がる', () => {
    const battleSystem = new BattleSystem()
    const warrior = createTestGoblin({
      id: 1,
      stats: { hp: 120, atk: 5, agility: 20, def: 20, attackCount: 1, accuracy: 999, evasion: 0 },
      skills: [{ id: 'inspire', rearAllyDamageMultiplier: 1.5 }],
    })
    const attacker = createTestGoblin({
      id: 2,
      name: '後衛',
      stats: { hp: 100, atk: 40, agility: 100, def: 5, attackCount: 1, accuracy: 999, evasion: 0 },
      skills: [],
    })
    const enemy = createTestEnemy({ hp: 200, def: 1, evasion: 0, agility: 1 })

    const result = battleSystem.executeBattle([warrior, attacker], [warrior.stats.hp, attacker.stats.hp], [[enemy]], createSeededRng(1), 1)
    const attackerLog = result.detailedLog.find(log => log.actorId === String(attacker.id) && log.action === '通常攻撃')

    expect((attackerLog?.targets[0]?.totalDamage ?? 0)).toBeGreaterThan(50)
  })

  it('鼓舞持ちが複数いても最前列の1体分だけ適用する', () => {
    const battleSystem = new BattleSystem()
    const frontInspire = createTestGoblin({
      id: 1,
      skills: [{ id: 'inspire_front', rearAllyDamageMultiplier: 1.5 }],
      stats: { hp: 120, atk: 5, agility: 20, def: 20, attackCount: 1, accuracy: 999, evasion: 0 },
    })
    const middleInspire = createTestGoblin({
      id: 2,
      skills: [{ id: 'inspire_middle', rearAllyDamageMultiplier: 1.5 }],
      stats: { hp: 120, atk: 5, agility: 15, def: 20, attackCount: 1, accuracy: 999, evasion: 0 },
    })
    const attacker = createTestGoblin({
      id: 3,
      name: '後衛',
      skills: [],
      stats: { hp: 100, atk: 40, agility: 100, def: 5, attackCount: 1, accuracy: 999, evasion: 0 },
    })
    const enemy = createTestEnemy({ hp: 200, def: 1, evasion: 0, agility: 1 })

    const result = battleSystem.executeBattle(
      [frontInspire, middleInspire, attacker],
      [frontInspire.stats.hp, middleInspire.stats.hp, attacker.stats.hp],
      [[enemy]],
      createSeededRng(1),
      1,
    )
    const attackerLog = result.detailedLog.find(log => log.actorId === String(attacker.id) && log.action === '通常攻撃')

    expect(attackerLog?.targets[0]?.totalDamage).toBe(49)
  })

  it('群れ持ちはLv15以上で純粋なゴブリン数に応じてHPと攻撃力が上がる', () => {
    const baseStats = { hp: 100, atk: 100, magicAtk: 0, def: 10, magicDef: 10, attackCount: 1, accuracy: 999, evasion: 0, magicHeal: 10, criticalRate: 0 }
    const packGoblin = createTestGoblin({
      id: 1,
      level: 15,
      stats: baseStats,
      effectiveStats: baseStats,
      skills: [getCharacterSkill('goblin_pack_tactics')],
      battleActionPolicy: { attackRate: 100, clericMagicRate: 0, mageMagicRate: 0 },
    })
    const plainGoblin = createTestGoblin({
      id: 1,
      level: 15,
      stats: baseStats,
      effectiveStats: baseStats,
      skills: [],
      battleActionPolicy: { attackRate: 100, clericMagicRate: 0, mageMagicRate: 0 },
    })
    const pureFriend = createTestGoblin({
      id: 2,
      stats: { hp: 100, atk: 1, agility: 1, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
      battleActionPolicy: { attackRate: 0, clericMagicRate: 0, mageMagicRate: 0 },
    })
    const variantFriend = createTestGoblin({
      id: 3,
      race: 'ウルフゴブリン',
      raceId: 'wolf',
      variantFactorId: 'wolf',
      stats: { hp: 100, atk: 1, agility: 1, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
      battleActionPolicy: { attackRate: 0, clericMagicRate: 0, mageMagicRate: 0 },
    })
    const boostedResult = new BattleSystem().executeBattle(
      [packGoblin, pureFriend, variantFriend],
      [packGoblin.stats.hp, pureFriend.stats.hp, variantFriend.stats.hp],
      [[createTestEnemy({ hp: 999, def: 1, evasion: 0, agility: 1 })]],
      () => 0.5,
      1,
    )
    const plainResult = new BattleSystem().executeBattle(
      [plainGoblin, pureFriend, variantFriend],
      [plainGoblin.stats.hp, pureFriend.stats.hp, variantFriend.stats.hp],
      [[createTestEnemy({ hp: 999, def: 1, evasion: 0, agility: 1 })]],
      () => 0.5,
      1,
    )
    const boostedLog = boostedResult.detailedLog.find(log => log.actorId === '1' && log.action === '通常攻撃')!
    const plainLog = plainResult.detailedLog.find(log => log.actorId === '1' && log.action === '通常攻撃')!

    expect(boostedLog.actorMaxHP).toBe(110)
    expect(boostedLog.targets[0].totalDamage).toBeGreaterThan(plainLog.targets[0].totalDamage)
  })

  it('群れはLv14以下では発動しない', () => {
    const stats = { hp: 100, atk: 100, magicAtk: 0, def: 10, magicDef: 10, attackCount: 1, accuracy: 999, evasion: 0, magicHeal: 10, criticalRate: 0 }
    const packGoblin = createTestGoblin({
      id: 1,
      level: 14,
      stats,
      effectiveStats: stats,
      skills: [getCharacterSkill('goblin_pack_tactics')],
      battleActionPolicy: { attackRate: 100, clericMagicRate: 0, mageMagicRate: 0 },
    })
    const pureFriend = createTestGoblin({
      id: 2,
      battleActionPolicy: { attackRate: 0, clericMagicRate: 0, mageMagicRate: 0 },
    })
    const result = new BattleSystem().executeBattle(
      [packGoblin, pureFriend],
      [packGoblin.stats.hp, pureFriend.stats.hp],
      [[createTestEnemy({ hp: 999, def: 1, evasion: 0, agility: 1 })]],
      () => 0.5,
      1,
    )
    const log = result.detailedLog.find(entry => entry.actorId === '1' && entry.action === '通常攻撃')!

    expect(log.actorMaxHP).toBe(100)
  })

  it('気合い持ちは致死ダメージを受けてもHP1で耐える', () => {
    const battleSystem = new BattleSystem()
    const hobgoblin = createTestGoblin({
      id: 1,
      race: 'ホブゴブリン',
      stats: { hp: 100, atk: 10, agility: 50, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
    })
    const enemy = createTestEnemy({
      atk: 999,
      accuracy: 999,
      evasion: 0,
      agility: 100,
    })

    const result = battleSystem.executeBattle([hobgoblin], [hobgoblin.stats.hp], [[enemy]], createSeededRng(2), 1)

    expect(result.allyHPDelta[0]).toBe(1 - hobgoblin.stats.hp)
    expect(result.outcome).not.toBe('lose')
  })

  it('即時蘇生は未行動なら味方の死亡直後に発動し、そのターンの行動を消費する', () => {
    const battleSystem = new BattleSystem()
    const victim = createTestGoblin({
      id: 1,
      name: '前衛',
      stats: { hp: 40, atk: 5, agility: 1, def: 5, attackCount: 1, accuracy: 1, evasion: 0 },
      skills: [],
    })
    const reviver = createTestGoblin({
      id: 2,
      name: '僧侶',
      stats: { hp: 80, atk: 20, magicHeal: 30, agility: 10, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
      skills: [
        { id: 'instant_revive', immediateReviveOnAllyDeath: true },
        { id: 'recovery_magic_lv1', recoveryMagicLevel: 1 },
      ],
    })
    const enemy = createTestEnemy({
      id: 'EXECUTIONER',
      name: '処刑人',
      hp: 999,
      atk: 999,
      def: 1,
      agility: 100,
      attackCount: 1,
      accuracy: 999,
      evasion: 0,
    })

    const result = battleSystem.executeBattle([victim, reviver], [victim.stats.hp, reviver.stats.hp], [[enemy]], () => 0, 1)
    const reviverLogs = result.detailedLog.filter(log => log.actorId === '2')

    expect(reviverLogs.map(log => log.action)).toEqual(['ヒール'])
    expect(reviverLogs[0].targets[0].targetId).toBe('1')
    expect(reviverLogs[0].targets[0].totalDamage).toBe(-30)
    expect(reviverLogs[0].targets[0].targetHP).toBe(30)
  })

  it('即時蘇生持ちがそのターンに行動済みなら蘇生しない', () => {
    const battleSystem = new BattleSystem()
    const victim = createTestGoblin({
      id: 1,
      name: '前衛',
      stats: { hp: 40, atk: 5, agility: 1, def: 5, attackCount: 1, accuracy: 1, evasion: 0 },
      skills: [],
    })
    const reviver = createTestGoblin({
      id: 2,
      name: '僧侶',
      stats: { hp: 80, atk: 20, magicHeal: 30, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
      skills: [
        { id: 'instant_revive', immediateReviveOnAllyDeath: true },
        { id: 'recovery_magic_lv1', recoveryMagicLevel: 1 },
      ],
      battleActionPolicy: { attackRate: 0, clericMagicRate: 100, mageMagicRate: 100 },
    })
    const enemy = createTestEnemy({
      id: 'EXECUTIONER',
      name: '処刑人',
      hp: 999,
      atk: 999,
      def: 1,
      agility: 50,
      attackCount: 1,
      accuracy: 999,
      evasion: 0,
    })

    const result = battleSystem.executeBattle([victim, reviver], [victim.stats.hp, reviver.stats.hp], [[enemy]], () => 0, 1)
    const reviverLogs = result.detailedLog.filter(log => log.actorId === '2')
    const victimTurnState = result.detailedLog.find(log => log.actorId === 'EXECUTIONER' && log.action === '通常攻撃')

    expect(reviverLogs.map(log => log.action)).toEqual(['防御'])
    expect(victimTurnState?.targets[0].targetId).toBe('1')
    expect(victimTurnState?.targets[0].defeated).toBe(true)
    expect(victimTurnState?.targets[0].targetHP).toBe(0)
  })

  it('即時蘇生のパーティヒールは死亡者を含むPTメンバーをまとめて回復する', () => {
    const deadFront = createTestGoblin({
      id: 1,
      name: '倒れている前衛',
      stats: { hp: 40, atk: 5, agility: 1, def: 5, attackCount: 1, accuracy: 1, evasion: 0 },
      skills: [],
    })
    const victim = createTestGoblin({
      id: 2,
      name: '倒される中衛',
      stats: { hp: 40, atk: 5, agility: 1, def: 5, attackCount: 1, accuracy: 1, evasion: 0 },
      skills: [],
    })
    const reviver = createTestGoblin({
      id: 3,
      name: '僧侶',
      spells: [{ spellId: 'party_heal' }],
      stats: { hp: 80, atk: 20, magicHeal: 30, agility: 10, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
      skills: [{ id: 'instant_revive', immediateReviveOnAllyDeath: true }],
    })
    const enemy = createTestEnemy({
      id: 'EXECUTIONER',
      name: '処刑人',
      hp: 999,
      atk: 999,
      def: 1,
      agility: 100,
      attackCount: 1,
      accuracy: 999,
      evasion: 0,
    })

    const result = new BattleSystem().executeBattle(
      [deadFront, victim, reviver],
      [0, victim.stats.hp, reviver.stats.hp],
      [[enemy]],
      () => 0,
      1,
    )
    const reviveLog = result.detailedLog.find(log => log.actorId === '3' && log.action === 'パーティヒール')

    expect(reviveLog?.targets.map(target => target.targetId)).toEqual(['1', '2'])
    expect(reviveLog?.targets.map(target => target.targetHP)).toEqual([40, 40])
  })

  it('即時蘇生の単体回復は複数死亡時に前列のメンバーを蘇生する', () => {
    const deadFront = createTestGoblin({
      id: 1,
      name: '倒れている前衛',
      stats: { hp: 40, atk: 5, agility: 1, def: 5, attackCount: 1, accuracy: 1, evasion: 0 },
      skills: [],
    })
    const victim = createTestGoblin({
      id: 2,
      name: '倒される中衛',
      stats: { hp: 40, atk: 5, agility: 1, def: 5, attackCount: 1, accuracy: 1, evasion: 0 },
      skills: [],
    })
    const reviver = createTestGoblin({
      id: 3,
      name: '僧侶',
      spells: [{ spellId: 'heal' }],
      stats: { hp: 80, atk: 20, magicHeal: 30, agility: 10, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
      skills: [{ id: 'instant_revive', immediateReviveOnAllyDeath: true }],
    })
    const enemy = createTestEnemy({
      id: 'EXECUTIONER',
      name: '処刑人',
      hp: 999,
      atk: 999,
      def: 1,
      agility: 100,
      attackCount: 1,
      accuracy: 999,
      evasion: 0,
    })

    const result = new BattleSystem().executeBattle(
      [deadFront, victim, reviver],
      [0, victim.stats.hp, reviver.stats.hp],
      [[enemy]],
      () => 0,
      1,
    )
    const reviveLog = result.detailedLog.find(log => log.actorId === '3' && log.action === 'ヒール')

    expect(reviveLog?.targets).toHaveLength(1)
    expect(reviveLog?.targets[0].targetId).toBe('1')
    expect(reviveLog?.targets[0].targetHP).toBe(30)
  })

  it('気合い持ちでもHP1の状態で致死ダメージを受けたら倒れる', () => {
    const battleSystem = new BattleSystem()
    const hobgoblin = createTestGoblin({
      id: 1,
      race: 'ホブゴブリン',
      stats: { hp: 100, atk: 10, agility: 50, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
    })
    const enemy = createTestEnemy({
      atk: 999,
      accuracy: 999,
      evasion: 0,
      agility: 100,
    })

    const result = battleSystem.executeBattle([hobgoblin], [1], [[enemy]], createSeededRng(2), 1)

    expect(result.allyHPDelta[0]).toBe(-1)
    expect(result.outcome).toBe('lose')
  })
})

// =========================================================================
// 隊列システム — BattleSystem統合テスト
// =========================================================================
describe('BattleSystem — 隊列統合テスト', () => {
  it('2D敵配列で戦闘が正常に実行される', () => {
    const allies = [createTestGoblin({
      stats: { hp: 100, atk: 50, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 10 },
    })]
    // 2列の敵: 列0=[敵A], 列1=[敵B]
    const enemies: Enemy[][] = [
      [createTestEnemy({ id: 'EA', name: '敵A', hp: 50, agility: 1, evasion: 0 })],
      [createTestEnemy({ id: 'EB', name: '敵B', hp: 50, agility: 1, evasion: 0 })],
    ]

    const rng = createSeededRng(42)
    const battle = new BattleSystem()
    const result = battle.executeBattle(allies, [100], enemies, rng, 10)

    expect(result.outcome).toBe('win')
  })

  it('同一列に複数敵を配置して戦闘が正常に動作する', () => {
    const allies = [createTestGoblin({
      stats: { hp: 200, atk: 50, agility: 100, def: 10, attackCount: 2, accuracy: 999, evasion: 10 },
    })]
    // 列0に2体の敵
    const enemies: Enemy[][] = [
      [
        createTestEnemy({ id: 'EA', name: '敵A', hp: 30, agility: 1, evasion: 0 }),
        createTestEnemy({ id: 'EB', name: '敵B', hp: 30, agility: 1, evasion: 0 }),
      ],
    ]

    const rng = createSeededRng(100)
    const battle = new BattleSystem()
    const result = battle.executeBattle(allies, [200], enemies, rng, 10)

    expect(result.outcome).toBe('win')
    expect(result.enemyDefeated).toBe(2)
  })

  it('前列の敵が後列より多くダメージを受ける（統計的検証）', () => {
    // 3列の敵に攻撃して、ダメージの分布を確認
    const damageByName: Record<string, number> = { 'Lv1 前列': 0, 'Lv1 中列': 0, 'Lv1 後列': 0 }

    for (let seed = 0; seed < 100; seed++) {
      const allies = [createTestGoblin({
        stats: { hp: 9999, atk: 10, agility: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 999 },
      })]
      const enemies: Enemy[][] = [
        [createTestEnemy({ id: 'F', name: '前列', hp: 9999, agility: 1, evasion: 0, atk: 1, accuracy: 1 })],
        [createTestEnemy({ id: 'M', name: '中列', hp: 9999, agility: 1, evasion: 0, atk: 1, accuracy: 1 })],
        [createTestEnemy({ id: 'B', name: '後列', hp: 9999, agility: 1, evasion: 0, atk: 1, accuracy: 1 })],
      ]

      const rng = createSeededRng(seed)
      const battle = new BattleSystem()
      const result = battle.executeBattle(allies, [9999], enemies, rng, 5)

      for (const log of result.detailedLog) {
        if (log.action === '通常攻撃' && log.isAlly) {
          for (const target of log.targets) {
            damageByName[target.targetName] = (damageByName[target.targetName] ?? 0) + target.totalDamage
          }
        }
      }
    }

    // 3列: 1/2, 1/4, 1/4 → 前列が最もダメージを受ける
    expect(damageByName['Lv1 前列']).toBeGreaterThan(damageByName['Lv1 中列'])
    expect(damageByName['Lv1 前列']).toBeGreaterThan(damageByName['Lv1 後列'])
  })
})
