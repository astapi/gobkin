import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert } from 'react-native'
import type {
  Dungeon,
  ExpeditionReplay,
  ExpeditionRequest,
  ExpeditionRecord,
  Party,
} from '../../shared/types'
import { StartExpeditionUseCase, CompleteExpeditionUseCase } from '../../core/usecases'
import { ExpeditionEngine, GoblinBirthService } from '../../core/services'
import { areasData } from '../../shared/data'
import { usePartyService } from './usePartyService'
import { useGoblinService } from './useGoblinService'
import { useExpeditionService } from './useExpeditionService'
import { usePendingGoblins } from './usePendingGoblins'
import { useBaseState } from './useBaseState'
import { useDungeonProgress } from './useDungeonProgress'
import { SQLiteEquipmentRepository } from '../../infrastructure/repositories/SQLiteEquipmentRepository'

interface UseExpeditionFlowParams {
  refreshParties?: () => Promise<void> | void
  parties?: Party[]
  enableAutoCompletion?: boolean
}

interface StartExpeditionInput {
  party: Party
  dungeon: Dungeon
  returnPolicy: ExpeditionRequest['returnPolicy']
}

interface StartExpeditionResult {
  replay: ExpeditionReplay
  record: ExpeditionRecord
}

export interface ExpeditionHistoryDisplay {
  id: string
  title: string
  subtitle: string
  ongoing: boolean
  record: ExpeditionRecord
}

