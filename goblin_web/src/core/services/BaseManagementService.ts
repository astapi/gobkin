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

const BASE_SPAWN_INTERVAL_MS = 10 * 1000 // デバッグ用: 10秒

const STAT_RANGES: Record<keyof GoblinStats, { min: number; max: number }> = {
  hp: { min: 55, max: 80 },
  atk: { min: 10, max: 16 },
  sp: { min: 7, max: 13 },
  spd: { min: 8, max: 14 },
  def: { min: 8, max: 14 },
}

const GOBLIN_NAMES = [
  'グリム', 'ゴブタ', 'ボブ', 'ゴロー', 'クロ', 'シロ', 'アカ', 'アオ',
  'キバ', 'ツメ', 'ガブ', 'ノロ', 'チビ', 'デカ', 'ハゲ', 'ケモ',
  'ヒゲ', 'ミミ', 'ハナ', 'メガ', 'グラ', 'ガラ', 'ゴロン', 'ギロ',
  'ゴブリ', 'ゴブ太', 'ゴブ助', 'ゴブ蔵', 'ゴブ吉', 'ゴブ平', 'ゴブ右衛門', 'ゴブ左衛門',
  'グルグル', 'ゴツゴツ', 'ギザギザ', 'ガサガサ', 'ゴソゴソ', 'ガタガタ', 'ゴロゴロ', 'ギリギリ',
  'ブブ', 'ババ', 'ビビ', 'ベベ', 'ボボ', 'パパ', 'ピピ', 'ペペ',
  'ガッツ', 'ガンツ', 'ゴンツ', 'グンツ', 'ゲンツ', 'ギンツ', 'ゴロツキ', 'ゴリラ',
  'グラム', 'グリフ', 'グレン', 'グロス', 'グロム', 'グレイ', 'グラン', 'グリッド',
  'ゴブロ', 'ゴブモ', 'ゴブノ', 'ゴブホ', 'ゴブソ', 'ゴブト', 'ゴブド', 'ゴブポ',
  'バキ', 'バク', 'バン', 'ビク', 'ブク', 'ベク', 'ボク', 'ブン',
  'ガキ', 'ガク', 'ガン', 'ギク', 'グク', 'ゲク', 'ゴク', 'グン',
  'ゾロ', 'ザラ', 'ゼロ', 'ゾク', 'ザク', 'ズク', 'ゼク', 'ゾン',
  'ドク', 'ダク', 'デク', 'ディク', 'ドゥク', 'ダン', 'デン', 'ドン',
  'チャド', 'チョド', 'チュド', 'チェド', 'チャク', 'チョク', 'チュク', 'チェク',
  'ゴンベ', 'ゴンザ', 'ゴンゾウ', 'ゴンキチ', 'ゴンスケ', 'ゴンタ', 'ゴンジ', 'ゴンロク',
  'グビ', 'グベ', 'グボ', 'グバ', 'グブ', 'ギビ', 'ギベ', 'ギボ',
  'ゴビ', 'ゴベ', 'ゴボ', 'ゴバ', 'ゴブ', 'ガビ', 'ガベ', 'ガボ',
  'ムク', 'モク', 'マク', 'メク', 'ミク', 'ムン', 'モン', 'マン',
  'ヌク', 'ノク', 'ナク', 'ネク', 'ニク', 'ヌン', 'ノン', 'ナン',
]

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
    const name = this.selectRandomName()
    return {
      id,
      name,
      race: 'ゴブリン',
      level: 1,
      avatar: '/src/assets/goblin/goblin.png',
      stats,
      equipment: [0, 1, 2].map(slotIndex => ({ slotIndex, itemId: null })),
    }
  }

  private selectRandomName(): string {
    const index = Math.floor(this.random() * GOBLIN_NAMES.length)
    return GOBLIN_NAMES[index]
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
