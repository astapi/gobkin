import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { router } from 'expo-router'
import type {
  Dungeon,
  DungeonTier,
  ExpeditionBoost,
  ExpeditionReplay,
  ExpeditionRequest,
  ExpeditionRecord,
  Party,
} from '../../shared/types'
import { StartExpeditionUseCase, CompleteExpeditionUseCase } from '../../core/usecases'
import { MAX_EXPEDITION_HISTORY } from '../../core/repositories'
import { GoblinBirthService, computeExpeditionReplay } from '../../core/services'
import { areasData } from '../../shared/data'
import { usePartyStore, getPartyRepository } from '../stores/usePartyStore'
import { useGoblinStore, getGoblinRepository } from '../stores/useGoblinStore'
import { useExpeditionStore } from '../stores/useExpeditionStore'
import { useBaseStore, getBaseStateRepository } from '../stores/useBaseStore'
import { useDungeonStore } from '../stores/useDungeonStore'
import {
  equipmentRepository,
  equipmentAutoSellFilterRepository,
  expeditionRepository,
  transactionRunner,
} from '../di/repositories'
import { useDebugSettingsStore } from '../stores/useDebugSettingsStore'
import { getSpeedMultiplier, hasMonthlyPass, usePurchaseStore } from '../stores/usePurchaseStore'
import {
  TICKET_TYPES,
  GOLDEN_ACORN_SPEED_MULTIPLIER,
  GOLDEN_ACORN_EXP_MULTIPLIER,
  GOLDEN_ACORN_GOLD_MULTIPLIER,
  GOLDEN_ACORN_RARE_MULTIPLIER,
  GOLDEN_ACORN_TITLE_MULTIPLIER,
  MONTHLY_PASS_REWARD_MULTIPLIER,
  MONTHLY_PASS_SPEED_MULTIPLIER,
} from '../../shared/constants/purchases'
import { useStoryStore } from '../stores/useStoryStore'
import { useTutorialStore } from '../stores/useTutorialStore'
import { useExpeditionNotification } from '../hooks/useExpeditionNotification'
import { useCurrentTime } from './useCurrentTime'
import { getDungeonName } from '../../shared/i18n/entityLocalization'
import { computeDungeonExplorationTime, getDungeonTierAreaLevel, getDungeonTierDisplayName } from '../../shared/types'
import { getMaxClearedFloorFromReplay, isDungeonCompleted } from '../../shared/utils/expeditionClear'
import { computeCurrentFloor } from '../../shared/utils/expeditionFloor'
import { getExpeditionTimeMultiplierFromSkills } from '../../shared/data/characterSkills'
import { EquipmentService } from '../../core/services/EquipmentService'
import i18n from '../../shared/i18n'
import {
  isAutoExpeditionDayBoundaryRun,
  isAutoExpeditionDungeonCleared,
  isAutoExpeditionRecord,
} from '../../shared/utils/autoExpedition'

interface UseExpeditionFlowParams {
  parties?: Party[]
  enableAutoCompletion?: boolean
  currentTime?: Date
}

interface StartExpeditionInput {
  party: Party
  dungeon: Dungeon
  returnPolicy: ExpeditionRequest['returnPolicy']
  targetFloor?: number | null
  tier?: DungeonTier
  /** 出発時に金のドングリを消費するか */
  useGoldenAcorn?: boolean
  /** 自動周回時に前回帰還時刻から連続させるための開始時刻 */
  startTime?: Date
}

interface StartExpeditionResult {
  record: ExpeditionRecord
}

interface ExpeditionMutationOptions {
  /** false の場合、DBだけ更新し、画面向けStoreの同期を呼び出し側へ委ねる。 */
  syncStores?: boolean
  /** false の場合、遠征履歴を作らない。オフライン周回の中間精算で使用する。 */
  persistRecord?: boolean
  /** false の場合、画面用の処理中stateを更新しない。 */
  trackProcessing?: boolean
}

const GOLDEN_ACORN_BOOST: ExpeditionBoost = {
  expMultiplier: GOLDEN_ACORN_EXP_MULTIPLIER,
  goldMultiplier: GOLDEN_ACORN_GOLD_MULTIPLIER,
  rareDropMultiplier: GOLDEN_ACORN_RARE_MULTIPLIER,
  titleMultiplier: GOLDEN_ACORN_TITLE_MULTIPLIER,
  goldenAcornUsed: true,
}

