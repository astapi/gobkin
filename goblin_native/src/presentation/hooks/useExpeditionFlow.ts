import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert } from 'react-native'
import type {
  Dungeon,
  DungeonTier,
  ExpeditionReplay,
  ExpeditionRequest,
  ExpeditionRecord,
  Party,
} from '../../shared/types'
import { StartExpeditionUseCase, CompleteExpeditionUseCase } from '../../core/usecases'
import { GoblinBirthService, computeExpeditionReplay } from '../../core/services'
import { areasData } from '../../shared/data'
import { usePartyStore, getPartyRepository } from '../stores/usePartyStore'
import { useGoblinStore, getGoblinRepository } from '../stores/useGoblinStore'
import { useExpeditionStore } from '../stores/useExpeditionStore'
import { useBaseStore, getBaseStateRepository } from '../stores/useBaseStore'
import { useDungeonStore } from '../stores/useDungeonStore'
import { SQLiteEquipmentRepository } from '../../infrastructure/repositories/SQLiteEquipmentRepository'
import { useDebugSettingsStore } from '../stores/useDebugSettingsStore'
import { getSpeedMultiplier } from '../stores/usePurchaseStore'
import { useStoryStore } from '../stores/useStoryStore'
import { getDungeonName } from '../../shared/i18n/entityLocalization'
import { getDungeonTierAreaLevel, getDungeonTierDisplayName } from '../../shared/types'
import i18n from '../../shared/i18n'

interface UseExpeditionFlowParams {
  parties?: Party[]
  enableAutoCompletion?: boolean
  currentTime?: Date
}

interface StartExpeditionInput {
  party: Party
  dungeon: Dungeon
  returnPolicy: ExpeditionRequest['returnPolicy']
  tier?: DungeonTier
}

interface StartExpeditionResult {
  record: ExpeditionRecord
}

export interface ExpeditionHistoryDisplay {
  id: string
  title: string
  subtitle: string
  ongoing: boolean
  record: ExpeditionRecord
}

function formatDungeonLabel(dungeonName: string, areaLevel?: number, tier?: DungeonTier): string {
  const effectiveAreaLevel = areaLevel === undefined
    ? undefined
    : getDungeonTierAreaLevel(areaLevel, tier ?? 0)
  const baseLabel = effectiveAreaLevel === undefined ? dungeonName : `${dungeonName} / Area Lv.${effectiveAreaLevel}`
  return getDungeonTierDisplayName(baseLabel, tier ?? 0)
}

