import { create } from 'zustand'
import type { Goblin } from '../../shared/types'
import { SQLiteGoblinRepository } from '../../infrastructure/repositories/SQLiteGoblinRepository'
import type { IGoblinRepository } from '../../core/repositories'
import { GetGoblinListUseCase } from '../../core/usecases'

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
}

const repository: IGoblinRepository = SQLiteGoblinRepository.getInstance()
const getGoblinListUseCase = new GetGoblinListUseCase(repository)

export const useGoblinStore = create<GoblinState & GoblinActions>()((set) => ({
  goblins: [],
  isLoading: true,

  initialize: async () => {
    const goblins = await getGoblinListUseCase.execute()
    set({ goblins, isLoading: false })
  },

  refresh: async () => {
    const goblins = await getGoblinListUseCase.execute()
    set({ goblins })
  },

  getGoblinById: async (goblinId: number) => {
    const goblin = await repository.getGoblin(goblinId)
    if (!goblin) {
      throw new Error(`ID ${goblinId} のゴブリンが見つかりません`)
    }
    return goblin
  },

  saveGoblin: async (goblin: Goblin) => {
    await repository.saveGoblin(goblin)
    const goblins = await getGoblinListUseCase.execute()
    set({ goblins })
  },

  deleteGoblin: async (goblinId: number) => {
    await repository.deleteGoblin(goblinId)
    const goblins = await getGoblinListUseCase.execute()
    set({ goblins })
  },

  updateGoblinLevel: async (goblinId: number, level: number) => {
    await repository.updateGoblinLevel(goblinId, level)
    const goblins = await getGoblinListUseCase.execute()
    set({ goblins })
  },
}))

/** UseCase等にリポジトリを渡す必要がある場合に使用 */
export const getGoblinRepository = (): IGoblinRepository => repository
