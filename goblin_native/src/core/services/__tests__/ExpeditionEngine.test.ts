import { ExpeditionEngine } from '../ExpeditionEngine'
import { DEFAULT_PARTY_REWARD_MULTIPLIERS, DUNGEON_TIER_SCALING, getDungeonTierAreaLevel } from '../../../shared/types'
import type { CharacterSkill, DungeonTier, Enemy, Goblin, TimelineEvent, PartyState } from '../../../shared/types'
import {
  getMagicDamageReductionFromSkills,
  getPhysicalDamageReductionFromSkills,
} from '../../../shared/data/characterSkills'

describe('ExpeditionEngine reward multipliers', () => {
  it('goldMultiplier を報酬 gold に適用する', () => {
    const engine = new ExpeditionEngine(1)
    const events: TimelineEvent[] = [
      { type: 'move_start', at: 0, floor: 1 },
      {
        type: 'battle',
        at: 10,
        floor: 1,
        enemy: { id: 'e1', name: '敵1', lvl: 1, count: 1, gold: 10 },
        combat: { rounds: 1, outcome: 'win', allyHPDelta: [0], enemyDefeated: 1 },
        xp: 5,
      },
      {
        type: 'boss',
        at: 20,
        floor: 2,
        enemy: { id: 'b1', name: 'ボス', lvl: 2, count: 1, gold: 25 },
        combat: { rounds: 2, outcome: 'win', allyHPDelta: [0], enemyDefeated: 1 },
        xp: 20,
      },
      { type: 'return', at: 30, reason: 'completed' },
    ]
    const partyState: PartyState[] = [
      {
        id: '1',
        name: 'テスト',
        race: 'ゴブリン',
        currentHP: 10,
        maxHP: 10,
        baseHP: 10,
        atk: 5,
        magicAtk: 0,
        def: 5,
        magicDef: 0,
        agility: 5,
        luck: 5,
        attackCount: 1,
        accuracy: 10,
        evasion: 5,
        magicHeal: 5,
        isKO: false,
        isDead: false,
        skills: [],
        factors: [],
        level: 1,
        avatar: 'test.png',
      },
    ]

    const summary = (engine as any).calculateRewardSummary(events, partyState, {
      ...DEFAULT_PARTY_REWARD_MULTIPLIERS,
      gold: 1.5,
    })

    expect(summary.xpGained).toBe(25)
    expect(summary.goldGained).toBe(52)
  })

  it('goldMultiplierBoost を gold 報酬に乗算する（金のドングリ相当）', () => {
    const engine = new ExpeditionEngine(1)
    const events: TimelineEvent[] = [
      { type: 'move_start', at: 0, floor: 1 },
      {
        type: 'battle',
        at: 10,
        floor: 1,
        enemy: { id: 'e1', name: '敵1', lvl: 1, count: 1, gold: 100 },
        combat: { rounds: 1, outcome: 'win', allyHPDelta: [0], enemyDefeated: 1 },
        xp: 5,
      },
      { type: 'return', at: 30, reason: 'completed' },
    ]
    const partyState: PartyState[] = [
      {
        id: '1',
        name: 'テスト',
        race: 'ゴブリン',
        currentHP: 10,
        maxHP: 10,
        baseHP: 10,
        atk: 5,
        magicAtk: 0,
        def: 5,
        magicDef: 0,
        agility: 5,
        luck: 5,
        attackCount: 1,
        accuracy: 10,
        evasion: 5,
        magicHeal: 5,
        isKO: false,
        isDead: false,
        skills: [],
        factors: [],
        level: 1,
        avatar: 'test.png',
      },
    ]

    // boost なし: 100 gold
    const baseline = (engine as any).calculateRewardSummary(
      events,
      partyState,
      DEFAULT_PARTY_REWARD_MULTIPLIERS,
      0,
      1,
    )
    expect(baseline.goldGained).toBe(100)

    // boost = 2.0 → 200 gold
    const boosted = (engine as any).calculateRewardSummary(
      events,
      partyState,
      DEFAULT_PARTY_REWARD_MULTIPLIERS,
      0,
      2.0,
    )
    expect(boosted.goldGained).toBe(200)
    expect(boosted.goldMultiplier).toBeCloseTo(2.0)
  })

  it('敗北した戦闘の経験値を報酬合計に含めない', () => {
    const engine = new ExpeditionEngine(1)
    const events: TimelineEvent[] = [
      { type: 'move_start', at: 0, floor: 1 },
      {
        type: 'battle',
        at: 10,
        floor: 1,
        enemy: { id: 'e1', name: '敵1', lvl: 1, count: 1, gold: 10 },
        combat: { rounds: 1, outcome: 'lose', allyHPDelta: [-10], enemyDefeated: 0 },
        xp: 100,
      },
      { type: 'return', at: 30, reason: 'defeated' },
    ]
    const partyState: PartyState[] = [
      {
        id: '1',
        name: 'テスト',
        race: 'ゴブリン',
        currentHP: 0,
        maxHP: 10,
        baseHP: 10,
        atk: 5,
        magicAtk: 0,
        def: 5,
        magicDef: 0,
        agility: 5,
        luck: 5,
        attackCount: 1,
        accuracy: 10,
        evasion: 5,
        magicHeal: 5,
        isKO: true,
        isDead: true,
        skills: [],
        factors: [],
        level: 1,
        avatar: 'test.png',
      },
    ]

    const summary = (engine as any).calculateRewardSummary(events, partyState)

    expect(summary.xpGained).toBe(0)
  })
})

