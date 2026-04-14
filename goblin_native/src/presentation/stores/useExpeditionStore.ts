import { create } from 'zustand'
import type { ExpeditionRecord, ExpeditionReplay } from '../../shared/types'
import { SQLiteExpeditionRepository } from '../../infrastructure/repositories'

const repository = SQLiteExpeditionRepository.getInstance()

interface ExpeditionStoreState {
  expeditionRecords: ExpeditionRecord[]
  isLoading: boolean
}

interface ExpeditionStoreActions {
  initialize: () => Promise<void>
  refresh: () => Promise<void>
  getExpeditionById: (id: string) => Promise<ExpeditionRecord | null>
  getPartyExpeditionHistory: (partyId: number, limit?: number) => Promise<ExpeditionRecord[]>
  saveExpeditionRecord: (record: ExpeditionRecord) => Promise<void>
  saveBulkExpeditionRecords: (records: ExpeditionRecord[]) => Promise<void>
  updateExpeditionReplay: (id: string, replay: ExpeditionReplay) => Promise<void>
  completeExpeditionRecord: (id: string, replay: ExpeditionReplay) => Promise<boolean>
}

export const useExpeditionStore = create<ExpeditionStoreState & ExpeditionStoreActions>()((set) => {
  const refresh = async () => {
    const records = await repository.getAll()
    set({ expeditionRecords: records })
  }

  return {
    expeditionRecords: [],
    isLoading: true,

    initialize: async () => {
      const records = await repository.getAll()
      set({ expeditionRecords: records, isLoading: false })
    },

    refresh,

    getExpeditionById: (id: string) => repository.getById(id),

    getPartyExpeditionHistory: async (partyId: number, limit = 2) => {
      const records = await repository.getByPartyId(partyId)
      return records.slice(0, limit)
    },

    saveExpeditionRecord: async (record: ExpeditionRecord) => {
      await repository.save(record)
      await refresh()
    },

    saveBulkExpeditionRecords: async (records: ExpeditionRecord[]) => {
      for (const record of records) {
        await repository.save(record)
      }
      await refresh()
    },

    updateExpeditionReplay: async (id: string, replay: ExpeditionReplay) => {
      const record = await repository.getById(id)
      if (!record) return
      await repository.save({
        ...record,
        replay,
        updatedAt: new Date(),
      })
      await refresh()
    },

    completeExpeditionRecord: async (id: string, replay: ExpeditionReplay) => {
      const updated = await repository.complete(id, replay)
      await refresh()
      return updated
    },
  }
})
