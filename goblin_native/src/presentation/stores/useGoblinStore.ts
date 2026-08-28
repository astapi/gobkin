import { create } from 'zustand'
import type { Goblin } from '../../shared/types'
import type { IGoblinRepository } from '../../core/repositories'
import { goblinRepository as repository, equipmentRepository } from '../di/repositories'
import { DeleteGoblinUseCase, GetGoblinListUseCase } from '../../core/usecases'
import { usePartyStore } from './usePartyStore'
import { calculateGoblinEffectiveStats } from '../../shared/utils/goblinStats'
import { isProtectedGoblin } from '../../shared/utils/goblinProtection'

interface GoblinState {
  goblins: Goblin[]
  isLoading: boolean
}

interface GoblinActions {
  initialize: () => Promise<void>
  refresh: () => Promise<void>
  getGoblinById: (goblinId: number) => Promise<Goblin>
  saveGoblin: (goblin: Goblin) => Promise<void>
  deleteGoblin: (goblinId: number) => Promise<void>
  updateGoblinLevel: (goblinId: number, level: number) => Promise<void>
  updateGoblinCurrentHp: (goblinId: number, currentHp: number | null) => Promise<void>
}

const getGoblinListUseCase = new GetGoblinListUseCase(repository)
const deleteGoblinUseCase = new DeleteGoblinUseCase(repository, equipmentRepository)

async function attachEquipmentEffectiveStats(goblin: Goblin): Promise<Goblin> {
  const equippedItems = await equipmentRepository.getByGoblinId(goblin.id)
  return {
    ...goblin,
    effectiveStats: calculateGoblinEffectiveStats(goblin, equippedItems),
  }
}

async function attachEquipmentEffectiveStatsToList(goblins: Goblin[]): Promise<Goblin[]> {
  const allEquipment = await equipmentRepository.getAll()
  const equipmentByGoblinId = new Map<number, typeof allEquipment>()

  for (const equipment of allEquipment) {
    if (equipment.goblinId == null || equipment.slotIndex < 0) continue
    const list = equipmentByGoblinId.get(equipment.goblinId) ?? []
    list.push(equipment)
    equipmentByGoblinId.set(equipment.goblinId, list)
  }

  return goblins.map((goblin) => ({
    ...goblin,
    effectiveStats: calculateGoblinEffectiveStats(goblin, equipmentByGoblinId.get(goblin.id) ?? []),
  }))
}

export const useGoblinStore = create<GoblinState & GoblinActions>()((set) => ({
  goblins: [],
  isLoading: true,

  initialize: async () => {
    const goblins = await attachEquipmentEffectiveStatsToList(await getGoblinListUseCase.execute())
    set({ goblins, isLoading: false })
  },

  refresh: async () => {
    const goblins = await attachEquipmentEffectiveStatsToList(await getGoblinListUseCase.execute())
    set({ goblins })
  },

  getGoblinById: async (goblinId: number) => {
    const goblin = await repository.getGoblin(goblinId)
    if (!goblin) {
      throw new Error(`ID ${goblinId} のゴブリンが見つかりません`)
    }
    return attachEquipmentEffectiveStats(goblin)
  },

  saveGoblin: async (goblin: Goblin) => {
    await repository.saveGoblin(goblin)
    const goblins = await attachEquipmentEffectiveStatsToList(await getGoblinListUseCase.execute())
    set({ goblins })
  },

  deleteGoblin: async (goblinId: number) => {
    const goblin = await repository.getGoblin(goblinId)
    if (goblin && isProtectedGoblin(goblin)) {
      throw new Error(`${goblin.name}は追放できません`)
    }
    const parties = usePartyStore.getState().parties
    const assignedParty = parties.find((party) => party.memberIds.includes(goblinId))
    if (assignedParty) {
      throw new Error(`${assignedParty.name}に編成中のため追放できません`)
    }
    await deleteGoblinUseCase.execute(goblinId)
    const goblins = await attachEquipmentEffectiveStatsToList(await getGoblinListUseCase.execute())
    set({ goblins })
  },

  updateGoblinLevel: async (goblinId: number, level: number) => {
    await repository.updateGoblinLevel(goblinId, level)
    const goblins = await attachEquipmentEffectiveStatsToList(await getGoblinListUseCase.execute())
    set({ goblins })
  },

  updateGoblinCurrentHp: async (goblinId: number, currentHp: number | null) => {
    await repository.updateGoblinCurrentHp(goblinId, currentHp)
    const goblins = await attachEquipmentEffectiveStatsToList(await getGoblinListUseCase.execute())
    set({ goblins })
  },
}))

/** UseCase等にリポジトリを渡す必要がある場合に使用 */
export const getGoblinRepository = (): IGoblinRepository => repository