describe('ExpeditionEngine golden acorn clear encounter', () => {
  const party: Goblin[] = [{
    id: 1,
    name: 'テストゴブリン',
    race: 'ゴブリン',
    level: 20,
    experience: 0,
    avatar: 'test.png',
    stats: {
      hp: 999,
      atk: 999,
      magicAtk: 999,
      def: 999,
      magicDef: 999,
      attackCount: 1,
      accuracy: 999,
      evasion: 999,
      magicHeal: 0,
      criticalRate: 0,
    },
    skills: [],
  }]

  it('金のドングリ使用時に踏破後ラタトスク戦を追加する', async () => {
    const battleSystem = {
      executeBattle: jest.fn(() => ({
        rounds: 1,
        outcome: 'win',
        allyHPDelta: [0],
        enemyDefeated: 1,
        detailedLog: [],
      })),
    }
    const engine = new ExpeditionEngine(1, battleSystem as any)

    const replay = await engine.generateExpedition(
      {
        partyId: '1',
        areaId: 'slime_cave',
        returnPolicy: 'never',
        clientVersion: 'test',
        durationSec: 30,
      },
      party,
      DEFAULT_PARTY_REWARD_MULTIPLIERS,
      { expMultiplier: 2, goldMultiplier: 2, rareDropMultiplier: 2, titleMultiplier: 2 },
    )

    const ratatoskrEvent = replay.events.find(
      (event) => event.type === 'battle' && event.enemy.id === 'golden_acorn_ratatoskr',
    )

    expect(ratatoskrEvent).toEqual(expect.objectContaining({
      floor: 2,
      enemy: expect.objectContaining({
        name: 'ラタトスク',
        lvl: 10,
        gold: 998,
      }),
      xp: 1996,
    }))
    expect(battleSystem.executeBattle).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      [[expect.objectContaining({
        id: 'golden_acorn_ratatoskr',
        hp: 10,
        atk: 10,
        def: 10,
        accuracy: 200,
        evasion: 1000,
        skills: [expect.objectContaining({ magicDamageReductionPercent: 99 })],
      })]],
      expect.any(Function),
    )
    expect(replay.summary.xpGained).toBeGreaterThanOrEqual(1996)
    expect(replay.summary.goldGained).toBeGreaterThanOrEqual(998 * 2)
  })

  it('金のドングリ未使用時はラタトスク戦を追加しない', async () => {
    const battleSystem = {
      executeBattle: jest.fn(() => ({
        rounds: 1,
        outcome: 'win',
        allyHPDelta: [0],
        enemyDefeated: 1,
        detailedLog: [],
      })),
    }
    const engine = new ExpeditionEngine(1, battleSystem as any)

    const replay = await engine.generateExpedition(
      {
        partyId: '1',
        areaId: 'slime_cave',
        returnPolicy: 'never',
        clientVersion: 'test',
        durationSec: 30,
      },
      party,
      DEFAULT_PARTY_REWARD_MULTIPLIERS,
    )

    expect(replay.events.some(
      (event) => (event.type === 'battle' || event.type === 'boss') && event.enemy.id === 'golden_acorn_ratatoskr',
    )).toBe(false)
  })

  it('ラタトスク戦が退却でも踏破扱いを維持する', async () => {
    const battleSystem = {
      executeBattle: jest.fn((_allies, _hp, enemies: Enemy[][]) => {
        const isRatatoskr = enemies.flat().some(enemy => enemy.id === 'golden_acorn_ratatoskr')
        return {
          rounds: isRatatoskr ? 20 : 1,
          outcome: isRatatoskr ? 'retreat' : 'win',
          allyHPDelta: [0],
          enemyDefeated: isRatatoskr ? 0 : 1,
          detailedLog: [],
        }
      }),
    }
    const engine = new ExpeditionEngine(1, battleSystem as any)

    const replay = await engine.generateExpedition(
      {
        partyId: '1',
        areaId: 'slime_cave',
        returnPolicy: 'never',
        clientVersion: 'test',
        durationSec: 30,
      },
      party,
      DEFAULT_PARTY_REWARD_MULTIPLIERS,
      { expMultiplier: 2, goldMultiplier: 2, rareDropMultiplier: 2, titleMultiplier: 2 },
    )

    const ratatoskrEvent = replay.events.find(
      (event) => event.type === 'battle' && event.enemy.id === 'golden_acorn_ratatoskr',
    )
    const returnEvent = replay.events.find(event => event.type === 'return')

    expect(ratatoskrEvent).toEqual(expect.objectContaining({
      combat: expect.objectContaining({ outcome: 'escape' }),
      xp: 0,
    }))
    expect(returnEvent).toEqual(expect.objectContaining({ reason: 'completed' }))
    expect(replay.summary.success).toBe(true)
  })
})

