import { StartExpeditionUseCase } from '../StartExpeditionUseCase'
import type { IEquipmentRepository, IGoblinRepository, IPartyRepository } from '../../repositories'
import type { EquipmentInstance, Goblin, Party } from '../../../shared/types'

function createTestGoblin(overrides: Partial<Goblin> = {}): Goblin {
  return {
    id: 1,
    name: 'テストゴブリン',
    race: 'ゴブリン',
    raceId: 'goblin',
    level: 1,
    experience: 0,
    avatar: '/test.png',
    stats: {
      hp: 60,
      atk: 12,
      magicAtk: 0,
      def: 10,
      magicDef: 0,
      attackCount: 2,
      accuracy: 20,
      evasion: 15,
      magicHeal: 0,
      criticalRate: 0,
    },
    skills: [],
    factors: [],
    ...overrides,
  }
}

function createTestParty(overrides: Partial<Party> = {}): Party {
  return {
    id: 1,
    name: 'テストパーティ',
    memberIds: [1],
    status: 'idle',
    ...overrides,
  }
}

function createGoblinRepository(goblin: Goblin): IGoblinRepository {
  return {
    getGoblins: jest.fn(async () => [goblin]),
    getGoblin: jest.fn(async (id: number) => (id === goblin.id ? goblin : null)),
    saveGoblin: jest.fn(async () => {}),
    deleteGoblin: jest.fn(async () => {}),
    updateGoblinStats: jest.fn(async () => {}),
    updateGoblinLevel: jest.fn(async () => {}),
    updateGoblinFactors: jest.fn(async () => {}),
    updateGoblinCurrentHp: jest.fn(async () => {}),
  }
}

function createPartyRepository(party: Party): IPartyRepository {
  return {
    getParties: jest.fn(async () => [party]),
    getParty: jest.fn(async (id: number) => (id === party.id ? party : null)),
    saveParty: jest.fn(async () => {}),
    deleteParty: jest.fn(async () => {}),
    updatePartyStatus: jest.fn(async () => {}),
    getPartiesByStatus: jest.fn(async () => []),
    updateDungeonSettings: jest.fn(async () => {}),
    updateDungeonTier: jest.fn(async () => {}),
    updateFloorTarget: jest.fn(async () => {}),
    updateReturnPolicy: jest.fn(async () => {}),
  }
}

function createEquipmentRepository(equipment: EquipmentInstance[]): IEquipmentRepository {
  return {
    getAll: jest.fn(async () => equipment),
    getByGoblinId: jest.fn(async (goblinId: number) => (
      equipment.filter((item) => item.goblinId === goblinId)
    )),
    getUnequipped: jest.fn(async () => equipment.filter((item) => item.goblinId === null)),
    save: jest.fn(async () => {}),
    delete: jest.fn(async () => {}),
    deleteMany: jest.fn(async () => {}),
  }
}

describe('StartExpeditionUseCase', () => {
  it('HP0のメンバーを遠征開始時に最大HPまで復活させる', async () => {
    const goblin = createTestGoblin({ currentHp: 0 })
    const goblinRepository = createGoblinRepository(goblin)
    const useCase = new StartExpeditionUseCase(
      createPartyRepository(createTestParty()),
      goblinRepository,
      createEquipmentRepository([]),
    )

    const meta = await useCase.execute({
      partyId: '1',
      areaId: 'road_1',
      returnPolicy: 'never',
      clientVersion: 'test',
    })

    expect(meta.departingGoblins[0].currentHp).toBe(meta.departingGoblins[0].effectiveStats?.hp)
    expect(goblinRepository.updateGoblinCurrentHp).toHaveBeenCalledWith(
      goblin.id,
      meta.departingGoblins[0].effectiveStats?.hp,
    )
  })

  it('遠征開始時に現在の装備から実効ステータスを再計算する', async () => {
    const goblin = createTestGoblin({
      effectiveStats: {
        hp: 60,
        atk: 12,
        magicAtk: 0,
        def: 10,
        magicDef: 0,
        attackCount: 2,
        accuracy: 20,
        evasion: 15,
        magicHeal: 0,
        criticalRate: 0,
      },
    })
    const equipment: EquipmentInstance[] = [{
      id: 'eq-1',
      templateId: 'sword_adamant',
      slotIndex: 0,
      goblinId: 1,
    }]
    const useCase = new StartExpeditionUseCase(
      createPartyRepository(createTestParty()),
      createGoblinRepository(goblin),
      createEquipmentRepository(equipment),
    )

    const meta = await useCase.execute({
      partyId: '1',
      areaId: 'road_1',
      returnPolicy: 'never',
      clientVersion: 'test',
    })

    expect(meta.departingGoblins[0].effectiveStats?.atk).toBeGreaterThan(goblin.effectiveStats!.atk)
    expect(meta.departingGoblins[0].effectiveStats?.atk).toBe(140)
    expect(meta.departingGoblins[0].currentHp).toBe(meta.departingGoblins[0].effectiveStats?.hp)
  })

  it('遠征開始時に装備MOD込みの実効能力値を保存する', async () => {
    const goblin = createTestGoblin({
      baseAttributes: { power: 20, wisdom: 20, spirit: 20, vitality: 20, agility: 20, luck: 20 },
    })
    const equipment: EquipmentInstance[] = [{
      id: 'eq-mod',
      templateId: 'sword_cypress_stick',
      slotIndex: 0,
      goblinId: 1,
      prefixMod: { id: 'power', tier: 9 },
      suffixMod: { id: 'vitality', tier: 10 },
    }]
    const useCase = new StartExpeditionUseCase(
      createPartyRepository(createTestParty()),
      createGoblinRepository(goblin),
      createEquipmentRepository(equipment),
    )

    const meta = await useCase.execute({
      partyId: '1',
      areaId: 'road_1',
      returnPolicy: 'never',
      clientVersion: 'test',
    })

    expect(meta.departingGoblins[0].effectiveBaseAttributes?.power).toBe(21)
    expect(meta.departingGoblins[0].effectiveBaseAttributes?.vitality).toBe(21)
  })
})
