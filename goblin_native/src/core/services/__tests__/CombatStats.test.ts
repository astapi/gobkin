import { GoblinBirthService } from '../GoblinBirthService'
import { ModStatCalculator } from '../ModStatCalculator'
import { BattleSystem, getDamageModifier, getAccuracyModifier, getRowWeight, selectTarget } from '../BattleSystem'
import { ExpeditionEngine } from '../ExpeditionEngine'
import { getDefaultSkillsForRace } from '../../../shared/data/raceSkills'
import { getBloodlineCombatStats } from '../../../shared/data/equipmentConfig'
import { EquipmentService } from '../EquipmentService'
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

/**
 * テスト用の最小限の敵を作成
 */
function createTestEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: 'E_TEST',
    name: 'テスト敵',
    raceTags: ['beast'],
    level: 1,
    hp: 30,
    atk: 5,
    def: 5,
    spd: 5,
    sp: 0,
    attackCount: 1,
    accuracy: 20,
    evasion: 10,
    exp: 10,
    gold: 10,
    ...overrides,
  }
}

// =========================================================================
// getDamageModifier / getAccuracyModifier
// =========================================================================
describe('getDamageModifier', () => {
  it('1回目は1.0', () => {
    expect(getDamageModifier(1)).toBe(1.0)
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

// =========================================================================
// 血統別戦闘ステータス初期値
// =========================================================================
describe('getBloodlineCombatStats', () => {
  it('ゴブリンの攻撃回数は2', () => {
    const stats = getBloodlineCombatStats('ゴブリン')
    expect(stats.attackCount).toBe(2)
  })

  it('ウルフゴブリンの攻撃回数は3', () => {
    const stats = getBloodlineCombatStats('ウルフゴブリン')
    expect(stats.attackCount).toBe(3)
  })

  it('スライムゴブリンの攻撃回数は2', () => {
    const stats = getBloodlineCombatStats('スライムゴブリン')
    expect(stats.attackCount).toBe(2)
  })

  it('オークゴブリンの攻撃回数は2', () => {
    const stats = getBloodlineCombatStats('オークゴブリン')
    expect(stats.attackCount).toBe(2)
  })

  it('ホブゴブリンの攻撃回数は2', () => {
    const stats = getBloodlineCombatStats('ホブゴブリン')
    expect(stats.attackCount).toBe(2)
  })

  it('未定義血統はデフォルト値を返す', () => {
    const stats = getBloodlineCombatStats('未知の血統')
    expect(stats.attackCount).toBe(2)
    expect(stats.accuracy).toBe(20)
    expect(stats.evasion).toBe(15)
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

  it('ゴブリンのattackCountは血統初期値2', () => {
    const rng = createSeededRng(200)
    const service = new GoblinBirthService(rng)
    const goblin = service.createNewGoblin(1)

    expect(goblin.race).toBe('ゴブリン')
    expect(goblin.stats.attackCount).toBe(2)
  })

  it('accuracyは120〜200の範囲に収まる', () => {
    for (let i = 0; i < 100; i++) {
      const rng = createSeededRng(i * 7)
      const service = new GoblinBirthService(rng)
      const goblin = service.createNewGoblin(i)

      expect(goblin.stats.accuracy).toBeGreaterThanOrEqual(120)
      expect(goblin.stats.accuracy).toBeLessThanOrEqual(200)
    }
  })

  it('evasionは10〜20の範囲に収まる', () => {
    for (let i = 0; i < 100; i++) {
      const rng = createSeededRng(i * 11)
      const service = new GoblinBirthService(rng)
      const goblin = service.createNewGoblin(i)

      expect(goblin.stats.evasion).toBeGreaterThanOrEqual(10)
      expect(goblin.stats.evasion).toBeLessThanOrEqual(20)
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
// ModStatCalculator — 新ステータスの計算
// =========================================================================
describe('ModStatCalculator — 戦闘ステータス計算', () => {
  it('基本ステータスがそのまま反映される（Mod/因子/装備なし）', () => {
    const goblin = createTestGoblin()
    const result = ModStatCalculator.calculate(goblin)

    expect(result.attackCount).toBe(2)
    expect(result.accuracy).toBe(20)
    expect(result.evasion).toBe(15)
  })

  it('装備のaccuracy_flatが加算される', () => {
    const goblin = createTestGoblin()
    const bonuses = [{ stat: 'accuracy_flat' as const, value: 10 }]
    const result = ModStatCalculator.calculate(goblin, bonuses)

    expect(result.accuracy).toBe(30)
  })

  it('装備のevasion_flatが加算される', () => {
    const goblin = createTestGoblin()
    const bonuses = [{ stat: 'evasion_flat' as const, value: 5 }]
    const result = ModStatCalculator.calculate(goblin, bonuses)

    expect(result.evasion).toBe(20)
  })

  it('装備のattackCount_flatが加算される', () => {
    const goblin = createTestGoblin()
    const bonuses = [{ stat: 'attackCount_flat' as const, value: 1 }]
    const result = ModStatCalculator.calculate(goblin, bonuses)

    expect(result.attackCount).toBe(3)
  })

  it('装備の%ボーナスが乗算される', () => {
    const goblin = createTestGoblin({
      stats: { hp: 60, atk: 12, sp: 10, spd: 10, def: 10, attackCount: 2, accuracy: 100, evasion: 100 },
    })
    const bonuses = [
      { stat: 'accuracy_percent' as const, value: 50 },
      { stat: 'evasion_percent' as const, value: 30 },
    ]
    const result = ModStatCalculator.calculate(goblin, bonuses)

    expect(result.accuracy).toBe(150)  // 100 * 1.5
    expect(result.evasion).toBe(130)   // 100 * 1.3
  })

  it('ウルフゴブリンは攻撃回数が+2される', () => {
    const goblin = createTestGoblin({
      race: 'ウルフゴブリン',
      stats: { hp: 60, atk: 12, sp: 10, spd: 10, def: 10, attackCount: 3, accuracy: 20, evasion: 15 },
    })
    const result = ModStatCalculator.calculate(goblin)

    expect(result.attackCount).toBe(5)
  })

  it('スライムゴブリンは鎧の能力値が1.3倍になる', () => {
    const goblin = createTestGoblin({ race: 'スライムゴブリン' })
    const result = ModStatCalculator.calculate(goblin, [
      { stat: 'def_flat', value: 10, sourceCategory: 'armor' },
    ])

    expect(result.def).toBe(23)
  })

  it('ウルフゴブリンは装備の命中精度補正が2倍になる', () => {
    const goblin = createTestGoblin({ race: 'ウルフゴブリン' })
    const result = ModStatCalculator.calculate(goblin, [
      { stat: 'accuracy_flat', value: 10, sourceCategory: 'weapon' },
    ])

    expect(result.accuracy).toBe(40)
  })

  it('EquipmentServiceは装備カテゴリをボーナスへ保持する', () => {
    const bonuses = EquipmentService.calculateEquipmentBonuses([
      { id: 'eq1', templateId: 'sword_cypress_stick', slotIndex: 0, goblinId: 1 },
    ])

    expect(bonuses[0].sourceCategory).toBe('weapon')
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

  it('EquipmentServiceは爪装備に応じた攻撃回数スキルを付与・解除する', () => {
    const goblin = createTestGoblin({ skills: [] })
    const equipment = { id: 'eq1', templateId: 'claw_kaiser', slotIndex: -1, goblinId: null }

    const equipResult = EquipmentService.equip(goblin, equipment, 0, [])

    expect(equipResult.success).toBe(true)
    expect(goblin.skills.some((skill) => skill.statBonuses?.attackCount === 8)).toBe(true)

    EquipmentService.unequip(equipment, goblin)

    expect(goblin.skills.some((skill) => skill.statBonuses?.attackCount === 8)).toBe(false)
  })
})

// =========================================================================
// BattleSystem — 命中判定と複数回攻撃（集約ログ）
// =========================================================================
describe('BattleSystem — 命中判定と複数回攻撃', () => {
  it('攻撃回数3の場合、1つのログエントリにまとまる', () => {
    const allies = [createTestGoblin({
      stats: { hp: 100, atk: 50, sp: 10, spd: 100, def: 10, attackCount: 3, accuracy: 999, evasion: 10 },
    })]
    const enemies = [[createTestEnemy({ hp: 9999, spd: 1, evasion: 0 })]]

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
      stats: { hp: 100, atk: 50, sp: 10, spd: 100, def: 10, attackCount: 3, accuracy: 999, evasion: 10 },
    })]
    const enemies = [[createTestEnemy({ hp: 9999, spd: 1, evasion: 0 })]]

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

  it('命中精度0・回避極大でほぼ全ミスになる', () => {
    const allies = [createTestGoblin({
      stats: { hp: 100, atk: 50, sp: 10, spd: 100, def: 10, attackCount: 1, accuracy: 0, evasion: 10 },
    })]
    const enemies = [[createTestEnemy({ hp: 9999, spd: 1, evasion: 999 })]]

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
      stats: { hp: 100, atk: 50, sp: 10, spd: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 10 },
    })]
    const enemies = [[createTestEnemy({ hp: 9999, spd: 1, evasion: 0 })]]

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
      stats: { hp: 100, atk: 50, sp: 10, spd: 100, def: 10, attackCount: 1, accuracy: 0, evasion: 10 },
    })]
    const enemies = [[createTestEnemy({ hp: 9999, spd: 1, evasion: 999 })]]

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
      stats: { hp: 9999, atk: 5, sp: 10, spd: 1, def: 10, attackCount: 1, accuracy: 20, evasion: 0 },
    })]
    const enemies = [[createTestEnemy({ hp: 9999, spd: 100, attackCount: 3, accuracy: 999, evasion: 10 })]]

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
    const statsBase = { hp: 100, atk: 5, sp: 10, spd: 1, def: 10, attackCount: 1, accuracy: 20, evasion: 30 }

    // 全快ケース
    let hitCountFull = 0
    let totalFull = 0
    for (let seed = 0; seed < 50; seed++) {
      const allies = [createTestGoblin({ stats: statsBase })]
      const enemies = [[createTestEnemy({ hp: 9999, spd: 100, attackCount: 1, accuracy: 30, evasion: 0 })]]
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
      const enemies = [[createTestEnemy({ hp: 9999, spd: 100, attackCount: 1, accuracy: 30, evasion: 0 })]]
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
      stats: { hp: 100, atk: 50, sp: 10, spd: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 10 },
    })]
    const enemies = [[createTestEnemy({ hp: 9999, spd: 1, evasion: 0 })]]

    const rng = createSeededRng(42)
    const battle = new BattleSystem()
    const result = battle.executeBattle(allies, [100], enemies, rng, 1)

    const allyLog = result.detailedLog.find(log => log.action === '通常攻撃' && log.isAlly)!
    expect(allyLog.actorRow).toBe(1) // 最初の味方は列1（1-based）
  })

  it('ターゲットのtargetRowが正しく記録される', () => {
    const allies = [createTestGoblin({
      stats: { hp: 100, atk: 50, sp: 10, spd: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 10 },
    })]
    const enemies = [
      [createTestEnemy({ id: 'E1', name: '前列敵', hp: 9999, spd: 1, evasion: 0 })],
      [createTestEnemy({ id: 'E2', name: '後列敵', hp: 9999, spd: 1, evasion: 0 })],
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

  it('ウルフゴブリンの追加ダメージは通常攻撃へ固定値で加算される', () => {
    const enemies = [[createTestEnemy({ hp: 9999, spd: 1, evasion: 0, def: 0 })]]
    const rngA = createSeededRng(42)
    const rngB = createSeededRng(42)

    const normalResult = new BattleSystem().executeBattle([
      createTestGoblin({
        race: 'ゴブリン',
        stats: { hp: 100, atk: 50, sp: 10, spd: 100, def: 10, attackCount: 3, accuracy: 999, evasion: 10 },
      }),
    ], [100], enemies, rngA, 1)
    const wolfResult = new BattleSystem().executeBattle([
      createTestGoblin({
        race: 'ウルフゴブリン',
        stats: { hp: 100, atk: 50, sp: 10, spd: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 10 },
      }),
    ], [100], [[createTestEnemy({ hp: 9999, spd: 1, evasion: 0, def: 0 })]], rngB, 1)

    const normalLog = normalResult.detailedLog.find(log => log.action === '通常攻撃' && log.isAlly)!
    const wolfLog = wolfResult.detailedLog.find(log => log.action === '通常攻撃' && log.isAlly)!
    const normalDamage = normalLog.targets[0].totalDamage
    const wolfDamage = wolfLog.targets[0].totalDamage

    expect(wolfLog.hitCount).toBe(normalLog.hitCount)
    expect(wolfDamage - normalDamage).toBe(13 * wolfLog.hitCount)
  })

  it('スライムゴブリンより後列の仲間は通常攻撃ダメージが軽減される', () => {
    const protectedAllies = [
      createTestGoblin({
        id: 1,
        race: 'スライムゴブリン',
        stats: { hp: 9999, atk: 1, sp: 10, spd: 10, def: 0, attackCount: 1, accuracy: 1, evasion: 0 },
      }),
      createTestGoblin({
        id: 2,
        race: 'ゴブリン',
        stats: { hp: 9999, atk: 1, sp: 10, spd: 1, def: 0, attackCount: 1, accuracy: 1, evasion: 0 },
      }),
    ]
    const plainAllies = [
      createTestGoblin({
        id: 1,
        race: 'ゴブリン',
        stats: { hp: 9999, atk: 1, sp: 10, spd: 10, def: 0, attackCount: 1, accuracy: 1, evasion: 0 },
      }),
      createTestGoblin({
        id: 2,
        race: 'ゴブリン',
        stats: { hp: 9999, atk: 1, sp: 10, spd: 1, def: 0, attackCount: 1, accuracy: 1, evasion: 0 },
      }),
    ]
    const enemies = [[createTestEnemy({
      hp: 9999,
      atk: 90,
      def: 0,
      spd: 100,
      attackCount: 20,
      accuracy: 999,
      evasion: 0,
    })]]

    const protectedResult = new BattleSystem().executeBattle(protectedAllies, [9999, 9999], enemies, createSeededRng(7), 1)
    const plainResult = new BattleSystem().executeBattle(plainAllies, [9999, 9999], [[createTestEnemy({
      hp: 9999,
      atk: 90,
      def: 0,
      spd: 100,
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
        spd: 10,
        sp: 10,
        attackCount: 1,
        accuracy: 1,
        evasion: 0,
        isKO: false,
        isDead: false,
        mods: [],
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
        spd: 1,
        sp: 10,
        attackCount: 1,
        accuracy: 1,
        evasion: 0,
        isKO: false,
        isDead: false,
        mods: [],
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
      spd: 100,
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
      spd: 100,
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
        skills: [{ id: 'physical_reduction_10', name: '[-10%] 物理ダメージ軽減(%)', physicalDamageReductionPercent: 10 }],
        stats: { hp: 9999, atk: 1, sp: 10, spd: 1, def: 0, attackCount: 1, accuracy: 1, evasion: 0 },
      }),
    ]
    const plainAllies = [
      createTestGoblin({
        id: 1,
        skills: [],
        stats: { hp: 9999, atk: 1, sp: 10, spd: 1, def: 0, attackCount: 1, accuracy: 1, evasion: 0 },
      }),
    ]
    const enemy = [[createTestEnemy({
      hp: 9999,
      atk: 100,
      def: 0,
      spd: 100,
      attackCount: 1,
      accuracy: 999,
      evasion: 0,
    })]]

    const reducedResult = new BattleSystem().executeBattle(reducedAllies, [9999], enemy, createSeededRng(11), 1)
    const plainResult = new BattleSystem().executeBattle(plainAllies, [9999], [[createTestEnemy({
      hp: 9999,
      atk: 100,
      def: 0,
      spd: 100,
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
        skills: [{ id: 'physical_reduction_10', name: '[-10%] 物理ダメージ軽減(%)', physicalDamageReductionPercent: 10 }],
        stats: { hp: 9999, atk: 1, sp: 10, spd: 1, def: 0, attackCount: 1, accuracy: 1, evasion: 0 },
      }),
    ]
    const plainAllies = [
      createTestGoblin({
        id: 1,
        skills: [],
        stats: { hp: 9999, atk: 1, sp: 10, spd: 1, def: 0, attackCount: 1, accuracy: 1, evasion: 0 },
      }),
    ]
    const caster = [[createTestEnemy({
      hp: 9999,
      atk: 100,
      def: 0,
      spd: 100,
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
      spd: 100,
      attackCount: 1,
      accuracy: 999,
      evasion: 0,
      spells: [{ spellId: 'magic_arrow' }],
    })]], createSeededRng(17), 1)

    const reducedDamage = reducedResult.detailedLog.find((log) => log.action === 'マジックアロー' && !log.isAlly)!.targets[0].totalDamage
    const plainDamage = plainResult.detailedLog.find((log) => log.action === 'マジックアロー' && !log.isAlly)!.targets[0].totalDamage

    expect(reducedDamage).toBe(plainDamage)
  })
})

// =========================================================================
// 隊列システム — getRowWeight
// =========================================================================
describe('getRowWeight', () => {
  it('1列のみの場合は重み1', () => {
    expect(getRowWeight(0, 1)).toBe(1)
  })

  it('2列: 1列目=1/2, 2列目=1/2（最後2列同率）', () => {
    expect(getRowWeight(0, 2)).toBe(0.5)
    expect(getRowWeight(1, 2)).toBe(0.5)
  })

  it('3列: 1列目=1/2, 2列目=1/4, 3列目=1/4', () => {
    expect(getRowWeight(0, 3)).toBe(0.5)
    expect(getRowWeight(1, 3)).toBe(0.25)
    expect(getRowWeight(2, 3)).toBe(0.25)
  })

  it('6列: 1/2, 1/4, 1/8, 1/16, 1/32, 1/32', () => {
    expect(getRowWeight(0, 6)).toBe(0.5)
    expect(getRowWeight(1, 6)).toBe(0.25)
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
      spd: 10,
      attackCount: 1,
      accuracy: 20,
      evasion: 10,
      isAlly: false,
      originalIndex: 0,
      damageReduction: 0,
      physicalDamageReduction: 0,
      row,
      rowSlot,
      level: 1,
      spellCharges: [],
      skills: [],
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

    // 2列の場合、前列=1/2, 後列=1/2（最後2列同率）なので均等に近いが
    // 実際は列が2つなので最後2列ルールで同率
    // → 50%ずつ（±5%の誤差許容）
    expect(counts['前列'] / 10000).toBeGreaterThan(0.4)
    expect(counts['後列'] / 10000).toBeGreaterThan(0.4)
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

    // 列内2体: slot0=1/2, slot1=1/2（最後2列同率ルール適用）
    // → 両方50%ずつ
    expect(counts['A'] / 10000).toBeGreaterThan(0.4)
    expect(counts['B'] / 10000).toBeGreaterThan(0.4)
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

    // 2列で最後2列同率 → 均等
    expect(counts['列1ユニット'] / 10000).toBeGreaterThan(0.4)
    expect(counts['列2ユニット'] / 10000).toBeGreaterThan(0.4)
  })

  it('4列の分布: 1/2, 1/4, 1/8, 1/8', () => {
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

    // R0≈50%, R1≈25%, R2≈12.5%, R3≈12.5%
    expect(counts.R0 / N).toBeGreaterThan(0.43)
    expect(counts.R0 / N).toBeLessThan(0.57)
    expect(counts.R1 / N).toBeGreaterThan(0.19)
    expect(counts.R1 / N).toBeLessThan(0.31)
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
      spd: 100,
      attackCount: 0,
      skills: [
        { id: 'fireball', name: 'ファイヤーボール', grantsSpellId: 'fireball' },
      ],
    })
    const allyA = createTestGoblin({
      id: 1,
      name: '前衛A',
      stats: { hp: 120, atk: 10, sp: 0, spd: 1, def: 10, attackCount: 1, accuracy: 20, evasion: 0 },
    })
    const allyB = createTestGoblin({
      id: 2,
      name: '前衛B',
      stats: { hp: 120, atk: 10, sp: 0, spd: 1, def: 10, attackCount: 1, accuracy: 20, evasion: 0 },
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
      stats: { hp: 120, atk: 40, sp: 0, spd: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 0 },
    })
    const enemyA = createTestEnemy({
      id: 'ORC002',
      name: 'オーク兵',
      hp: 60,
      def: 1,
      spd: 1,
      evasion: 0,
    })
    const enemyB = createTestEnemy({
      id: 'ORC002',
      name: 'オーク兵',
      hp: 60,
      def: 1,
      spd: 1,
      evasion: 0,
    })

    const result = battleSystem.executeBattle([attacker], [attacker.stats.hp], [[enemyA, enemyB]], createSeededRng(1), 1)
    const turnStartLog = result.detailedLog.find(log => log.action === 'turn_start')
    const attackLog = result.detailedLog.find(log => log.actorId === '1' && log.action === '通常攻撃')

    expect(turnStartLog?.turnState?.enemies.map(enemy => enemy.name)).toEqual(['オーク兵A', 'オーク兵B'])
    expect(attackLog?.targets[0]?.targetName).toBe('オーク兵A')
  })

  it('ファイヤーボール2回は1戦闘で2回使える', () => {
    const battleSystem = new BattleSystem()
    const ally = createTestGoblin({
      level: 20,
      stats: { hp: 400, atk: 12, sp: 10, spd: 1, def: 10, attackCount: 1, accuracy: 20, evasion: 15 },
    })
    const enemy = createTestEnemy({
      id: 'B_LICH_TEST',
      name: '死霊術師の残骸テスト',
      level: 11,
      hp: 999,
      atk: 1,
      def: 1,
      spd: 50,
      attackCount: 0,
      skills: [
        { id: 'fireball', name: 'ファイヤーボール', grantsSpellId: 'fireball' },
        { id: 'fireball_twice', name: 'ファイヤーボール2回', spellChargeBonusForId: 'fireball', extraSpellCharges: 1 },
      ],
    })

    const result = battleSystem.executeBattle([ally], [ally.stats.hp], [[enemy]], createSeededRng(42), 3)
    const spellLogs = result.detailedLog.filter(log => log.actorId === 'B_LICH_TEST' && log.action === 'ファイヤーボール')

    expect(spellLogs).toHaveLength(2)
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
      spd: 50,
      attackCount: 0,
      skills: [
        { id: 'blizzard', name: 'ブリザード', grantsSpellId: 'blizzard' },
      ],
    })
    const ally = createTestGoblin({
      stats: { hp: 400, atk: 12, sp: 10, spd: 1, def: 10, attackCount: 1, accuracy: 20, evasion: 15 },
    })

    const result = battleSystem.executeBattle([ally], [ally.stats.hp], [[enemy]], createSeededRng(7), 2)
    const spellLogs = result.detailedLog.filter(log => log.actorId === 'ICE_MAGE' && log.action === 'ブリザード')

    expect(spellLogs).toHaveLength(1)
  })
})

describe('BattleSystem — ジョブ系スキル', () => {
  it('かばう持ちはHP半分以下の後列への通常攻撃を肩代わりする', () => {
    const battleSystem = new BattleSystem()
    const guard = createTestGoblin({
      id: 1,
      skills: [{ id: 'cover', name: 'かばう', coverLowHpAlly: true }],
      stats: { hp: 120, atk: 5, sp: 0, spd: 20, def: 20, attackCount: 1, accuracy: 999, evasion: 0 },
    })
    const rear = createTestGoblin({
      id: 2,
      name: '後衛',
      stats: { hp: 100, atk: 5, sp: 0, spd: 10, def: 5, attackCount: 1, accuracy: 0, evasion: 0 },
    })
    const enemy = createTestEnemy({
      atk: 50,
      spd: 100,
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
      stats: { hp: 120, atk: 5, sp: 0, spd: 20, def: 20, attackCount: 1, accuracy: 999, evasion: 0 },
      skills: [{ id: 'inspire', name: '鼓舞', rearAllyDamageMultiplier: 1.5 }],
    })
    const attacker = createTestGoblin({
      id: 2,
      name: '後衛',
      stats: { hp: 100, atk: 40, sp: 0, spd: 100, def: 5, attackCount: 1, accuracy: 999, evasion: 0 },
      skills: [],
    })
    const enemy = createTestEnemy({ hp: 200, def: 1, evasion: 0, spd: 1 })

    const result = battleSystem.executeBattle([warrior, attacker], [warrior.stats.hp, attacker.stats.hp], [[enemy]], createSeededRng(1), 1)
    const attackerLog = result.detailedLog.find(log => log.actorId === String(attacker.id) && log.action === '通常攻撃')

    expect((attackerLog?.targets[0]?.totalDamage ?? 0)).toBeGreaterThan(50)
  })
})

// =========================================================================
// 隊列システム — BattleSystem統合テスト
// =========================================================================
describe('BattleSystem — 隊列統合テスト', () => {
  it('2D敵配列で戦闘が正常に実行される', () => {
    const allies = [createTestGoblin({
      stats: { hp: 100, atk: 50, sp: 10, spd: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 10 },
    })]
    // 2列の敵: 列0=[敵A], 列1=[敵B]
    const enemies: Enemy[][] = [
      [createTestEnemy({ id: 'EA', name: '敵A', hp: 50, spd: 1, evasion: 0 })],
      [createTestEnemy({ id: 'EB', name: '敵B', hp: 50, spd: 1, evasion: 0 })],
    ]

    const rng = createSeededRng(42)
    const battle = new BattleSystem()
    const result = battle.executeBattle(allies, [100], enemies, rng, 10)

    expect(result.outcome).toBe('win')
  })

  it('同一列に複数敵を配置して戦闘が正常に動作する', () => {
    const allies = [createTestGoblin({
      stats: { hp: 200, atk: 50, sp: 10, spd: 100, def: 10, attackCount: 2, accuracy: 999, evasion: 10 },
    })]
    // 列0に2体の敵
    const enemies: Enemy[][] = [
      [
        createTestEnemy({ id: 'EA', name: '敵A', hp: 30, spd: 1, evasion: 0 }),
        createTestEnemy({ id: 'EB', name: '敵B', hp: 30, spd: 1, evasion: 0 }),
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
    const damageByName: Record<string, number> = { '前列': 0, '中列': 0, '後列': 0 }

    for (let seed = 0; seed < 100; seed++) {
      const allies = [createTestGoblin({
        stats: { hp: 9999, atk: 10, sp: 10, spd: 100, def: 10, attackCount: 1, accuracy: 999, evasion: 999 },
      })]
      const enemies: Enemy[][] = [
        [createTestEnemy({ id: 'F', name: '前列', hp: 9999, spd: 1, evasion: 0, atk: 1, accuracy: 1 })],
        [createTestEnemy({ id: 'M', name: '中列', hp: 9999, spd: 1, evasion: 0, atk: 1, accuracy: 1 })],
        [createTestEnemy({ id: 'B', name: '後列', hp: 9999, spd: 1, evasion: 0, atk: 1, accuracy: 1 })],
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
    expect(damageByName['前列']).toBeGreaterThan(damageByName['中列'])
    expect(damageByName['前列']).toBeGreaterThan(damageByName['後列'])
  })
})
