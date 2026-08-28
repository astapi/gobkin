import { buildGameAgentObservation } from '../buildGameAgentObservation'
import type {
  BaseState,
  Dungeon,
  ExpeditionRecord,
  Goblin,
  Party,
} from '../../../shared/types'

describe('buildGameAgentObservation', () => {
  it('AIへ公開する状態からseedとreplayを除外する', () => {
    const baseState: BaseState = {
      capacity: 10,
      rank: 1,
      capturedDungeons: [],
      currentMaxParties: 1,
      currentMaxGoblins: 10,
      gold: 100,
    }
    const goblin: Goblin = {
      id: 1,
      name: 'マルク',
      race: 'ゴブリン',
      level: 2,
      experience: 5,
      avatar: 'marku',
      stats: {
        hp: 20,
        atk: 5,
        magicAtk: 1,
        def: 3,
        magicDef: 2,
        attackCount: 2,
        accuracy: 100,
        evasion: 0,
        magicHeal: 0,
        criticalRate: 0,
      },
      skills: [{ id: 'test_skill' }],
    }
    const party: Party = { id: 1, name: '第1部隊', memberIds: [1] }
    const dungeon: Dungeon = {
      id: 'slime_cave',
      name: 'スライムの洞窟',
      floors: 10,
      exploration_time_sec_first: 60,
      exploration_time_sec: 30,
      description: '',
      unlocked: true,
    }
    const expedition = {
      id: 'exp-1',
      userId: '',
      partyId: 1,
      partyName: party.name,
      dungeonId: dungeon.id,
      dungeonName: dungeon.name,
      startTime: new Date('2026-01-01T00:00:00.000Z'),
      returnTime: new Date('2026-01-01T00:01:00.000Z'),
      status: 'ongoing',
      returnPolicy: 'never',
      expeditionMeta: {
        seed: 12345,
        request: {
          partyId: '1',
          areaId: dungeon.id,
          returnPolicy: 'never',
          clientVersion: 'test',
        },
        departingGoblins: [goblin],
        rewardMultipliers: { gold: 1, rare: 1, title: 1 },
      },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    } satisfies ExpeditionRecord

    const observation = buildGameAgentObservation({
      revision: 3,
      capturedAt: new Date('2026-01-01T00:00:10.000Z'),
      tutorialStep: 'start_expedition',
      baseState,
      goblins: [goblin],
      parties: [party],
      dungeons: [dungeon],
      expeditions: [expedition],
      equipment: [],
    })

    expect(observation.revision).toBe(3)
    expect(observation.tutorial).toEqual({
      step: 'start_expedition',
      requiredExpedition: {
        dungeonId: 'slime_cave',
        tier: 0,
        targetFloor: null,
        returnPolicy: 'never',
      },
    })
    expect(observation.parties[0]).toMatchObject({
      status: 'idle',
      dungeonTier: 0,
      targetFloor: null,
      returnPolicy: 'never',
    })
    expect(observation.goblins[0]).toMatchObject({ currentHp: 20, skillIds: ['test_skill'] })
    expect(observation.expeditions[0]).not.toHaveProperty('expeditionMeta')
    expect(JSON.stringify(observation)).not.toContain('12345')
    expect(observation.actionCatalog.map(action => action.type)).toContain('start_expedition')
  })
})
