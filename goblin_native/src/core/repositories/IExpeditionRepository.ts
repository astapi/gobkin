import type { ExpeditionRecord, ExpeditionReplay, ExpeditionRequest } from '../../shared/types'

/**
 * 遠征履歴の軽量サマリ（巨大な replay / meta を含まない）
 * 一覧表示用途で使用する
 */
export interface ExpeditionSummaryRecord {
  id: string
  partyId: number
  partyName: string
  dungeonId: string
  dungeonName: string
  startTime: Date
  returnTime: Date | null
  status: ExpeditionRecord['status']
  returnPolicy: ExpeditionRequest['returnPolicy']
  createdAt: Date
  updatedAt: Date
}

export interface IExpeditionRepository {
  getAll(): Promise<ExpeditionRecord[]>
  getAllSummaries(): Promise<ExpeditionSummaryRecord[]>
  getById(id: string): Promise<ExpeditionRecord | null>
  getByPartyId(partyId: number): Promise<ExpeditionRecord[]>
  getSummariesByPartyId(partyId: number): Promise<ExpeditionSummaryRecord[]>
  getOngoing(): Promise<ExpeditionRecord[]>
  save(record: ExpeditionRecord): Promise<void>
  updateReplay(id: string, replay: ExpeditionReplay): Promise<void>
  delete(id: string): Promise<void>
  complete(id: string, replay: ExpeditionReplay): Promise<boolean>
  pruneOldCompleted(max: number): Promise<number>
}

export const MAX_EXPEDITION_HISTORY = 50
