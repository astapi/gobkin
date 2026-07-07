import { create } from 'zustand'
import type { Party, ExpeditionRequest, DungeonTier } from '../../shared/types'
import type { IPartyRepository } from '../../core/repositories'
import { partyRepository as repository } from '../di/repositories'
import {
  ConfigurePartyUseCase,
  CreatePartyUseCase,
  GetPartyByIdUseCase,
  GetPartyListUseCase,
  ManagePartyUseCase,
  UpdatePartyMembersUseCase,
} from '../../core/usecases'
import type { CreatePartyInput } from '../../core/usecases/CreatePartyUseCase'

const getPartyListUseCase = new GetPartyListUseCase(repository)
const getPartyByIdUseCase = new GetPartyByIdUseCase(repository)
const managePartyUseCase = new ManagePartyUseCase(repository)
const createPartyUseCase = new CreatePartyUseCase(repository)
const updatePartyMembersUseCase = new UpdatePartyMembersUseCase(repository)
const configurePartyUseCase = new ConfigurePartyUseCase(repository)

interface PartyState {
  parties: Party[]
  isLoading: boolean
}

interface PartyActions {
  initialize: () => Promise<void>
  refresh: () => Promise<void>
  getPartyById: (partyId: number) => Promise<Party | null>
  createParty: (input: CreatePartyInput) => Promise<Party>
  updateName: (partyId: number, name: string) => Promise<Party>
  updateMembers: (partyId: number, memberIds: number[]) => Promise<Party>
  addMember: (partyId: number, goblinId: number) => Promise<Party>
  removeMember: (partyId: number, goblinId: number) => Promise<Party>
  markExpedition: (partyId: number) => Promise<void>
  markIdle: (partyId: number) => Promise<void>
  setDungeon: (partyId: number, dungeonId: string) => Promise<Party>
  setDungeonTier: (partyId: number, tier: DungeonTier) => Promise<Party>
  setTargetFloor: (partyId: number, targetFloor: number | null) => Promise<Party>
  setReturnPolicy: (partyId: number, returnPolicy: ExpeditionRequest['returnPolicy']) => Promise<Party>
}

export const usePartyStore = create<PartyState & PartyActions>()((set) => {
  const refresh = async () => {
    const parties = await getPartyListUseCase.execute()
    set({ parties })
  }

  return {
    parties: [],
    isLoading: true,

    initialize: async () => {
      const parties = await getPartyListUseCase.execute()
      set({ parties, isLoading: false })
    },

    refresh,

    getPartyById: (partyId: number) => getPartyByIdUseCase.execute(partyId),

    createParty: async (input: CreatePartyInput) => {
      const created = await createPartyUseCase.execute(input)
      await refresh()
      return created
    },

    updateName: async (partyId: number, name: string) => {
      const updated = await configurePartyUseCase.setName(partyId, name)
      await refresh()
      return updated
    },

    updateMembers: async (partyId: number, memberIds: number[]) => {
      const updated = await updatePartyMembersUseCase.execute(partyId, memberIds)
      await refresh()
      return updated
    },

    addMember: async (partyId: number, goblinId: number) => {
      const updated = await managePartyUseCase.addMember(partyId, goblinId.toString())
      await refresh()
      return updated
    },

    removeMember: async (partyId: number, goblinId: number) => {
      const updated = await managePartyUseCase.removeMember(partyId, goblinId.toString())
      await refresh()
      return updated
    },

    markExpedition: async (partyId: number) => {
      await managePartyUseCase.markExpedition(partyId)
      await refresh()
    },

    markIdle: async (partyId: number) => {
      await managePartyUseCase.markIdle(partyId)
      await refresh()
    },

    setDungeon: async (partyId: number, dungeonId: string) => {
      const updated = await configurePartyUseCase.setDungeon(partyId, dungeonId)
      await refresh()
      return updated
    },

    setDungeonTier: async (partyId: number, tier: DungeonTier) => {
      const updated = await configurePartyUseCase.setDungeonTier(partyId, tier)
      await refresh()
      return updated
    },

    setTargetFloor: async (partyId: number, targetFloor: number | null) => {
      const updated = await configurePartyUseCase.setTargetFloor(partyId, targetFloor)
      await refresh()
      return updated
    },

    setReturnPolicy: async (partyId: number, returnPolicy: ExpeditionRequest['returnPolicy']) => {
      const updated = await configurePartyUseCase.setReturnPolicy(partyId, returnPolicy)
      await refresh()
      return updated
    },
  }
})

/** UseCase等にリポジトリを渡す必要がある場合に使用 */
export const getPartyRepository = (): IPartyRepository => repository
