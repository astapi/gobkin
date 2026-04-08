import { ExpeditionEngine } from '../ExpeditionEngine'
import { DEFAULT_PARTY_REWARD_MULTIPLIERS } from '../../../shared/types'
import type { TimelineEvent, PartyState } from '../../../shared/types'

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
        spd: 5,
        sp: 5,
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

    expect(summary.goldGained).toBe(52)
  })
})
