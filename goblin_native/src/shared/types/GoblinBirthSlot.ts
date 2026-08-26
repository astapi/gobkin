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
  sourceSnapshots: GoblinBirthSourceSnapshot[]
}
