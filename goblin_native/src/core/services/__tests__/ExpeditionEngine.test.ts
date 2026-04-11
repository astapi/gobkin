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
        def: 5,
        agility: 5,
        attackCount: 1,
        accuracy: 10,
        evasion: 5,
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
        def: 5,
        agility: 5,
        attackCount: 1,
        accuracy: 10,
        evasion: 5,
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
    atk: 340,
    def: 20,
    magicDef: 8000,
    agility: 10,
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
      { level: 109, exp: 700, gold: 18334, atk: 1190, accuracy: 994, attackCount: 13, evasion: 8050, magicDef: 29750 },
      { level: 164, exp: 1000, gold: 31304, atk: 1700, accuracy: 1420, attackCount: 15, evasion: 14000, magicDef: 45000 },
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

  it('防御系ステータスと耐性も提示表どおりにスケールする', () => {
    const engine = new ExpeditionEngine(1)
    const defensiveEnemy: Enemy = {
      ...baseEnemy,
      hp: 65315,
      def: 2500,
      evasion: 1800,
      magicDef: 8000,
    }
    const expected = [
      { hp: 65315, def: 2500, evasion: 1800, magicDef: 8000, physicalResistancePercent: 44.2, magicResistancePercent: 42.5 },
      { hp: 163177, def: 3950, evasion: 2844, magicDef: 12640, physicalResistancePercent: 38.0, magicResistancePercent: 36.5 },
      { hp: 288480, def: 5250, evasion: 3780, magicDef: 16800, physicalResistancePercent: 32.7, magicResistancePercent: 34.8 },
      { hp: 495759, def: 6875, evasion: 4950, magicDef: 22000, physicalResistancePercent: 28.3, magicResistancePercent: 33.1 },
      { hp: 805008, def: 11550, evasion: 8050, magicDef: 29750, physicalResistancePercent: 24.3, magicResistancePercent: 31.4 },
      { hp: 1657875, def: 22500, evasion: 14000, magicDef: 45000, physicalResistancePercent: 21.2, magicResistancePercent: 29.7 },
    ]

    DUNGEON_TIER_SCALING.forEach((scaling, index) => {
      const [[scaled]] = (engine as any).applyTierScaling([[defensiveEnemy]], scaling)
      expect({
        hp: scaled.hp,
        def: scaled.def,
        evasion: scaled.evasion,
        magicDef: scaled.magicDef,
        physicalResistancePercent: scaled.physicalResistancePercent,
        magicResistancePercent: scaled.magicResistancePercent,
      }).toEqual(expected[index])
      expect(scaled.penetrationResistancePercent).toBe(100)
      expect(scaled.criticalResistancePercent).toBe(50)
    })
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
