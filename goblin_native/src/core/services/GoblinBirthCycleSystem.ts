import type { Goblin, GoblinBirthSlot, GoblinBirthSourceSnapshot } from '../../shared/types'

export const GOBLIN_BIRTH_DURATION_MS = 10 * 60 * 1000

export function pauseGoblinBirthSlotForCapacity(
  slot: GoblinBirthSlot,
  now: Date,
): GoblinBirthSlot {
  if (!slot.isActive || slot.capacityPausedAt) return slot
  const nowMs = now.getTime()
  const nextBirthAtMs = slot.nextBirthAt ? Date.parse(slot.nextBirthAt) : Number.NaN
  // 既に期限超過している旧データも、完成待ち1体だけを残して過去分を破棄する。
  // 再開時に複数回分を一気に精算しないための補正。
  const hasReadyBirth = Number.isFinite(nextBirthAtMs) && nextBirthAtMs <= nowMs
  return {
    ...slot,
    cycleStartedAt: hasReadyBirth
      ? new Date(nowMs - GOBLIN_BIRTH_DURATION_MS).toISOString()
      : slot.cycleStartedAt,
    nextBirthAt: hasReadyBirth ? now.toISOString() : slot.nextBirthAt,
    capacityPausedAt: now.toISOString(),
  }
}

export function resumeGoblinBirthSlotAfterCapacity(
  slot: GoblinBirthSlot,
  now: Date,
): GoblinBirthSlot {
  if (!slot.capacityPausedAt) return slot
  const pausedAtMs = Date.parse(slot.capacityPausedAt)
  const pausedDurationMs = Number.isFinite(pausedAtMs)
    ? Math.max(0, now.getTime() - pausedAtMs)
    : 0
  const shiftDate = (value: string | undefined): string | undefined => {
    if (!value) return undefined
    const timestamp = Date.parse(value)
    return Number.isFinite(timestamp)
      ? new Date(timestamp + pausedDurationMs).toISOString()
      : value
  }
  return {
    ...slot,
    cycleStartedAt: shiftDate(slot.cycleStartedAt),
    nextBirthAt: shiftDate(slot.nextBirthAt),
    capacityPausedAt: undefined,
  }
}

export function getMaxGoblinBirthSlots(baseRank: number): number {
  return Math.max(1, Math.floor(baseRank))
}

export function hasGoblinBirthSourceConflict(
  slots: readonly GoblinBirthSlot[],
  slotIndex: number,
  sourceGoblinIds: readonly number[],
): boolean {
  const assignedToOtherSlots = new Set(
    slots
      .filter((slot) => slot.slotIndex !== slotIndex)
      .map((slot) => slot.sourceGoblinId),
  )
  return sourceGoblinIds.some((goblinId) => assignedToOtherSlots.has(goblinId))
}

export function createGoblinBirthSourceSnapshot(goblin: Goblin): GoblinBirthSourceSnapshot {
  return {
    goblinId: goblin.id,
    plusValue: Math.max(0, Math.floor(goblin.plusValue ?? 0)),
    factors: [...new Set(goblin.factors ?? [])],
  }
}

export function calculateBirthPlusValue(
  snapshots: readonly GoblinBirthSourceSnapshot[],
): number {
  if (snapshots.length === 0) return 1
  return Math.max(...snapshots.map((snapshot) => snapshot.plusValue)) + 1
}

export function selectRandomBirthPartner(
  goblins: readonly Goblin[],
  sourceGoblinId: number,
  rng: () => number = Math.random,
): Goblin | undefined {
  const candidates = goblins.filter((goblin) => goblin.id !== sourceGoblinId)
  if (candidates.length === 0) return undefined
  return candidates[Math.floor(rng() * candidates.length)]
}

export function collectBirthSourceFactorIds(
  snapshots: readonly GoblinBirthSourceSnapshot[],
): string[] {
  return [...new Set(snapshots.flatMap((snapshot) => snapshot.factors))]
}