describe('ExpeditionEngine normal battle retreat', () => {
  const party: Goblin[] = [{
    id: 1,
    name: 'テストゴブリン',
    race: 'ゴブリン',
    level: 20,
    experience: 0,
    avatar: 'test.png',
    stats: {
      hp: 999,
      atk: 999,
      magicAtk: 999,
      def: 999,
      magicDef: 999,
      attackCount: 1,
      accuracy: 999,
      evasion: 999,
      magicHeal: 0,
      criticalRate: 0,
    },
    skills: [],
  }]

  it('通常戦闘の20ターン退却は探索を失敗にせず継続する', async () => {
    const battleSystem = {
      executeBattle: jest.fn((_allies, _hp, enemies: Enemy[][]) => {
        const isBoss = enemies.flat().some(enemy => enemy.isBoss === true)
        return {
          rounds: isBoss ? 1 : 20,
          outcome: isBoss ? 'win' : 'retreat',
          allyHPDelta: [0],
          enemyDefeated: isBoss ? 1 : 0,
          detailedLog: [],
        }
      }),
    }
    const engine = new ExpeditionEngine(1, battleSystem as any)

    const replay = await engine.generateExpedition(
      {
        partyId: '1',
        areaId: 'slime_cave',
        returnPolicy: 'never',
        clientVersion: 'test',
        durationSec: 30,
      },
      party,
      DEFAULT_PARTY_REWARD_MULTIPLIERS,
    )

    expect(replay.events.some(
      event => event.type === 'battle' && event.combat.outcome === 'escape',
    )).toBe(true)
    expect(replay.events.some(event => event.type === 'boss')).toBe(true)
    expect(replay.events.find(event => event.type === 'return')).toEqual(
      expect.objectContaining({ reason: 'completed' }),
    )
    expect(replay.summary.success).toBe(true)
  })
})

describe('ExpeditionEngine combat stats', () => {
  it('遠征中の戦闘再構築で effectiveStats を保持する', () => {
    const engine = new ExpeditionEngine(1)
    const partyState: PartyState[] = [
      {
        id: '1',
        name: '装備ゴブリン',
        race: 'ゴブリン',
        currentHP: 100,
        maxHP: 100,
        baseHP: 100,
        atk: 10,
        magicAtk: 10,
        def: 10,
        magicDef: 10,
        agility: 10,
        luck: 10,
        attackCount: 1,
        accuracy: 1000,
        evasion: 10,
        magicHeal: 10,
        effectiveStats: {
          hp: 100,
          atk: 300,
          magicAtk: 10,
          def: 10,
          magicDef: 10,
          attackCount: 1,
          accuracy: 1000,
          evasion: 10,
          magicHeal: 10,
          criticalRate: 0,
        },
        isKO: false,
        isDead: false,
        skills: [],
        factors: [],
        battleActionPolicy: { attackRate: 100, clericMagicRate: 0, mageMagicRate: 0 },
        level: 1,
        avatar: 'test.png',
      },
    ]
    const enemy: Enemy = {
      id: 'dummy',
      name: 'ダミー',
      raceTags: ['beast'],
      level: 1,
      hp: 999,
      baseAttributes: { power: 1, wisdom: 1, spirit: 1, vitality: 1, agility: 1, luck: 1 },
      atk: 0,
      def: 0,
      magicAtk: 0,
      magicDef: 0,
      attackCount: 0,
      accuracy: 0,
      evasion: 0,
      exp: 0,
      gold: 0,
    }

    const combat = (engine as any).resolveCombat(partyState, [[enemy]], { areaLevel: 1 }, false)
    const targetDamage = combat.detailedLog
      .flatMap((log: { targets: Array<{ targetId: string; totalDamage: number }> }) => log.targets)
      .find((target: { targetId: string }) => target.targetId === 'dummy')?.totalDamage

    expect(targetDamage).toBeGreaterThan(100)
  })
})

