import { create } from 'zustand'
import type { GoblinBirthSlot, GoblinBirthSourceSnapshot } from '../../shared/types'
import {
  GOBLIN_BIRTH_DURATION_MS,
  calculateBirthPlusValue,
  collectBirthSourceFactorIds,
  createGoblinBirthSourceSnapshot,
  getMaxGoblinBirthSlots,
  hasGoblinBirthSourceConflict,
  pauseGoblinBirthSlotForCapacity,
  resumeGoblinBirthSlotAfterCapacity,
  selectRandomBirthPartner,
} from '../../core/services/GoblinBirthCycleSystem'
import { GoblinBirthService } from '../../core/services/GoblinBirthService'
import {
  baseStateRepository,
  goblinBirthSlotRepository,
  goblinRepository,
  pendingGoblinRepository,
  transactionRunner,
} from '../di/repositories'
import { useBaseStore } from './useBaseStore'

interface GoblinBirthState {
  slots: GoblinBirthSlot[]
  isLoading: boolean
  isSettling: boolean
}

interface GoblinBirthActions {
  initialize: () => Promise<void>
  refresh: () => Promise<void>
  configureSlot: (slotIndex: number, sourceGoblinId: number) => Promise<void>
  startSlot: (slotIndex: number, now?: Date) => Promise<void>
  stopSlot: (slotIndex: number) => Promise<void>
  syncCapacityPause: (isCapacityFull: boolean, now?: Date) => Promise<void>
  settleDueBirths: (now?: Date) => Promise<void>
}

let settlementPromise: Promise<void> | null = null
let capacitySyncPromise: Promise<void> | null = null

function sortSlots(slots: GoblinBirthSlot[]): GoblinBirthSlot[] {
  return [...slots].sort((a, b) => a.slotIndex - b.slotIndex)
}

async function loadCycleSnapshots(sourceGoblinId: number): Promise<GoblinBirthSourceSnapshot[] | null> {
  const goblins = await goblinRepository.getGoblins()
  const sourceGoblin = goblins.find((goblin) => goblin.id === sourceGoblinId)
  if (!sourceGoblin) return null

  const randomPartner = selectRandomBirthPartner(goblins, sourceGoblinId)
  if (!randomPartner) {
    const isMarkAlone = goblins.length === 1 && sourceGoblin.id === 0
    return isMarkAlone ? [createGoblinBirthSourceSnapshot(sourceGoblin)] : null
  }
  return [
    createGoblinBirthSourceSnapshot(sourceGoblin),
    createGoblinBirthSourceSnapshot(randomPartner),
  ]
}

