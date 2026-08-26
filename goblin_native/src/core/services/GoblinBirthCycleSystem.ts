import type { Goblin, GoblinBirthSlot, GoblinBirthSourceSnapshot } from '../../shared/types'

export const GOBLIN_BIRTH_DURATION_MS = 10 * 60 * 1000

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
