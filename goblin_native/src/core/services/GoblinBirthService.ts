import type { Goblin, GoblinStats } from '../../shared/types'
import { ModGeneratorService } from './ModGeneratorService'
import { ModStatCalculator } from './ModStatCalculator'
import { FactorInheritanceService, type InheritanceResult } from './FactorInheritanceService'
import { calculateIndividualValue } from './BaseRankSystem'
import { getRaceCombatStats } from '../../shared/data/equipmentConfig'

/** attackCount以外のランダム生成範囲（attackCountは種族固定値） */
const STAT_RANGES: Record<Exclude<keyof GoblinStats, 'attackCount'>, { min: number; max: number }> = {
  hp: { min: 55, max: 80 },
  atk: { min: 10, max: 16 },
  sp: { min: 7, max: 13 },
  spd: { min: 8, max: 14 },
  def: { min: 8, max: 14 },
  accuracy: { min: 15, max: 25 },
  evasion: { min: 10, max: 20 },
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
   * @param individualValue 個体値 (1〜64)、指定しない場合は自動計算
   * @param baseGoblins 因子引き継ぎ元の拠点ゴブリン（オプション）
   * @param areaLevel エリアレベル（1-8）、個体値計算に使用（オプション）
   * @param baseRank 拠点ランク（1-7）、個体値計算に使用（オプション）
   */
  public createNewGoblin(
    nextGoblinId: number,
    individualValue?: number,
    baseGoblins?: Goblin[],
    areaLevel?: number,
    baseRank?: number
  ): Goblin {
    // 個体値が指定されていない場合、エリアレベルと拠点ランクから計算
    let finalIV = individualValue
    if (finalIV === undefined && areaLevel !== undefined && baseRank !== undefined) {
      finalIV = calculateIndividualValue(areaLevel, baseRank, this.random)
    }
    // どちらも指定されていない場合はデフォルト値1
    if (finalIV === undefined) {
      finalIV = 1
    }

    const inheritance = baseGoblins ? this.evaluateFactorInheritance(baseGoblins) : undefined
    return this.createGoblin(nextGoblinId, finalIV, inheritance)
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
    const name = this.selectRandomName()
    // 個体値を1〜64の範囲にクランプ
    const clampedIV = Math.max(1, Math.min(64, individualValue))

    // 種族とアバターを決定
    const race = inheritance?.isVariant
      ? inheritance.variantRace!
      : 'ゴブリン'

    // 基本ステータスを生成（因子ボーナスはModStatCalculatorで計算時に適用）
    const stats = this.generateStats(race)
    const avatar = inheritance?.isVariant
      ? inheritance.variantAvatar!
      : '/src/assets/goblin/goblin.png'

    // Modを生成（シードはIDとタイムスタンプから生成）
    const modSeed = id * 1000 + Date.now() % 1000
    const modGenerator = new ModGeneratorService(modSeed)
    const mods = modGenerator.generateMods(clampedIV)

    const goblin: Goblin = {
      id,
      name,
      race,
      level: 1,
      experience: 0,
      avatar,
      stats,
      effectiveStats: stats,  // 仮設定、後で計算
      individualValue: clampedIV,
      mods,  // 空配列もそのまま保存（Firestoreはundefinedを許容しない）
      factors: inheritance?.inheritedFactors ?? [],
    }

    // 亜種の場合のみvariantFactorIdを設定（Firestoreはundefinedを許容しない）
    if (inheritance?.variantFactorId) {
      goblin.variantFactorId = inheritance.variantFactorId
    }

    // 実効ステータスを計算（因子・Mod適用後）
    goblin.effectiveStats = ModStatCalculator.calculate(goblin)

    return goblin
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
   * @param race 種族名（attackCountの初期値に使用）
   */
  private generateStats(race: string): GoblinStats {
    const combatStats = getRaceCombatStats(race)
    return {
      hp: this.randomInRange('hp'),
      atk: this.randomInRange('atk'),
      sp: this.randomInRange('sp'),
      spd: this.randomInRange('spd'),
      def: this.randomInRange('def'),
      attackCount: combatStats.attackCount,
      accuracy: this.randomInRange('accuracy'),
      evasion: this.randomInRange('evasion'),
    }
  }

  /**
   * 指定されたステータスの範囲内でランダムな値を生成
   */
  private randomInRange(key: Exclude<keyof GoblinStats, 'attackCount'>): number {
    const { min, max } = STAT_RANGES[key]
    const value = min + (max - min) * this.random()
    return Math.round(value)
  }
}
