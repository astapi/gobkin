import type { Goblin, GoblinStats } from '../../shared/types'

export interface BaseState {
  goblins: Goblin[]
  capacity: number
  rank: number
  now: number
  lastSpawnTime: number
  slimeCaveCleared: boolean
  firstBonusGranted: boolean
  nextGoblinId?: number
}

export interface BirthEvaluationResult {
  newborns: Goblin[]
  updatedLastSpawnTime: number
  firstBonusGranted: boolean
  nextGoblinId: number
  availableSlots: number
}

const BASE_SPAWN_INTERVAL_MS = 30 * 60 * 1000

const STAT_RANGES: Record<keyof GoblinStats, { min: number; max: number }> = {
  hp: { min: 55, max: 80 },
  atk: { min: 10, max: 16 },
  sp: { min: 7, max: 13 },
  spd: { min: 8, max: 14 },
  def: { min: 8, max: 14 },
}

export class BaseManagementService {
  private readonly random: () => number

  constructor(random: () => number = Math.random) {
    this.random = random
  }

  public evaluateBirths(state: BaseState): BirthEvaluationResult {
    const availableSlots = Math.max(0, state.capacity - state.goblins.length)
    if (availableSlots === 0) {
      return {
        newborns: [],
        updatedLastSpawnTime: state.lastSpawnTime,
        firstBonusGranted: state.firstBonusGranted,
        nextGoblinId: this.resolveNextId(state),
        availableSlots,
      }
    }

    let newborns: Goblin[] = []
    let lastSpawnTime = state.lastSpawnTime
    let firstBonusGranted = state.firstBonusGranted
    let nextGoblinId = this.resolveNextId(state)

    if (state.slimeCaveCleared && !firstBonusGranted && newborns.length < availableSlots) {
      newborns.push(this.createGoblin(nextGoblinId++))
      firstBonusGranted = true
      lastSpawnTime = Math.max(lastSpawnTime, state.now)
    }

    if (state.now > lastSpawnTime) {
      const intervals = Math.floor((state.now - lastSpawnTime) / BASE_SPAWN_INTERVAL_MS)
      if (intervals > 0 && newborns.length < availableSlots) {
        const spawnPerInterval = this.calculateSpawnCountByRank(state.rank)
        const totalSpawn = Math.min(availableSlots - newborns.length, intervals * spawnPerInterval)
        for (let i = 0; i < totalSpawn; i += 1) {
          newborns.push(this.createGoblin(nextGoblinId++))
        }
        lastSpawnTime += intervals * BASE_SPAWN_INTERVAL_MS
      }
    }

    return {
      newborns,
      updatedLastSpawnTime: lastSpawnTime,
      firstBonusGranted,
      nextGoblinId,
      availableSlots: Math.max(0, availableSlots - newborns.length),
    }
  }

  public expelGoblin(goblins: Goblin[], goblinId: number): Goblin[] {
    const exists = goblins.some(goblin => goblin.id === goblinId)
    if (!exists) {
      throw new Error(`ID ${goblinId} のゴブリンは存在しません`)
    }
    return goblins.filter(goblin => goblin.id !== goblinId)
  }

  private calculateSpawnCountByRank(rank: number): number {
    if (rank <= 1) return 1
    if (rank <= 3) return 2
    return 3
  }

  private createGoblin(id: number): Goblin {
    const stats = this.generateStats()
    return {
      id,
      name: `新生ゴブリン${id}`,
      race: 'ゴブリン',
      level: 1,
      avatar: '/avatars/goblin.png',
      stats,
      equipment: [0, 1, 2].map(slotIndex => ({ slotIndex, itemId: null })),
    }
  }

  private generateStats(): GoblinStats {
    return {
      hp: this.randomInRange('hp'),
      atk: this.randomInRange('atk'),
      sp: this.randomInRange('sp'),
      spd: this.randomInRange('spd'),
      def: this.randomInRange('def'),
    }
  }

  private randomInRange(key: keyof GoblinStats): number {
    const { min, max } = STAT_RANGES[key]
    const value = min + (max - min) * this.random()
    return Math.round(value)
  }

  private resolveNextId(state: BaseState): number {
    if (state.nextGoblinId !== undefined) {
      return state.nextGoblinId
    }
    const maxExistingId = state.goblins.reduce((max, goblin) => Math.max(max, goblin.id), 0)
    return maxExistingId + 1
  }
}
