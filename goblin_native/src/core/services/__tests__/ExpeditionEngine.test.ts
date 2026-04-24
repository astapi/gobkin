import { ExpeditionEngine } from '../ExpeditionEngine'
import { DEFAULT_PARTY_REWARD_MULTIPLIERS, DUNGEON_TIER_SCALING, getDungeonTierAreaLevel } from '../../../shared/types'
import type { DungeonTier, Enemy, TimelineEvent, PartyState } from '../../../shared/types'

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
        attackCount: 1,
        accuracy: 10,
        evasion: 5,
        magicHeal: 5,
        isKO: false,
        isDead: false,
        mods: [],
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
        attackCount: 1,
        accuracy: 10,
        evasion: 5,
        magicHeal: 5,
        isKO: true,
        isDead: true,
        mods: [],
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
      { level: 28, exp: 200, gold: 2800, atk: 340, accuracy: 284, attackCount: 7, evasion: 1800, magicDef: 8000 },
      { level: 45, exp: 316, gold: 5560, atk: 537, accuracy: 449, attackCount: 8, evasion: 2844, magicDef: 12640 },
      { level: 61, exp: 420, gold: 8520, atk: 714, accuracy: 596, attackCount: 10, evasion: 3780, magicDef: 16800 },
      { level: 83, exp: 550, gold: 12769, atk: 935, accuracy: 781, attackCount: 11, evasion: 4950, magicDef: 22000 },
      { level: 109, exp: 700, gold: 18334, atk: 1190, accuracy: 994, attackCount: 13, evasion: 12600, magicDef: 56000 },
      { level: 164, exp: 1000, gold: 31304, atk: 1700, accuracy: 1420, attackCount: 15, evasion: 18000, magicDef: 80000 },
    ]

    DUNGEON_TIER_SCALING.forEach((scaling, index) => {
      const [[scaled]] = (engine as any).applyTierScaling([[baseEnemy]], scaling)
      expect({
        level: scaled.level,
        exp: scaled.exp,
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
        expect(scaled.penetrationResistancePercent).toBe(100)
        expect(scaled.criticalResistancePercent).toBe(50)
        return scaled
      })

      expect(scaledByTier.map(enemy => enemy.hp)).toEqual(expected.hp)
      expect(scaledByTier.map(enemy => enemy.def)).toEqual(expected.def)
      expect(scaledByTier.map(enemy => enemy.evasion)).toEqual(expected.evasion)
      expect(scaledByTier.map(enemy => enemy.magicDef)).toEqual(expected.magicDef)
    })
  })
})

describe('ExpeditionEngine enemy XP rewards', () => {
  it('敵ごとのexp合計を戦闘経験値として扱う', () => {
    const engine = new ExpeditionEngine(1)
    const enemies: Enemy[][] = [
      [
        {
          id: 'slime-a',
          name: 'スライムA',
          raceTags: ['slime'],
          level: 1,
          hp: 4,
          baseAttributes: { power: 2, wisdom: 2, spirit: 2, vitality: 2, agility: 6, luck: 2 },
          atk: 2,
          def: 1,
          attackCount: 1,
          accuracy: 70,
          evasion: 9,
          exp: 1,
          gold: 1,
        },
        {
          id: 'slime-b',
          name: 'スライムB',
          raceTags: ['slime'],
          level: 1,
          hp: 4,
          baseAttributes: { power: 2, wisdom: 2, spirit: 2, vitality: 2, agility: 6, luck: 2 },
          atk: 2,
          def: 1,
          attackCount: 1,
          accuracy: 70,
          evasion: 9,
          exp: 1,
          gold: 1,
        },
      ],
      [
        {
          id: 'boss-slime',
          name: 'ボススライム',
          raceTags: ['slime'],
          level: 3,
          hp: 20,
          baseAttributes: { power: 3, wisdom: 3, spirit: 3, vitality: 3, agility: 8, luck: 3 },
          atk: 3,
          def: 2,
          attackCount: 1,
          accuracy: 100,
          evasion: 11,
          exp: 5,
          gold: 5,
        },
      ],
    ]

    expect((engine as any).calculateEnemyXp(enemies)).toBe(7)
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