export const useGoblinBirthStore = create<GoblinBirthState & GoblinBirthActions>()((set, get) => ({
  slots: [],
  isLoading: true,
  isSettling: false,

  initialize: async () => {
    const slots = await goblinBirthSlotRepository.getAll()
    set({ slots: sortSlots(slots), isLoading: false })
  },

  refresh: async () => {
    const slots = await goblinBirthSlotRepository.getAll()
    set({ slots: sortSlots(slots) })
  },

  configureSlot: async (slotIndex, sourceGoblinId) => {
    const configuredSlots = await goblinBirthSlotRepository.getAll()
    const current = configuredSlots.find((slot) => slot.slotIndex === slotIndex)
    const newlyAssignedGoblinIds = current?.sourceGoblinId === sourceGoblinId
      ? []
      : [sourceGoblinId]
    if (hasGoblinBirthSourceConflict(configuredSlots, slotIndex, newlyAssignedGoblinIds)) {
      throw new Error('別の枠に設定済みのゴブリンは選べません')
    }
    const baseState = await baseStateRepository.getBaseState()
    if (!baseState || slotIndex < 1 || slotIndex > getMaxGoblinBirthSlots(baseState.rank)) {
      throw new Error('この枠はまだ利用できません')
    }
    if (current?.isActive) {
      throw new Error('稼働中の枠は変更できません')
    }
    const sourceGoblin = await goblinRepository.getGoblin(sourceGoblinId)
    if (!sourceGoblin) throw new Error('選択したゴブリンが見つかりません')

    await goblinBirthSlotRepository.save({
      slotIndex,
      sourceGoblinId,
      isActive: false,
      sourceSnapshots: [],
      capacityPausedAt: undefined,
    })
    await get().refresh()
  },

  startSlot: async (slotIndex, now = new Date()) => {
    const slot = get().slots.find((candidate) => candidate.slotIndex === slotIndex)
    if (!slot) throw new Error('継承元のゴブリンを選んでください')
    if (slot.isActive) return

    const snapshots = await loadCycleSnapshots(slot.sourceGoblinId)
    if (!snapshots) throw new Error('継承元以外の拠点ゴブリンが見つかりません')
    const startedAt = now.toISOString()
    await goblinBirthSlotRepository.save({
      ...slot,
      isActive: true,
      cycleStartedAt: startedAt,
      nextBirthAt: new Date(now.getTime() + GOBLIN_BIRTH_DURATION_MS).toISOString(),
      sourceSnapshots: snapshots,
      capacityPausedAt: undefined,
    })
    await get().refresh()
  },

  stopSlot: async (slotIndex) => {
    const slot = get().slots.find((candidate) => candidate.slotIndex === slotIndex)
    if (!slot) return
    await goblinBirthSlotRepository.save({
      ...slot,
      isActive: false,
      cycleStartedAt: undefined,
      nextBirthAt: undefined,
      sourceSnapshots: [],
      capacityPausedAt: undefined,
    })
    await get().refresh()
  },

  syncCapacityPause: async (isCapacityFull, now = new Date()) => {
    const previousSync = capacitySyncPromise ?? Promise.resolve()
    const sync = previousSync.catch(() => undefined).then(async () => {
      if (settlementPromise) await settlementPromise
      const slots = await goblinBirthSlotRepository.getAll()
      const updatedSlots = slots.map((slot) => isCapacityFull
        ? pauseGoblinBirthSlotForCapacity(slot, now)
        : resumeGoblinBirthSlotAfterCapacity(slot, now))
      const changedSlots = updatedSlots.filter((slot, index) => slot !== slots[index])
      if (changedSlots.length === 0) return
      await transactionRunner.runInTransaction(async () => {
        for (const slot of changedSlots) {
          await goblinBirthSlotRepository.save(slot)
        }
      })
      set({ slots: sortSlots(updatedSlots) })
    })
    capacitySyncPromise = sync
    try {
      await sync
    } finally {
      if (capacitySyncPromise === sync) capacitySyncPromise = null
    }
  },

  settleDueBirths: async (now = new Date()) => {
    if (settlementPromise) {
      await settlementPromise
      return
    }

    const settle = async () => {
      set({ isSettling: true })
      let addedCount = 0
      try {
        const baseState = await baseStateRepository.getBaseState()
        if (!baseState) return
        const maxPending = baseState.rank * 5
        const nowMs = now.getTime()
        const dueSlots = (await goblinBirthSlotRepository.getAll())
          .filter((slot) => slot.isActive && !slot.capacityPausedAt && slot.nextBirthAt)

        // オフライン経過分は、枠ごとの次回時刻が古い順に1体ずつ処理する。
        // 1枠の蓄積だけで待機枠を占有し、ほかの枠が飢餓状態になるのを防ぐ。
        while (dueSlots.length > 0) {
          dueSlots.sort((a, b) => Date.parse(a.nextBirthAt!) - Date.parse(b.nextBirthAt!))
          const slot = dueSlots[0]
          if (!slot.nextBirthAt || Date.parse(slot.nextBirthAt) > nowMs) break

          const pendingBeforeBirth = await pendingGoblinRepository.getPendingGoblins()
          if (pendingBeforeBirth.length >= maxPending) break
          if (slot.sourceSnapshots.length < 1 || slot.sourceSnapshots.length > 2) {
            await goblinBirthSlotRepository.save({
              ...slot,
              isActive: false,
              cycleStartedAt: undefined,
              nextBirthAt: undefined,
              sourceSnapshots: [],
              capacityPausedAt: undefined,
            })
            dueSlots.shift()
            continue
          }

          const nextId = await baseStateRepository.getAndIncrementNextGoblinId()
          const newGoblin = new GoblinBirthService().createNewGoblinFromFactorSources(
            nextId,
            calculateBirthPlusValue(slot.sourceSnapshots),
            collectBirthSourceFactorIds(slot.sourceSnapshots),
            baseState.rank,
          )
          const nextSnapshots = await loadCycleSnapshots(slot.sourceGoblinId)
          const completedAtMs = Date.parse(slot.nextBirthAt)
          const nextSlot: GoblinBirthSlot = nextSnapshots
            ? {
                ...slot,
                cycleStartedAt: new Date(completedAtMs).toISOString(),
                nextBirthAt: new Date(completedAtMs + GOBLIN_BIRTH_DURATION_MS).toISOString(),
                sourceSnapshots: nextSnapshots,
                capacityPausedAt: undefined,
              }
            : {
                ...slot,
                isActive: false,
                cycleStartedAt: undefined,
                nextBirthAt: undefined,
                sourceSnapshots: [],
                capacityPausedAt: undefined,
              }

          let saved = false
          await transactionRunner.runInTransaction(async () => {
            const latestPending = await pendingGoblinRepository.getPendingGoblins()
            if (latestPending.length >= maxPending) return
            const latestSlot = (await goblinBirthSlotRepository.getAll())
              .find((candidate) => candidate.slotIndex === slot.slotIndex)
            if (!latestSlot?.isActive || latestSlot.nextBirthAt !== slot.nextBirthAt) return
            await pendingGoblinRepository.addPendingGoblin(newGoblin)
            await goblinBirthSlotRepository.save(nextSlot)
            saved = true
          })

          if (!saved) break
          addedCount++
          if (nextSlot.isActive && nextSlot.nextBirthAt) {
            dueSlots[0] = nextSlot
          } else {
            dueSlots.shift()
          }
        }
      } finally {
        const slots = await goblinBirthSlotRepository.getAll()
        set({ slots: sortSlots(slots), isSettling: false })
        if (addedCount > 0) {
          await useBaseStore.getState().refreshPendingGoblins()
        }
      }
    }

    settlementPromise = settle().finally(() => {
      settlementPromise = null
    })
    await settlementPromise
  },
}))
