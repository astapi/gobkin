import { DeleteGoblinUseCase } from '../DeleteGoblinUseCase'
import type { IGoblinRepository } from '../../repositories/IGoblinRepository'
import type { IEquipmentRepository } from '../../repositories/IEquipmentRepository'
import { EquipmentService } from '../../services/EquipmentService'
import type { Goblin, EquipmentInstance } from '../../../shared/types'

function createTestGoblin(overrides: Partial<Goblin> = {}): Goblin {
  return {
    id: 1,
    name: 'テストゴブリン',
    race: 'ゴブリン',
    level: 1,
    experience: 0,
    avatar: '/test.png',
    stats: { hp: 60, atk: 12, spd: 10, def: 10, attackCount: 2, accuracy: 20, evasion: 15 },
    skills: [],
    factors: [],
    mods: [],
    ...overrides,
  }
}

function createMockGoblinRepository(goblins: Goblin[]): IGoblinRepository {
  const store = new Map(goblins.map((goblin) => [goblin.id, { ...goblin, skills: [...goblin.skills] }]))

  return {
    getGoblins: jest.fn(async () => [...store.values()]),
    getGoblin: jest.fn(async (id: number) => {
      const goblin = store.get(id)
      return goblin ? { ...goblin, skills: [...goblin.skills] } : null
    }),
    saveGoblin: jest.fn(async (goblin: Goblin) => {
      store.set(goblin.id, { ...goblin, skills: [...goblin.skills] })
    }),
    deleteGoblin: jest.fn(async (id: number) => {
      store.delete(id)
    }),
    updateGoblinStats: jest.fn(async () => {}),
    updateGoblinLevel: jest.fn(async () => {}),
    updateGoblinFactors: jest.fn(async () => {}),
  }
}

function createMockEquipmentRepository(items: EquipmentInstance[]): IEquipmentRepository {
  const store = new Map(items.map((item) => [item.id, { ...item }]))

  return {
    getAll: jest.fn(async () => [...store.values()]),
    getByGoblinId: jest.fn(async (goblinId: number) => (
      [...store.values()].filter((item) => item.goblinId === goblinId && item.slotIndex >= 0)
    )),
    getUnequipped: jest.fn(async () => (
      [...store.values()].filter((item) => item.goblinId == null || item.slotIndex < 0)
    )),
    save: jest.fn(async (equipment: EquipmentInstance) => {
      store.set(equipment.id, { ...equipment })
    }),
    delete: jest.fn(async (id: string) => {
      store.delete(id)
    }),
  }
}

describe('DeleteGoblinUseCase', () => {
  it('追放時に装備を自動解除してからゴブリンを削除する', async () => {
    const goblin = createTestGoblin({ skills: [] })
    const equippedArmor: EquipmentInstance = { id: 'eq1', templateId: 'armor_armor', slotIndex: -1, goblinId: null }
    EquipmentService.equip(goblin, equippedArmor, 0, [])

    const goblinRepository = createMockGoblinRepository([goblin])
    const equipmentRepository = createMockEquipmentRepository([
      equippedArmor,
      { id: 'eq2', templateId: 'sword_cypress_stick', slotIndex: -1, goblinId: null },
    ])

    const useCase = new DeleteGoblinUseCase(goblinRepository, equipmentRepository)

    await useCase.execute(1)

    expect(equipmentRepository.save).toHaveBeenCalledWith({
      id: 'eq1',
      templateId: 'armor_armor',
      slotIndex: -1,
      goblinId: null,
    })
    expect(goblinRepository.saveGoblin).toHaveBeenCalled()
    const savedGoblin = (goblinRepository.saveGoblin as jest.Mock).mock.calls[0][0] as Goblin
    expect(savedGoblin.skills.some((skill) => skill.physicalDamageReductionPercent === 6)).toBe(false)
    expect(goblinRepository.deleteGoblin).toHaveBeenCalledWith(1)
  })

  it('装備がないゴブリンはそのまま削除する', async () => {
    const goblinRepository = createMockGoblinRepository([createTestGoblin()])
    const equipmentRepository = createMockEquipmentRepository([])
    const useCase = new DeleteGoblinUseCase(goblinRepository, equipmentRepository)

    await useCase.execute(1)

    expect(equipmentRepository.save).not.toHaveBeenCalled()
    expect(goblinRepository.saveGoblin).not.toHaveBeenCalled()
    expect(goblinRepository.deleteGoblin).toHaveBeenCalledWith(1)
  })

  it('対象ゴブリンが存在しない場合はエラーにする', async () => {
    const goblinRepository = createMockGoblinRepository([])
    const equipmentRepository = createMockEquipmentRepository([])
    const useCase = new DeleteGoblinUseCase(goblinRepository, equipmentRepository)

    await expect(useCase.execute(999)).rejects.toThrow('ID 999 のゴブリンが見つかりません')
    expect(goblinRepository.deleteGoblin).not.toHaveBeenCalled()
  })
})