describe('ExpeditionEngine dungeon tier scaling', () => {
  const baseEnemy: Enemy = {
    id: 'scale-test',
    name: 'スケール確認',
    raceTags: ['beast'],
    level: 28,
    hp: 100,
    baseAttributes: { power: 10, wisdom: 10, spirit: 10, vitality: 10, agility: 10, luck: 10 },
    atk: 340,
    def: 20,
    magicDef: 8000,
    attackCount: 7,
    accuracy: 284,
    evasion: 1800,
    exp: 200,
    gold: 2800,
  }

  it('称号ごとの表と同じ法則で主要ステータスをスケールする', () => {
    const engine = new ExpeditionEngine(1)
    const expected = [
      { level: 28, gold: 2800, atk: 340, accuracy: 284, attackCount: 7, evasion: 1800, magicDef: 8000 },
      { level: 45, gold: 5560, atk: 537, accuracy: 449, attackCount: 8, evasion: 2844, magicDef: 12640 },
      { level: 61, gold: 8520, atk: 714, accuracy: 596, attackCount: 10, evasion: 3780, magicDef: 16800 },
      { level: 83, gold: 12769, atk: 935, accuracy: 781, attackCount: 11, evasion: 4950, magicDef: 22000 },
      { level: 109, gold: 18334, atk: 1190, accuracy: 994, attackCount: 13, evasion: 12600, magicDef: 56000 },
      { level: 164, gold: 31304, atk: 1700, accuracy: 1420, attackCount: 15, evasion: 18000, magicDef: 80000 },
    ]

    DUNGEON_TIER_SCALING.forEach((scaling, index) => {
      const [[scaled]] = (engine as any).applyTierScaling([[baseEnemy]], scaling)
      expect({
        level: scaled.level,
        gold: scaled.gold,
        atk: scaled.atk,
        accuracy: scaled.accuracy,
        attackCount: scaled.attackCount,
        evasion: scaled.evasion,
        magicDef: scaled.magicDef,
      }).toEqual(expected[index])
    })
  })

  it('防御系ステータスを参考データに近い値へスケールする', () => {
    const engine = new ExpeditionEngine(1)
    const cases = [
      {
        enemy: { hp: 205, def: 35, evasion: 76, magicDef: 15 },
        expected: {
          hp: [205, 636, 1345, 3100, 5022, 10250],
          def: [35, 55, 73, 96, 245, 350],
          evasion: [76, 120, 159, 209, 532, 760],
          magicDef: [15, 23, 31, 41, 105, 150],
        },
      },
      {
        enemy: { hp: 10, def: 10, evasion: 10, magicDef: 10 },
        expected: {
          hp: [10, 49, 88, 151, 245, 500],
          def: [10, 16, 21, 28, 70, 100],
          evasion: [10, 16, 21, 28, 70, 100],
          magicDef: [10, 16, 21, 28, 70, 100],
        },
      },
      {
        enemy: { hp: 98, def: 18, evasion: 30, magicDef: 14 },
        expected: {
          hp: [98, 369, 864, 1482, 2401, 4900],
          def: [18, 28, 37, 49, 126, 180],
          evasion: [30, 47, 63, 82, 210, 300],
          magicDef: [14, 22, 29, 38, 98, 140],
        },
      },
    ]

    cases.forEach(({ enemy, expected }) => {
      const scaledByTier = DUNGEON_TIER_SCALING.map((scaling) => {
        const [[scaled]] = (engine as any).applyTierScaling([[{ ...baseEnemy, ...enemy }]], scaling)
        return scaled
      })

      expect(scaledByTier.map(enemy => enemy.hp)).toEqual(expected.hp)
      expect(scaledByTier.map(enemy => enemy.def)).toEqual(expected.def)
      expect(scaledByTier.map(enemy => enemy.evasion)).toEqual(expected.evasion)
      expect(scaledByTier.map(enemy => enemy.magicDef)).toEqual(expected.magicDef)
    })
  })

  it('Tierに応じた攻撃威力・魔法威力・軽減スキルを全敵へ付与する', () => {
    const engine = new ExpeditionEngine(1)
    const expectedSkillIds = [
      [],
      ['physical_damage_58', 'spell_damage_58', 'physical_reduction_14', 'magic_reduction_14'],
      ['physical_damage_110', 'spell_damage_110', 'physical_reduction_18', 'magic_reduction_18'],
      ['physical_damage_175', 'spell_damage_175', 'physical_reduction_22', 'magic_reduction_22'],
      ['physical_damage_250', 'spell_damage_250', 'physical_reduction_26', 'magic_reduction_26'],
      ['physical_damage_400', 'spell_damage_400', 'physical_reduction_30', 'magic_reduction_30'],
    ]

    DUNGEON_TIER_SCALING.forEach((scaling, index) => {
      const [[scaled]] = (engine as any).applyTierScaling([[baseEnemy]], scaling)
      expect((scaled.skills ?? []).map((skill: CharacterSkill) => skill.id)).toEqual(expectedSkillIds[index])
    })
  })

  it('既存の敵スキルを保持したままTierスキルを追加し、軽減を合算する', () => {
    const engine = new ExpeditionEngine(1)
    const enemy: Enemy = {
      ...baseEnemy,
      skills: [
        { id: 'physical_reduction_10', physicalDamageReductionPercent: 10 },
        { id: 'magic_reduction_10', magicDamageReductionPercent: 10 },
      ],
    }

    const [[scaled]] = (engine as any).applyTierScaling([[enemy]], DUNGEON_TIER_SCALING[1])
    const skills = scaled.skills ?? []

    expect(skills.map((skill: CharacterSkill) => skill.id)).toEqual([
      'physical_reduction_10',
      'magic_reduction_10',
      'physical_damage_58',
      'spell_damage_58',
      'physical_reduction_14',
      'magic_reduction_14',
    ])
    expect(getPhysicalDamageReductionFromSkills(skills)).toBe(24)
    expect(getMagicDamageReductionFromSkills(skills)).toBe(24)
  })
})