export const useExpeditionFlow = ({
  refreshParties,
  parties,
  enableAutoCompletion = false,
}: UseExpeditionFlowParams = {}) => {
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const processedExpeditionsRef = useRef<Set<string>>(new Set())

  const { partyRepository } = usePartyService()
  const { goblinRepository, goblins } = useGoblinService()
  const { pendingGoblins, addPendingGoblin, isLoading: isPendingLoading } = usePendingGoblins()
  const { rank, maxGoblins, getNextGoblinId, isLoading: isBaseLoading, baseStateRepository } = useBaseState()
  const { markDungeonCleared } = useDungeonProgress()
  const {
    expeditionRecords,
    getPartyExpeditionHistory,
    saveExpeditionRecord,
    completeExpeditionRecord,
  } = useExpeditionService()

  const startExpeditionUseCase = useMemo(() => {
    return new StartExpeditionUseCase(
      partyRepository,
      goblinRepository,
      new ExpeditionEngine(),
    )
  }, [partyRepository, goblinRepository])

  const completeExpeditionUseCase = useMemo(() => {
    return new CompleteExpeditionUseCase(goblinRepository, partyRepository, baseStateRepository, SQLiteEquipmentRepository.getInstance())
  }, [goblinRepository, partyRepository, baseStateRepository])

  const handleDungeonClear = useCallback(async (record: ExpeditionRecord) => {
    if (!record.replay || isPendingLoading || isBaseLoading) return

    const dungeon = areasData.find(area => area.id === record.dungeonId)
    if (!dungeon) return

    const cleared = record.replay.summary.success &&
      record.replay.summary.maxFloorReached >= dungeon.floors
    if (!cleared) return

    await markDungeonCleared(dungeon, true)

    const nextId = await getNextGoblinId()
    const areaLevel = dungeon.areaLevel ?? 1
    const goblinBirthService = new GoblinBirthService()
    const newGoblin = goblinBirthService.createNewGoblin(
      nextId,
      undefined,
      goblins,
      areaLevel,
      rank
    )

    if (goblins.length < maxGoblins) {
      await goblinRepository.saveGoblin(newGoblin)
    } else {
      const maxPending = rank * 5
      if (pendingGoblins.length >= maxPending) return
      await addPendingGoblin(newGoblin)
    }
  }, [
    addPendingGoblin,
    goblinRepository,
    getNextGoblinId,
    goblins,
    maxGoblins,
    isBaseLoading,
    isPendingLoading,
    markDungeonCleared,
    pendingGoblins.length,
    rank,
  ])

  const estimateExplorationTime = useCallback((
    dungeon: Dungeon,
    returnPolicy: ExpeditionRequest['returnPolicy'],
  ): number => {
    const baseTime = dungeon.cleared
      ? dungeon.exploration_time_sec
      : dungeon.exploration_time_sec_first
    const multiplierMap: Record<ExpeditionRequest['returnPolicy'], number> = {
      never: 1.0,
      until_floor2: 0.4,
      until_floor3: 0.6,
      if_any_ko: 0.7,
      if_two_ko: 0.75,
      last_one: 0.9,
    }
    const multiplier = multiplierMap[returnPolicy] ?? 1.0
    return Math.floor(baseTime * multiplier)
  }, [])

  const formatTime = useCallback((date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }, [])

  const formatTimeWithSeconds = useCallback((date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
  }, [])

  const formatFullDateTime = useCallback((date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}/${month}/${day} ${formatTime(date)}`
  }, [formatTime])

  const formatFullDateTimeWithSeconds = useCallback((date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}/${month}/${day} ${formatTimeWithSeconds(date)}`
  }, [formatTimeWithSeconds])

  const getRemainingMinutes = useCallback((returnTime: Date, now: Date) => {
    const diff = returnTime.getTime() - now.getTime()
    return Math.max(0, Math.floor(diff / (1000 * 60)))
  }, [])

  const isExpeditionOngoing = useCallback((record: ExpeditionRecord, now: Date) => {
    return record.returnTime ? record.returnTime > now : record.status === 'ongoing'
  }, [])

  const startExpedition = useCallback(
    async ({ party, dungeon, returnPolicy }: StartExpeditionInput): Promise<StartExpeditionResult> => {
      setIsProcessing(true)
      try {
        const durationSec = estimateExplorationTime(dungeon, returnPolicy)
        const request: ExpeditionRequest = {
          partyId: party.id.toString(),
          areaId: dungeon.id,
          returnPolicy,
          clientVersion: 'native',
          durationSec,
        }

        const replay = await startExpeditionUseCase.execute(request)
        const startTime = new Date()
        const returnTime = new Date(startTime.getTime() + replay.durationSec * 1000)
        const expeditionId = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        const record: ExpeditionRecord = {
          id: expeditionId,
          userId: '',
          partyId: party.id,
          partyName: party.name,
          dungeonId: dungeon.id,
          dungeonName: dungeon.name,
          startTime,
          returnTime,
          status: 'ongoing',
          returnPolicy,
          replay,
          createdAt: startTime,
          updatedAt: startTime,
        }

        await saveExpeditionRecord(record)

        return { replay, record }
      } finally {
        setIsProcessing(false)
      }
    },
    [estimateExplorationTime, saveExpeditionRecord, startExpeditionUseCase],
  )

  const completeDueExpeditions = useCallback(async (): Promise<void> => {
    const now = new Date()
    const dueExpeditions = expeditionRecords.filter(record =>
      record.status === 'ongoing' &&
      record.returnTime &&
      record.returnTime <= now &&
      record.replay
    )

    for (const record of dueExpeditions) {
      if (processedExpeditionsRef.current.has(record.id)) continue
      processedExpeditionsRef.current.add(record.id)
      try {
        // ゲームロジックを先に実行し、レベルアップ情報を含む enrichedReplay を取得
        const result = await completeExpeditionUseCase.execute(record.partyId, record.replay!)

        // DBレベルで WHERE status='ongoing' を条件にアトミックに更新。
        // enrichedReplay（memberLevelUps含む）を一括保存。
        // 既に完了済み（playback側で処理済み等）なら false が返り、スキップ。
        const updated = await completeExpeditionRecord(record.id, result.enrichedReplay)
        if (!updated) continue

        if (result.newDungeonCaptured) {
          const dungeon = areasData.find(d => d.id === result.newDungeonCaptured)
          if (dungeon?.isBaseCapture) {
            Alert.alert(
              'ダンジョン制圧！',
              `「${dungeon.name}」を制圧しました！\n\n拠点管理画面でランクアップが可能になりました。`,
              [{ text: 'OK' }]
            )
          }
        }

        await handleDungeonClear(record)
        if (refreshParties) {
          await refreshParties()
        }
      } catch (error) {
        console.warn('[useExpeditionFlow] Failed to complete expedition', error)
      }
    }
  }, [
    currentTime,
    expeditionRecords,
    completeExpeditionUseCase,
    completeExpeditionRecord,
    handleDungeonClear,
    refreshParties,
  ])

  const [partyHistories, setPartyHistories] = useState<Record<number, ExpeditionRecord[]>>({})

  useEffect(() => {
    if (!parties || parties.length === 0) {
      setPartyHistories({})
      return
    }
    const loadHistories = async () => {
      const result: Record<number, ExpeditionRecord[]> = {}
      for (const party of parties) {
        const history = await getPartyExpeditionHistory(party.id, 2)
        if (history.length > 0) {
          result[party.id] = history
        }
      }
      setPartyHistories(result)
    }
    void loadHistories()
  }, [parties, expeditionRecords, getPartyExpeditionHistory])

  const partyHistoryDisplays = useMemo(() => {
    const displays: Record<number, ExpeditionHistoryDisplay[]> = {}
    Object.entries(partyHistories).forEach(([partyId, history]) => {
      const items = history.map(record => {
        const ongoing = isExpeditionOngoing(record, currentTime)
        const floorReached = record.replay?.summary.maxFloorReached ?? 0
        const remainingMinutes = ongoing && record.returnTime
          ? getRemainingMinutes(record.returnTime, currentTime)
          : 0
        const title = ongoing && record.returnTime
          ? `[${floorReached}F]: 帰還予定 ${formatTime(record.returnTime)} 残り${remainingMinutes}分`
          : `[${floorReached}F]: ${formatFullDateTime(record.startTime)}`
        return {
          id: record.id,
          title,
          subtitle: record.dungeonName,
          ongoing,
          record,
        }
      })
      if (items.length > 0) {
        displays[Number(partyId)] = items
      }
    })
    return displays
  }, [
    partyHistories,
    currentTime,
    formatFullDateTime,
    formatTime,
    getRemainingMinutes,
    isExpeditionOngoing,
  ])

  const hasOngoingExpeditions = useMemo(() => {
    return Object.values(partyHistories).some(history =>
      history.some(record =>
        record.status === 'ongoing' &&
        record.returnTime &&
        record.returnTime > currentTime
      )
    )
  }, [partyHistories, currentTime])

  useEffect(() => {
    if (!enableAutoCompletion) return
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [enableAutoCompletion])

  useEffect(() => {
    if (!enableAutoCompletion) return
    void completeDueExpeditions()
  }, [enableAutoCompletion, completeDueExpeditions])

  return {
    isProcessing,
    startExpedition,
    estimateExplorationTime,
    completeDueExpeditions,
    currentTime,
    partyHistories,
    partyHistoryDisplays,
    hasOngoingExpeditions,
    formatTime,
    formatFullDateTime,
    formatFullDateTimeWithSeconds,
    getRemainingMinutes,
    isExpeditionOngoing,
  }
}
