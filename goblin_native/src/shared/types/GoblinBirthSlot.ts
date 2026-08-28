export interface GoblinBirthSourceSnapshot {
  goblinId: number
  plusValue: number
  factors: string[]
}

export interface GoblinBirthSlot {
  slotIndex: number
  sourceGoblinId: number
  isActive: boolean
  cycleStartedAt?: string
  nextBirthAt?: string
  /** 待機枠満杯によって進行を停止した時刻。 */
  capacityPausedAt?: string
  sourceSnapshots: GoblinBirthSourceSnapshot[]
}