describe('ExpeditionEngine enemy XP rewards', () => {
  const engine = new ExpeditionEngine(1)
  const enemies: Enemy[][] = [
    [
      {
        id: 'slime-a',
        name: 'スライムA',
        raceTags: ['slime'],
        level: 5,
        hp: 4,
        baseAttributes: { power: 2, wisdom: 2, spirit: 2, vitality: 2, agility: 6, luck: 2 },
        atk: 2,
        def: 1,
        attackCount: 1,
        accuracy: 70,
        evasion: 9,
        gold: 1,
      },
      {
        id: 'human-a',
        name: '人間兵士',
        raceTags: ['human'],
        level: 5,
        hp: 4,
        baseAttributes: { power: 2, wisdom: 2, spirit: 2, vitality: 2, agility: 6, luck: 2 },
        atk: 2,
        def: 1,
        attackCount: 1,
        accuracy: 70,
        evasion: 9,
        gold: 1,
      },
    ],
  ]

  it('通常戦闘ではLv×1.8×種族係数で経験値を算出する', () => {
    // slime(beast) Lv5 → 5*1.8*1.0 = 9
    // human Lv5 → 5*1.8*1.15 = 10.35 → 10
    expect((engine as any).calculateEnemyXp(enemies)).toBe(19)
  })

  it('isBoss=true の敵だけにボス用の基準経験値を使う', () => {
    // slime(beast) Lv5 通常 → 9
    // human Lv5 ボス → 5*9.6*1.15 = 55.2 → 55
    const withBoss: Enemy[][] = [[enemies[0][0], { ...enemies[0][1], isBoss: true }]]
    expect((engine as any).calculateEnemyXp(withBoss)).toBe(9 + 55)
  })

  it('ボスパターンでも随伴敵(isBoss未指定)にはボス係数を乗算しない', () => {
    // 全員 isBoss 無し → 通常計算
    expect((engine as any).calculateEnemyXp(enemies)).toBe(19)
  })

  it('経験値倍率を全敵の合計経験値に適用する', () => {
    expect((engine as any).calculateEnemyXp(enemies, 2)).toBe(38)
  })
})

describe('getDungeonTierAreaLevel', () => {
  it('推奨Lv表の法則でエリアレベルをスケールする', () => {
    const tiers = [0, 1, 2, 3, 4] as DungeonTier[]
    expect(tiers.map(tier => getDungeonTierAreaLevel(12, tier))).toEqual([12, 22, 29, 38, 49])
    expect(tiers.map(tier => getDungeonTierAreaLevel(1, tier))).toEqual([1, 4, 6, 8, 10])
    expect(tiers.map(tier => getDungeonTierAreaLevel(70, tier))).toEqual([70, 113, 151, 198, 252])
  })
})
