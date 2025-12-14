import type { Goblin, GoblinStats } from '../../shared/types'
import { ModGeneratorService } from './ModGeneratorService'
import { FactorInheritanceService, type InheritanceResult } from './FactorInheritanceService'

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

/**
 * ゴブリン誕生ロジックを担当するサービス
 */
export class GoblinBirthService {
  private readonly random: () => number

  constructor(random: () => number = Math.random) {
    this.random = random
  }

  /**
   * 単体のゴブリンを生成する（遠征成功時など）
   * @param nextGoblinId 次のゴブリンID
   * @param individualValue 個体値 (1〜64)、デフォルトは1
   * @param baseGoblins 因子引き継ぎ元の拠点ゴブリン（オプション）
   */
  public createNewGoblin(nextGoblinId: number, individualValue = 1, baseGoblins?: Goblin[]): Goblin {
    const inheritance = baseGoblins ? this.evaluateFactorInheritance(baseGoblins) : undefined
    return this.createGoblin(nextGoblinId, individualValue, inheritance)
  }

  /**
   * 因子引き継ぎを評価
   * @param baseGoblins 拠点所属ゴブリン
   */
  private evaluateFactorInheritance(baseGoblins: Goblin[]): InheritanceResult | undefined {
    console.log('[GoblinBirth] evaluateFactorInheritance called', {
      baseGoblinsCount: baseGoblins.length,
      baseGoblins: baseGoblins.map(g => ({ name: g.name, factors: g.factors })),
    })

    if (baseGoblins.length === 0) {
      console.log('[GoblinBirth] No base goblins, skipping inheritance')
      return undefined
    }

    const parents = FactorInheritanceService.selectParents(baseGoblins, this.random)
    const inheritance = FactorInheritanceService.evaluateInheritance(parents, this.random)

    console.log('[GoblinBirth] Inheritance result:', inheritance)

    // 引き継いだ因子がない場合はundefined
    if (inheritance.inheritedFactors.length === 0) {
      return undefined
    }

    return inheritance
  }

  /**
   * 新しいゴブリンを生成
   * @param id ゴブリンID
   * @param individualValue 個体値 (1〜64)、デフォルトは1
   * @param inheritance 因子引き継ぎ結果（オプション）
   */
  private createGoblin(
    id: number,
    individualValue = 1,
    inheritance?: InheritanceResult
  ): Goblin {
    const baseStats = this.generateStats()
    const name = this.selectRandomName()
    // 個体値を1〜64の範囲にクランプ
    const clampedIV = Math.max(1, Math.min(64, individualValue))

    // 因子によるステータス補正を適用
    const stats = inheritance
      ? this.applyStatBonuses(baseStats, inheritance.statBonuses)
      : baseStats

    // 種族とアバターを決定
    const race = inheritance?.isVariant
      ? inheritance.variantRace!
      : 'ゴブリン'
    const avatar = inheritance?.isVariant
      ? inheritance.variantAvatar!
      : '/src/assets/goblin/goblin.png'

    // Modを生成（シードはIDとタイムスタンプから生成）
    const modSeed = id * 1000 + Date.now() % 1000
    const modGenerator = new ModGeneratorService(modSeed)
    const mods = modGenerator.generateMods(clampedIV)

    return {
      id,
      name,
      race,
      level: 1,
      experience: 0,
      avatar,
      stats,
      individualValue: clampedIV,
      mods,  // 空配列もそのまま保存（Firestoreはundefinedを許容しない）
      factors: inheritance?.inheritedFactors ?? [],
    }
  }

  /**
   * 基本ステータスに因子ボーナスを適用
   */
  private applyStatBonuses(baseStats: GoblinStats, bonuses: GoblinStats): GoblinStats {
    return {
      hp: baseStats.hp + bonuses.hp,
      atk: baseStats.atk + bonuses.atk,
      def: baseStats.def + bonuses.def,
      sp: baseStats.sp + bonuses.sp,
      spd: baseStats.spd + bonuses.spd,
    }
  }

  /**
   * ランダムにゴブリンの名前を選択
   */
  private selectRandomName(): string {
    const index = Math.floor(this.random() * GOBLIN_NAMES.length)
    return GOBLIN_NAMES[index]
  }

  /**
   * ランダムなステータスを生成
   */
  private generateStats(): GoblinStats {
    return {
      hp: this.randomInRange('hp'),
      atk: this.randomInRange('atk'),
      sp: this.randomInRange('sp'),
      spd: this.randomInRange('spd'),
      def: this.randomInRange('def'),
    }
  }

  /**
   * 指定されたステータスの範囲内でランダムな値を生成
   */
  private randomInRange(key: keyof GoblinStats): number {
    const { min, max } = STAT_RANGES[key]
    const value = min + (max - min) * this.random()
    return Math.round(value)
  }
}