const MONTHLY_PASS_BOOST: ExpeditionBoost = {
  goldMultiplier: MONTHLY_PASS_REWARD_MULTIPLIER,
  rareDropMultiplier: MONTHLY_PASS_REWARD_MULTIPLIER,
  titleMultiplier: MONTHLY_PASS_REWARD_MULTIPLIER,
  factorDropMultiplier: MONTHLY_PASS_REWARD_MULTIPLIER,
}

function combineExpeditionBoosts(...boosts: Array<ExpeditionBoost | undefined>): ExpeditionBoost | undefined {
  const enabledBoosts = boosts.filter((boost): boost is ExpeditionBoost => boost !== undefined)
  if (enabledBoosts.length === 0) return undefined

  return enabledBoosts.reduce<ExpeditionBoost>((combined, boost) => ({
    expMultiplier: (combined.expMultiplier ?? 1) * (boost.expMultiplier ?? 1),
    goldMultiplier: (combined.goldMultiplier ?? 1) * (boost.goldMultiplier ?? 1),
    rareDropMultiplier: (combined.rareDropMultiplier ?? 1) * (boost.rareDropMultiplier ?? 1),
    titleMultiplier: (combined.titleMultiplier ?? 1) * (boost.titleMultiplier ?? 1),
    factorDropMultiplier: (combined.factorDropMultiplier ?? 1) * (boost.factorDropMultiplier ?? 1),
    goldenAcornUsed: combined.goldenAcornUsed === true || boost.goldenAcornUsed === true,
  }), {})
}