export const useExpeditionFlow = ({
  parties,
  enableAutoCompletion = false,
  currentTime: externalCurrentTime,
}: UseExpeditionFlowParams = {}) => {
  const [isProcessing, setIsProcessing] = useState(false)
  const processedExpeditionsRef = useRef<Set<string>>(new Set())
  const currentTime = externalCurrentTime ?? new Date()

  const partyRepository = getPartyRepository()
  const goblinRepository = getGoblinRepository()
  const goblins = useGoblinStore((state) => state.goblins)
  const addPendingGoblin = useBaseStore((state) => state.addPendingGoblin)
  const isPendingLoading = useBaseStore((state) => state.isLoading)
  const getNextGoblinId = useBaseStore((state) => state.getNextGoblinId)
  const rank = useBaseStore(s => s.baseState?.rank ?? 1)
  const isBaseLoading = useBaseStore(s => s.isLoading)
  const baseStateRepository = getBaseStateRepository()
  const markDungeonCleared = useDungeonStore((state) => state.markDungeonCleared)
  const checkAndUnlockStories = useStoryStore((state) => state.checkAndUnlockStories)
  const expeditionRecords = useExpeditionStore((state) => state.expeditionRecords)
  const getPartyExpeditionHistory = useExpeditionStore((state) => state.getPartyExpeditionHistory)
  const saveExpeditionRecord = useExpeditionStore((state) => state.saveExpeditionRecord)
  const saveBulkExpeditionRecords = useExpeditionStore((state) => state.saveBulkExpeditionRecords)
  const completeExpeditionRecord = useExpeditionStore((state) => state.completeExpeditionRecord)
  const instantDungeonExploration = useDebugSettingsStore((state) => state.instantDungeonExploration)

  const equipmentRepository = useMemo(() => SQLiteEquipmentRepository.getInstance(), [])

  const startExpeditionUseCase = useMemo(() => {
    return new StartExpeditionUseCase(
      partyRepository,
      goblinRepository,
      equipmentRepository,
    )
  }, [partyRepository, goblinRepository, equipmentRepository])

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

    const tier = record.replay.meta.tier as DungeonTier | undefined
    await markDungeonCleared(dungeon, true, tier)
    await checkAndUnlockStories(dungeon.id)

    const nextId = await getNextGoblinId()
    const areaLevel = record.replay.meta.effectiveAreaLevel ??
      getDungeonTierAreaLevel(dungeon.areaLevel ?? 1, tier ?? 0)
    const goblinBirthService = new GoblinBirthService()
    const newGoblin = goblinBirthService.createNewGoblin(
      nextId,
      undefined,
      goblins,
      areaLevel,
      rank
    )

    await useBaseStore.getState().refreshPendingGoblins()
    const latestPendingGoblins = useBaseStore.getState().pendingGoblins
    const maxPending = rank * 5
    if (latestPendingGoblins.length >= maxPending) return
    await addPendingGoblin(newGoblin)
  }, [
    addPendingGoblin,
    checkAndUnlockStories,
    getNextGoblinId,
    goblins,
    isBaseLoading,
    isPendingLoading,
    markDungeonCleared,
    rank,
  ])

  const estimateExplorationTime = useCallback((
    dungeon: Dungeon,
    returnPolicy: ExpeditionRequest['returnPolicy'],
  ): number => {
    if (instantDungeonExploration) {
      return 1
    }

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
    const speedMultiplier = getSpeedMultiplier()
    return Math.floor(baseTime * multiplier * speedMultiplier)
  }, [instantDungeonExploration])

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
    async ({ party, dungeon, returnPolicy, tier }: StartExpeditionInput): Promise<StartExpeditionResult> => {
      setIsProcessing(true)
      try {
        const durationSec = estimateExplorationTime(dungeon, returnPolicy)
        const request: ExpeditionRequest = {
          partyId: party.id.toString(),
          areaId: dungeon.id,
          tier,
          returnPolicy,
          clientVersion: 'native',
          durationSec,
        }

        const expeditionMeta = await startExpeditionUseCase.execute(request)
        const startTime = new Date()
        const returnTime = new Date(startTime.getTime() + durationSec * 1000)
        const expeditionId = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        const record: ExpeditionRecord = {
          id: expeditionId,
          userId: '',
          partyId: party.id,
          partyName: party.name,
          dungeonId: dungeon.id,
          dungeonName: getDungeonName(dungeon),
          startTime,
          returnTime,
          status: 'ongoing',
          returnPolicy,
          expeditionMeta,
          createdAt: startTime,
          updatedAt: startTime,
        }

        await saveExpeditionRecord(record)
        // UseCaseがDB上のparty.statusと出発時HPを直接更新するため、ストアを同期
        await usePartyStore.getState().refresh()
        await useGoblinStore.getState().refresh()

        return { record }
      } finally {
        setIsProcessing(false)
      }
    },
    [estimateExplorationTime, saveExpeditionRecord, startExpeditionUseCase],
  )

  interface BulkStartResult {
    startedCount: number
    skippedReasons: string[]
  }

  const startBulkExpedition = useCallback(
    async (inputs: StartExpeditionInput[]): Promise<BulkStartResult> => {
      setIsProcessing(true)
      const records: ExpeditionRecord[] = []
      const skippedReasons: string[] = []

      try {
        for (const { party, dungeon, returnPolicy, tier } of inputs) {
          const durationSec = estimateExplorationTime(dungeon, returnPolicy)
          const request: ExpeditionRequest = {
            partyId: party.id.toString(),
            areaId: dungeon.id,
            tier,
            returnPolicy,
            clientVersion: 'native',
            durationSec,
          }

          try {
            const expeditionMeta = await startExpeditionUseCase.execute(request)
            const startTime = new Date()
            const returnTime = new Date(startTime.getTime() + durationSec * 1000)
            const expeditionId = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
            records.push({
              id: expeditionId,
              userId: '',
              partyId: party.id,
              partyName: party.name,
              dungeonId: dungeon.id,
              dungeonName: getDungeonName(dungeon),
              startTime,
              returnTime,
              status: 'ongoing',
              returnPolicy,
              expeditionMeta,
              createdAt: startTime,
              updatedAt: startTime,
            })
          } catch (error) {
            skippedReasons.push(`${party.name}: ${(error as Error).message}`)
          }
        }

        if (records.length > 0) {
          await saveBulkExpeditionRecords(records)
          await usePartyStore.getState().refresh()
          await useGoblinStore.getState().refresh()
        }

        return { startedCount: records.length, skippedReasons }
      } finally {
        setIsProcessing(false)
      }
    },
    [estimateExplorationTime, saveBulkExpeditionRecords, startExpeditionUseCase],
  )

  const updateExpeditionReplay = useExpeditionStore((state) => state.updateExpeditionReplay)

  const completeDueExpeditions = useCallback(async (): Promise<void> => {
    const now = new Date()
    const dueExpeditions = expeditionRecords.filter(record =>
      record.status === 'ongoing' &&
      record.returnTime &&
      record.returnTime <= now &&
      (record.replay || record.expeditionMeta)
    )

    for (const record of dueExpeditions) {
      if (processedExpeditionsRef.current.has(record.id)) continue
      processedExpeditionsRef.current.add(record.id)
      try {
        // replay が未計算の場合は遅延計算を実行
        let replay = record.replay
        if (!replay && record.expeditionMeta) {
          replay = await computeExpeditionReplay(record.expeditionMeta)
          await updateExpeditionReplay(record.id, replay)
        }
        if (!replay) continue

        // ゲームロジックを先に実行し、レベルアップ情報を含む enrichedReplay を取得
        const result = await completeExpeditionUseCase.execute(record.partyId, replay)

        // DBレベルで WHERE status='ongoing' を条件にアトミックに更新。
        // enrichedReplay（memberLevelUps含む）を一括保存。
        // 既に完了済み（playback側で処理済み等）なら false が返り、スキップ。
        const updated = await completeExpeditionRecord(record.id, result.enrichedReplay)
        if (!updated) continue

        if (result.newDungeonCaptured) {
          const dungeon = areasData.find(d => d.id === result.newDungeonCaptured)
          if (dungeon?.isBaseCapture) {
            Alert.alert(
              i18n.t('ui.result.completed'),
              i18n.t('ui.result.unlockedArea', { name: getDungeonName(dungeon) }),
              [{ text: 'OK' }]
            )
          }
        }

        await handleDungeonClear({ ...record, replay: result.enrichedReplay })
        // UseCaseがDB上のbase_state.goldや制圧済み拠点を直接更新するため、ストアを同期
        await useBaseStore.getState().refresh()
        // UseCaseがDB上のparty.statusを'idle'に直接更新するため、ストアを同期
        await usePartyStore.getState().refresh()
        // ゴブリンのレベルアップ等もDB直接更新されるため同期
        await useGoblinStore.getState().refresh()
      } catch (error) {
        console.warn('[useExpeditionFlow] Failed to complete expedition', error)
      }
    }
  }, [
    expeditionRecords,
    completeExpeditionUseCase,
    completeExpeditionRecord,
    handleDungeonClear,
    updateExpeditionReplay,
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
        const dungeon = areasData.find(area => area.id === record.dungeonId)
        const ongoing = isExpeditionOngoing(record, currentTime)
        const floorReached = record.replay?.summary.maxFloorReached ?? 0
        const remainingMinutes = ongoing && record.returnTime
          ? getRemainingMinutes(record.returnTime, currentTime)
          : 0
        const title = ongoing && record.returnTime
          ? i18n.t('ui.formation.index.historyOngoing', { floor: floorReached, time: formatTime(record.returnTime), minutes: remainingMinutes })
          : i18n.t('ui.formation.index.historyCompleted', { floor: floorReached, time: formatFullDateTime(record.startTime) })
        return {
          id: record.id,
          title,
          subtitle: formatDungeonLabel(
            dungeon ? getDungeonName(dungeon) : record.dungeonName,
            dungeon?.areaLevel,
            record.replay?.meta.tier,
          ),
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
    void completeDueExpeditions()
    const interval = setInterval(() => {
      void completeDueExpeditions()
    }, 1000)
    return () => clearInterval(interval)
  }, [enableAutoCompletion, completeDueExpeditions])

  return {
    isProcessing,
    startExpedition,
    startBulkExpedition,
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
