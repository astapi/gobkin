import { create } from 'zustand'
import type { ExpeditionRecord, ExpeditionReplay } from '../../shared/types'
import { MAX_EXPEDITION_HISTORY } from '../../core/repositories'
import { expeditionRepository as repository } from '../di/repositories'

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
  /**
   * 遠征完了処理（status 確定・報酬付与）は CompleteExpeditionUseCase 側で
   * トランザクション内アトミックに実施済み。ここでは履歴の剪定とストア再取得のみ行う。
   */
  finalizeCompletion: () => Promise<void>
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
      await repository.pruneOldCompleted(MAX_EXPEDITION_HISTORY)
      const records = await repository.getAll()
      set({ expeditionRecords: records, isLoading: false })
    },

    refresh,

    getExpeditionById: (id: string) => repository.getById(id),

    getPartyExpeditionHistory: async (partyId: number, limit = 2) => {
      // まず replay_json / meta を含まない軽量サマリで対象を絞り込み、
      // 表示に必要な直近 limit 件だけ replay を含むフル取得を行う。
      // これにより全履歴の巨大な replay_json をパースするコストを避ける。
      const summaries = await repository.getSummariesByPartyId(partyId)
      const targets = summaries.slice(0, limit)
      const records = await Promise.all(targets.map(summary => repository.getById(summary.id)))
      return records.filter((record): record is ExpeditionRecord => record !== null)
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

    finalizeCompletion: async () => {
      await repository.pruneOldCompleted(MAX_EXPEDITION_HISTORY)
      await refresh()
    },
  }
})