function getExpeditionBoost(useGoldenAcorn: boolean): ExpeditionBoost | undefined {
  return combineExpeditionBoosts(
    hasMonthlyPass() ? MONTHLY_PASS_BOOST : undefined,
    useGoldenAcorn ? GOLDEN_ACORN_BOOST : undefined,
  )
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
  const autoStartingPartyIdsRef = useRef<Set<number>>(new Set())
  const completionRunningRef = useRef(false)
  // externalCurrentTime 未指定時に毎レンダー new Date() を生成すると useMemo が総崩れになるため、
  // 内部の安定した時刻state（必要時のみ1秒周期で更新）にフォールバックする。
  const internalCurrentTime = useCurrentTime({
    enabled: externalCurrentTime === undefined && enableAutoCompletion,
  })
  const currentTime = externalCurrentTime ?? internalCurrentTime

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
  const markDungeonFloorCleared = useDungeonStore((state) => state.markDungeonFloorCleared)
  const checkAndUnlockStories = useStoryStore((state) => state.checkAndUnlockStories)
  const expeditionRecords = useExpeditionStore((state) => state.expeditionRecords)
  const getPartyExpeditionHistory = useExpeditionStore((state) => state.getPartyExpeditionHistory)
  const saveExpeditionRecord = useExpeditionStore((state) => state.saveExpeditionRecord)
  const saveBulkExpeditionRecords = useExpeditionStore((state) => state.saveBulkExpeditionRecords)
  const finalizeCompletion = useExpeditionStore((state) => state.finalizeCompletion)
  const instantDungeonExploration = useDebugSettingsStore((state) => state.instantDungeonExploration)

  const { scheduleExpeditionNotification, cancelExpeditionNotification } = useExpeditionNotification()

  const startExpeditionUseCase = useMemo(() => {
    return new StartExpeditionUseCase(
      partyRepository,
      goblinRepository,
      equipmentRepository,
    )
  }, [partyRepository, goblinRepository])

  const completeExpeditionUseCase = useMemo(() => {
    return new CompleteExpeditionUseCase(
      goblinRepository,
      partyRepository,
      baseStateRepository,
      equipmentRepository,
      // 冪等性ゲート（complete）と enrichedReplay 保存を同一トランザクションで実施
      expeditionRepository,
      transactionRunner,
      equipmentAutoSellFilterRepository,
    )
  }, [goblinRepository, partyRepository, baseStateRepository])

  // オフライン自動周回はPT単位の外側トランザクションでまとめるため、
  // UseCase側では新しいトランザクションを開始しない。
  const completeCatchUpExpeditionUseCase = useMemo(() => {
    return new CompleteExpeditionUseCase(
      goblinRepository,
      partyRepository,
      baseStateRepository,
      equipmentRepository,
      expeditionRepository,
      undefined,
      equipmentAutoSellFilterRepository,
    )
  }, [goblinRepository, partyRepository, baseStateRepository])

  const getPartyExpeditionTimeMultiplier = useCallback(async (party: Party): Promise<number> => {
    const members = (
      await Promise.all(party.memberIds.map((id) => goblinRepository.getGoblin(id)))
    ).filter((goblin): goblin is NonNullable<typeof goblin> => goblin !== null)

    if (members.length === 0) {
      return 1
    }

    const skillSets = await Promise.all(members.map(async (goblin) => {
      const equippedItems = await equipmentRepository.getByGoblinId(goblin.id)
      const equipmentSkills = EquipmentService.collectGrantedSkills(equippedItems)
      return [...goblin.skills, ...equipmentSkills]
    }))

    return getExpeditionTimeMultiplierFromSkills(skillSets.flat())
  }, [equipmentRepository, goblinRepository])

  const handleDungeonClear = useCallback(async (record: ExpeditionRecord) => {
    if (!record.replay || isPendingLoading || isBaseLoading) return

    const dungeon = areasData.find(area => area.id === record.dungeonId)
    if (!dungeon) return

    const tier = record.replay.meta.tier as DungeonTier | undefined
    const maxClearedFloor = getMaxClearedFloorFromReplay(record.replay)
    if (maxClearedFloor > 0) {
      await markDungeonFloorCleared(dungeon, maxClearedFloor, tier)
    }

    const cleared = isDungeonCompleted(record.replay) &&
      maxClearedFloor >= dungeon.floors
    if (!cleared) return

    await markDungeonCleared(dungeon, true, tier)
    await checkAndUnlockStories(dungeon.id)

    // チュートリアル: 初回スライム洞窟クリアで結果画面へ誘導し、因子の説明ステップへ進める
    if (dungeon.id === 'slime_cave' && useTutorialStore.getState().step === 'wait_clear') {
      await useTutorialStore.getState().advanceTo('learn_factor')
      router.push({
        pathname: '/formation/result',
        params: { expeditionId: record.id, partyId: record.partyId.toString() },
      })
    }

    const nextId = await getNextGoblinId()
    const areaLevel = record.replay.meta.effectiveAreaLevel ??
      getDungeonTierAreaLevel(dungeon.areaLevel ?? 1, tier ?? 0)
    const latestGoblins = (
      await Promise.all(record.replay.meta.party.map(id => goblinRepository.getGoblin(Number.parseInt(id, 10))))
    ).filter((goblin): goblin is NonNullable<typeof goblin> => goblin !== null)
    const goblinBirthService = new GoblinBirthService()
    const newGoblin = goblinBirthService.createNewGoblin(
      nextId,
      undefined,
      latestGoblins.length > 0 ? latestGoblins : goblins,
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
    goblinRepository,
    goblins,
    isBaseLoading,
    isPendingLoading,
    markDungeonCleared,
    markDungeonFloorCleared,
    rank,
  ])

  const estimateExplorationTime = useCallback((
    dungeon: Dungeon,
    returnPolicy: ExpeditionRequest['returnPolicy'],
    targetFloor: number | null = null,
    partyExpeditionTimeMultiplier: number = 1,
    goldenAcornUsed: boolean = false,
    tier: DungeonTier = 0,
    ignoreInstantDungeonExploration: boolean = false,
  ): number => {
    if (instantDungeonExploration && !ignoreInstantDungeonExploration) {
      return 1
    }

    const tierCleared = (dungeon.maxClearedTier ?? 0) > tier
    const fullFirstTime = computeDungeonExplorationTime(
      dungeon.id,
      dungeon.exploration_time_sec_first,
      dungeon.exploration_time_sec,
      tier,
      false,
    )
    const fullClearedTime = computeDungeonExplorationTime(
      dungeon.id,
      dungeon.exploration_time_sec_first,
      dungeon.exploration_time_sec,
      tier,
      true,
    )
    const multiplierMap: Record<ExpeditionRequest['returnPolicy'], number> = {
      never: 1.0,
      if_any_ko: 0.7,
      if_two_ko: 0.75,
      last_one: 0.9,
    }
    const multiplier = multiplierMap[returnPolicy] ?? 1.0
    const normalizedTargetFloor = typeof targetFloor === 'number' && Number.isFinite(targetFloor)
      ? Math.max(1, Math.min(dungeon.floors, Math.floor(targetFloor)))
      : dungeon.floors
    const maxClearedFloor = tierCleared
      ? dungeon.floors
      : Math.max(0, Math.min(
          dungeon.floors,
          Math.floor(dungeon.maxClearedFloorsByTier?.[tier] ?? 0),
        ))
    const clearedTargetFloors = Math.min(normalizedTargetFloor, maxClearedFloor)
    const unclearedTargetFloors = normalizedTargetFloor - clearedTargetFloors
    const baseTime = (
      fullClearedTime * clearedTargetFloors +
      fullFirstTime * unclearedTargetFloors
    ) / dungeon.floors
    const speedMultiplier = getSpeedMultiplier()
    const monthlyPassSpeed = hasMonthlyPass() ? MONTHLY_PASS_SPEED_MULTIPLIER : 1
    const goldenAcornSpeed = goldenAcornUsed ? GOLDEN_ACORN_SPEED_MULTIPLIER : 1
    return Math.floor(
      baseTime * multiplier * speedMultiplier * partyExpeditionTimeMultiplier * monthlyPassSpeed * goldenAcornSpeed,
    )
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
    async (
      { party, dungeon, returnPolicy, targetFloor = null, tier, useGoldenAcorn = false, startTime: requestedStartTime }: StartExpeditionInput,
      options: ExpeditionMutationOptions = {},
    ): Promise<StartExpeditionResult> => {
      const trackProcessing = options.trackProcessing !== false
      const persistRecord = options.persistRecord !== false
      if (trackProcessing) {
        setIsProcessing(true)
      }
      const syncStores = options.syncStores !== false
      const debugInstantAcorn = useDebugSettingsStore.getState().instantGoldenAcorn
      let acornConsumed = false
      try {
        if (useGoldenAcorn) {
          if (debugInstantAcorn) {
            // デバッグ時は消費せずに効果のみ適用
            acornConsumed = false
          } else {
            const success = await usePurchaseStore.getState().useTicket(TICKET_TYPES.GOLDEN_ACORN)
            if (!success) {
              throw new Error('金のドングリの残数が不足しています')
            }
            acornConsumed = true
          }
        }

        const partyExpeditionTimeMultiplier = await getPartyExpeditionTimeMultiplier(party)
        const isTutorialSlimeLaunch =
          dungeon.id === 'slime_cave' &&
          useTutorialStore.getState().step === 'start_expedition'
        const durationSec = isTutorialSlimeLaunch ? 3 : estimateExplorationTime(
          dungeon,
          returnPolicy,
          targetFloor,
          partyExpeditionTimeMultiplier,
          useGoldenAcorn,
          tier ?? 0,
        )
        const simulationDurationSec = isTutorialSlimeLaunch ? durationSec : estimateExplorationTime(
          dungeon,
          returnPolicy,
          targetFloor,
          partyExpeditionTimeMultiplier,
          useGoldenAcorn,
          tier ?? 0,
          true,
        )
        const request: ExpeditionRequest = {
          partyId: party.id.toString(),
          areaId: dungeon.id,
          tier,
          targetFloor,
          returnPolicy,
          clientVersion: 'native',
          autoExpeditionSessionId: party.autoExpeditionEnabled
            ? party.autoExpeditionSessionId
            : undefined,
          durationSec,
          simulationDurationSec,
        }

        const boost = getExpeditionBoost(useGoldenAcorn)
        const expeditionMeta = await startExpeditionUseCase.execute(request, boost)
        const startTime = requestedStartTime ?? new Date()
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

        if (persistRecord) {
          if (syncStores) {
            await saveExpeditionRecord(record)
            // UseCaseがDB上のparty.statusと出発時HPを直接更新するため、ストアを同期
            await usePartyStore.getState().refresh()
            await useGoblinStore.getState().refresh()
          } else {
            await expeditionRepository.save(record)
          }

          // チュートリアル: スライム洞窟への出撃でクリア待ちステップへ
          if (dungeon.id === 'slime_cave') {
            await useTutorialStore.getState().advanceTo('wait_clear')
          }

          // 通常遠征のみローカル通知をスケジュール（自動周回は通知フック側で除外）
          try {
            await scheduleExpeditionNotification(record)
          } catch {
            // 通知スケジュール失敗はゲーム進行に影響させない
          }
        }

        return { record }
      } catch (error) {
        // UseCase 失敗時に消費したドングリを戻す
        if (acornConsumed) {
          try {
            await usePurchaseStore.getState().addTickets(TICKET_TYPES.GOLDEN_ACORN, 1)
          } catch (rollbackError) {
            console.warn('[useExpeditionFlow] Failed to rollback golden acorn', rollbackError)
          }
        }
        throw error
      } finally {
        if (trackProcessing) {
          setIsProcessing(false)
        }
      }
    },
    [estimateExplorationTime, getPartyExpeditionTimeMultiplier, saveExpeditionRecord, startExpeditionUseCase, scheduleExpeditionNotification],
  )

  const startNextAutoExpedition = useCallback(async (
    partyId: number,
    preferredStartTime: Date,
    options: ExpeditionMutationOptions = {},
  ): Promise<StartExpeditionResult | null> => {
    if (autoStartingPartyIdsRef.current.has(partyId)) return null
    autoStartingPartyIdsRef.current.add(partyId)
    const syncStores = options.syncStores !== false

    try {
      const party = await partyRepository.getParty(partyId)
      if (!party?.autoExpeditionEnabled || (party.status ?? 'idle') !== 'idle') return null
      if (party.memberIds.length === 0 || !party.dungeonId) return null

      const dungeon = useDungeonStore.getState().dungeons.find(item => item.id === party.dungeonId)
      const tier = party.dungeonTier ?? 0
      if (!isAutoExpeditionDungeonCleared(dungeon, tier)) return null
      if (!dungeon) return null

      const partyTimeMultiplier = await getPartyExpeditionTimeMultiplier(party)
      const durationSec = estimateExplorationTime(
        dungeon,
        party.returnPolicy ?? 'never',
        party.targetFloor ?? null,
        partyTimeMultiplier,
        false,
        tier,
        true,
      )
      if (durationSec <= 0) return null

      try {
        return await startExpedition({
          party,
          dungeon,
          returnPolicy: party.returnPolicy ?? 'never',
          targetFloor: party.targetFloor ?? null,
          tier,
          startTime: preferredStartTime,
        }, options)
      } catch (error) {
        // 出撃処理の途中で失敗した場合はPTを待機状態へ戻す。
        await partyRepository.saveParty({ ...party, status: 'idle' })
        if (syncStores) {
          await usePartyStore.getState().refresh()
        }
        console.warn('[useExpeditionFlow] Failed to start auto expedition', error)
        return null
      }
    } finally {
      autoStartingPartyIdsRef.current.delete(partyId)
    }
  }, [estimateExplorationTime, getPartyExpeditionTimeMultiplier, partyRepository, startExpedition])

  interface BulkStartResult {
    startedCount: number
    skippedReasons: string[]
  }

  const startBulkExpedition = useCallback(
    async (inputs: StartExpeditionInput[]): Promise<BulkStartResult> => {
      setIsProcessing(true)
      const records: ExpeditionRecord[] = []
      const skippedReasons: string[] = []
      const debugInstantAcorn = useDebugSettingsStore.getState().instantGoldenAcorn
      let acornsConsumed = 0

      try {
        for (const { party, dungeon, returnPolicy, targetFloor = null, tier, useGoldenAcorn = false } of inputs) {
          let acornAppliedForThisInput = false
          if (useGoldenAcorn) {
            if (debugInstantAcorn) {
              acornAppliedForThisInput = true
            } else {
              const success = await usePurchaseStore.getState().useTicket(TICKET_TYPES.GOLDEN_ACORN)
              if (success) {
                acornsConsumed++
                acornAppliedForThisInput = true
              } else {
                skippedReasons.push(`${party.name}: 金のドングリの残数が不足`)
                continue
              }
            }
          }

          const partyExpeditionTimeMultiplier = await getPartyExpeditionTimeMultiplier(party)
          const durationSec = estimateExplorationTime(
            dungeon,
            returnPolicy,
            targetFloor,
            partyExpeditionTimeMultiplier,
            acornAppliedForThisInput,
            tier ?? 0,
          )
          const simulationDurationSec = estimateExplorationTime(
            dungeon,
            returnPolicy,
            targetFloor,
            partyExpeditionTimeMultiplier,
            acornAppliedForThisInput,
            tier ?? 0,
            true,
          )
          const request: ExpeditionRequest = {
            partyId: party.id.toString(),
            areaId: dungeon.id,
            tier,
            targetFloor,
            returnPolicy,
            clientVersion: 'native',
            autoExpeditionSessionId: party.autoExpeditionEnabled
              ? party.autoExpeditionSessionId
              : undefined,
            durationSec,
            simulationDurationSec,
          }

          try {
            const boost = getExpeditionBoost(acornAppliedForThisInput)
            const expeditionMeta = await startExpeditionUseCase.execute(request, boost)
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
            // UseCase 失敗時はそのパーティ分のドングリを戻す
            if (acornAppliedForThisInput && !debugInstantAcorn) {
              try {
                await usePurchaseStore.getState().addTickets(TICKET_TYPES.GOLDEN_ACORN, 1)
                acornsConsumed--
              } catch (rollbackError) {
                console.warn('[useExpeditionFlow] Failed to rollback golden acorn (bulk)', rollbackError)
              }
            }
          }
        }

        if (records.length > 0) {
          await saveBulkExpeditionRecords(records)
          await usePartyStore.getState().refresh()
          await useGoblinStore.getState().refresh()

          // 通常遠征のみ通知をスケジュール（自動周回は通知フック側で除外）
          for (const record of records) {
            try {
              await scheduleExpeditionNotification(record)
            } catch {
              // 通知スケジュール失敗はゲーム進行に影響させない
            }
          }
        }

        return { startedCount: records.length, skippedReasons }
      } finally {
        // 参考用カウンタは利用しないが、消費数を上位で見たい場合に備えてログのみ出す
        if (acornsConsumed > 0) {
          console.log(`[useExpeditionFlow] Golden acorn consumed (bulk): ${acornsConsumed}`)
        }
        setIsProcessing(false)
      }
    },
    [estimateExplorationTime, getPartyExpeditionTimeMultiplier, saveBulkExpeditionRecords, startExpeditionUseCase, scheduleExpeditionNotification],
  )

  const updateExpeditionReplay = useExpeditionStore((state) => state.updateExpeditionReplay)

  const abortExpedition = useCallback(async (record: ExpeditionRecord): Promise<void> => {
    setIsProcessing(true)
    try {
      const party = await partyRepository.getParty(record.partyId)
      if (party?.autoExpeditionEnabled) {
        await partyRepository.saveParty({ ...party, autoExpeditionEnabled: false })
      }
      // replay が未計算の場合は遅延計算を実行
      let replay = record.replay
      if (!replay && record.expeditionMeta) {
        replay = await computeExpeditionReplay(record.expeditionMeta)
        await updateExpeditionReplay(record.id, replay)
      }
      if (!replay) return

      // 経過時間の割合でリプレイを途中で切断
      const now = new Date()
      const startMs = record.startTime.getTime()
      const returnMs = record.returnTime ? record.returnTime.getTime() : startMs
      const totalMs = returnMs - startMs
      const elapsedRatio = totalMs > 0
        ? Math.min(1, Math.max(0, (now.getTime() - startMs) / totalMs))
        : 0
      const cutoffSec = elapsedRatio * replay.durationSec

      // cutoffSec 以前のイベントのみ残し、元の return イベントを除外
      const truncatedEvents = replay.events.filter(
        e => e.type !== 'return' && e.at <= cutoffSec
      )
      // abort の return イベントを追加
      truncatedEvents.push({ type: 'return', at: cutoffSec, reason: 'abort' as const })

      // 切断されたイベントから summary を再計算
      let xpGained = 0
      let goldGained = 0
      let maxFloorReached = 1
      const truncatedTreasureDrops: typeof replay.summary.treasureDrops = []
      const casualtyIds: string[] = []

      // HP追跡用
      const hpState = replay.meta.party.map((id) => {
        const snapshot = replay!.meta.partySnapshot?.find(g => g.id === Number.parseInt(id, 10))
        return snapshot?.currentHp ?? 999
      })

      for (const event of truncatedEvents) {
        if (event.type === 'battle' || event.type === 'boss') {
          if (event.combat.outcome === 'win') xpGained += event.xp
          goldGained += event.enemy.gold
          maxFloorReached = Math.max(maxFloorReached, event.floor)
          event.combat.allyHPDelta.forEach((delta, i) => {
            if (i < hpState.length) hpState[i] = Math.max(0, hpState[i] + delta)
          })
        } else if (event.type === 'floor_up') {
          maxFloorReached = Math.max(maxFloorReached, event.to)
        } else if (event.type === 'treasure') {
          truncatedTreasureDrops.push(...event.items)
        }
      }

      // HP0のメンバーを casualties に追加
      replay.meta.party.forEach((id, i) => {
        if (hpState[i] <= 0) casualtyIds.push(id)
      })

      const truncatedReplay: typeof replay = {
        ...replay,
        durationSec: cutoffSec,
        events: truncatedEvents,
        summary: {
          success: false,
          maxFloorReached,
          xpGained,
          goldGained,
          casualties: casualtyIds,
          treasureDrops: truncatedTreasureDrops.length > 0 ? truncatedTreasureDrops : undefined,
        },
      }

      // abort モードで完了処理（Gold・アイテム・因子・制圧をスキップ）。
      // status 確定・enrichedReplay 保存・報酬付与を UseCase 内で 1 トランザクション実行。
      const result = await completeExpeditionUseCase.execute(record.partyId, truncatedReplay, {
        isAbort: true,
        expeditionId: record.id,
      })
      // 既に完了済み（自動完了等）ならストア再取得も不要
      if (result.alreadyProcessed) return

      // スケジュール済み通知をキャンセル
      await cancelExpeditionNotification(record.id)

      // 履歴の剪定とストア再取得
      await finalizeCompletion()

      // ストアを同期
      await usePartyStore.getState().refresh()
      await useGoblinStore.getState().refresh()
    } finally {
      setIsProcessing(false)
    }
  }, [completeExpeditionUseCase, finalizeCompletion, updateExpeditionReplay, cancelExpeditionNotification, partyRepository])

  const completeDueExpeditions = useCallback(async (): Promise<void> => {
    if (completionRunningRef.current) return
    completionRunningRef.current = true

    const now = new Date()
    const dueExpeditions = expeditionRecords.filter(record =>
      record.status === 'ongoing' &&
      record.returnTime &&
      record.returnTime <= now &&
      (record.replay || record.expeditionMeta)
    )
    const catchUpPartyIds = dueExpeditions
      .filter(isAutoExpeditionRecord)
      .map(record => record.partyId)
    const isCatchingUp = catchUpPartyIds.length > 0
    if (isCatchingUp) {
      useExpeditionStore.getState().setCatchUpProcessing(true, catchUpPartyIds)
    }
    let requiresStoreSync = false

    try {
      for (const dueExpedition of dueExpeditions) {
        if (isAutoExpeditionRecord(dueExpedition)) {
          const processingRecordIds: string[] = []
          let completedRunCount = 0
          const catchUpStartedAt = Date.now()
          try {
            // オフライン分はPT単位の1トランザクションで精算する。
            // 中間周回は履歴へ保存せず、最終的に進行中となる1周だけを保存する。
            await transactionRunner.runInTransaction(async () => {
              let record: ExpeditionRecord | null = dueExpedition
              let recordPersisted = true

              while (
                record?.status === 'ongoing' &&
                record.returnTime !== null &&
                record.returnTime <= now
              ) {
                if (processedExpeditionsRef.current.has(record.id)) break
                const processingRecordId = record.id
                processedExpeditionsRef.current.add(processingRecordId)
                processingRecordIds.push(processingRecordId)

                let replay = record.replay
                if (!replay && record.expeditionMeta) {
                  replay = await computeExpeditionReplay(record.expeditionMeta)
                }
                if (!replay) {
                  throw new Error(`Replay could not be computed: ${record.id}`)
                }

                const result = await completeCatchUpExpeditionUseCase.execute(record.partyId, replay, {
                  expeditionId: recordPersisted ? record.id : undefined,
                })
                if (result.alreadyProcessed) {
                  record = null
                  break
                }
                completedRunCount++

                if (isAutoExpeditionDayBoundaryRun(record)) {
                  // 日付をまたいだ周回を最終周とし、設定はONのまま次周だけを作成しない。
                  record = null
                  break
                }

                const next = await startNextAutoExpedition(
                  record.partyId,
                  record.returnTime,
                  {
                    syncStores: false,
                    persistRecord: false,
                    trackProcessing: false,
                  },
                )
                record = next?.record ?? null
                recordPersisted = false
              }

              // 復帰時点でまだ進行中となる最終周だけを履歴へ残す。
              if (record && !recordPersisted) {
                await expeditionRepository.save(record)
              }
            })
            requiresStoreSync = true
            // 中間周回はDBに存在しないため、重複防止Setへ残さない。
            processingRecordIds
              .filter(id => id !== dueExpedition.id)
              .forEach(id => processedExpeditionsRef.current.delete(id))
            await cancelExpeditionNotification(dueExpedition.id)
            await expeditionRepository.pruneOldCompleted(MAX_EXPEDITION_HISTORY)
            console.info(
              `[AutoExpeditionCatchUp] party=${dueExpedition.partyId} runs=${completedRunCount} elapsedMs=${Date.now() - catchUpStartedAt}`,
            )
          } catch (error) {
            processingRecordIds.forEach(id => processedExpeditionsRef.current.delete(id))
            console.warn('[useExpeditionFlow] Failed to settle auto expedition catch-up', error)
          }
          // 長い集計でもPT間で描画・入力処理へ制御を返す。
          await new Promise<void>(resolve => setTimeout(resolve, 0))
          continue
        }

        if (processedExpeditionsRef.current.has(dueExpedition.id)) continue
        processedExpeditionsRef.current.add(dueExpedition.id)
        try {
          let replay = dueExpedition.replay
          if (!replay && dueExpedition.expeditionMeta) {
            replay = await computeExpeditionReplay(dueExpedition.expeditionMeta)
          }
          if (!replay) {
            processedExpeditionsRef.current.delete(dueExpedition.id)
            continue
          }

          // 通常遠征は従来どおり1件の履歴として完了させる。
          const result = await completeExpeditionUseCase.execute(dueExpedition.partyId, replay, {
            expeditionId: dueExpedition.id,
          })
          requiresStoreSync = true
          if (result.alreadyProcessed) continue

          await cancelExpeditionNotification(dueExpedition.id)
          await expeditionRepository.pruneOldCompleted(MAX_EXPEDITION_HISTORY)

          if (result.newDungeonCaptured) {
            const dungeon = areasData.find(d => d.id === result.newDungeonCaptured)
            if (dungeon?.isBaseCapture) {
              Alert.alert(
                i18n.t('ui.result.baseCaptured'),
                i18n.t('ui.result.baseCapturedHint', { name: getDungeonName(dungeon) }),
                [{ text: 'OK' }]
              )
            }
          }

          await handleDungeonClear({ ...dueExpedition, replay: result.enrichedReplay })
        } catch (error) {
          processedExpeditionsRef.current.delete(dueExpedition.id)
          console.warn('[useExpeditionFlow] Failed to complete expedition', error)
        }
      }
    } finally {
      try {
        if (requiresStoreSync) {
          // 完了・次周開始の中間状態を見せず、全Storeを最終状態へ一度だけ同期する。
          await Promise.all([
            useExpeditionStore.getState().refresh(),
            useBaseStore.getState().refresh(),
            usePartyStore.getState().refresh(),
            useGoblinStore.getState().refresh(),
          ])
        }
      } finally {
        if (isCatchingUp) {
          useExpeditionStore.getState().setCatchUpProcessing(false)
        }
        completionRunningRef.current = false
      }
    }
  }, [
    expeditionRecords,
    completeExpeditionUseCase,
    completeCatchUpExpeditionUseCase,
    handleDungeonClear,
    cancelExpeditionNotification,
    startNextAutoExpedition,
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
        const floorReached = ongoing
          ? computeCurrentFloor(record, currentTime)
          : record.replay?.summary.maxFloorReached ?? 1
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
    const tick = async () => {
      await completeDueExpeditions()
    }
    void tick()
    const interval = setInterval(() => {
      void tick()
    }, 1000)
    return () => clearInterval(interval)
  }, [enableAutoCompletion, completeDueExpeditions])

  return {
    isProcessing,
    startExpedition,
    startBulkExpedition,
    abortExpedition,
    estimateExplorationTime,
    getPartyExpeditionTimeMultiplier,
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
