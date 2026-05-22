import type { Goblin, GoblinStats } from '../../shared/types'
import { GoblinStatCalculator } from './GoblinStatCalculator'
import { FactorInheritanceService, type InheritanceResult } from './FactorInheritanceService'
import { BirthSkillService } from './BirthSkillService'
import { calculateIndividualValue } from './BaseRankSystem'
import { getDefaultSkillsForRace } from '../../shared/data/raceSkills'
import {
  calculateGoblinBaseAccuracy,
  calculateGoblinBaseAtk,
  calculateGoblinBaseAttackCount,
  calculateGoblinBaseDef,
  calculateGoblinBaseEvasion,
  calculateGoblinBaseHp,
  calculateGoblinBaseMagicAtk,
  calculateGoblinBaseMagicDef,
  calculateGoblinBaseMagicHeal,
  getGoblinBaseAttributeDefaults,
  getGoblinBaseAttributes,
} from '../../shared/utils/goblinHp'
import { getLegacyRaceName, isBaseGoblinRaceId, normalizeGoblinRaceId } from '../../shared/types/Race'

const BASE_ATTRIBUTE_RANDOM_MIN = -5
const BASE_ATTRIBUTE_RANDOM_MAX = 3

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
    return this.createGoblin(nextGoblinId, finalIV, inheritance, baseRank)
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
    inheritance?: InheritanceResult,
    baseRank?: number
  ): Goblin {
    const name = this.selectRandomName()
    // 個体値を1〜64の範囲にクランプ
    const clampedIV = Math.max(1, Math.min(64, individualValue))

    // 種族とアバターを決定
    const raceId = inheritance?.isVariant
      ? normalizeGoblinRaceId(inheritance.variantRaceId ?? inheritance.variantRace)
      : 'goblin'
    const race = getLegacyRaceName(raceId)
    const baseAttributes = this.generateBaseAttributes(race, raceId)

    // 基本ステータスを生成（因子ボーナスはGoblinStatCalculatorで計算時に適用）
    const stats = this.generateStats(race, raceId, baseAttributes)
    const avatar = inheritance?.isVariant
      ? inheritance.variantAvatar!
      : '/src/assets/goblin/goblin.png'

    const defaultSkills = getDefaultSkillsForRace(raceId)
    const birthSkills = isBaseGoblinRaceId(raceId) && !inheritance?.isVariant
      ? BirthSkillService.rollPureGoblinBirthSkills({
          inheritedFactorIds: inheritance?.inheritedFactors ?? [],
          baseRank,
          existingSkillIds: defaultSkills.map((skill) => skill.id),
          rng: this.random,
        })
      : []

    const goblin: Goblin = {
      id,
      name,
      race,
      raceId,
      level: 1,
      experience: 0,
      avatar,
      stats,
      baseAttributes,
      effectiveStats: stats,  // 仮設定、後で計算
      individualValue: clampedIV,
      skills: [...defaultSkills, ...birthSkills],
      factors: inheritance?.inheritedFactors ?? [],
    }

    // 亜種の場合のみvariantFactorIdを設定（Firestoreはundefinedを許容しない）
    if (inheritance?.variantFactorId) {
      goblin.variantFactorId = inheritance.variantFactorId
    }

    // 実効ステータスを計算（因子適用後）
    goblin.effectiveStats = GoblinStatCalculator.calculate(goblin)

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
   * 初期ステータスを生成
   * @param bloodline 血統名
   */
  private generateStats(
    bloodline: string,
    raceId: ReturnType<typeof normalizeGoblinRaceId>,
    baseAttributes = getGoblinBaseAttributes({ race: bloodline, raceId })
  ): GoblinStats {
    const context = { race: bloodline, raceId, baseAttributes }
    return {
      hp: calculateGoblinBaseHp(1, context),
      atk: calculateGoblinBaseAtk(1, context),
      magicAtk: calculateGoblinBaseMagicAtk(1, context),
      def: calculateGoblinBaseDef(1, context),
      magicDef: calculateGoblinBaseMagicDef(1, context),
      attackCount: calculateGoblinBaseAttackCount(1, context),
      accuracy: calculateGoblinBaseAccuracy(1, context),
      evasion: calculateGoblinBaseEvasion(1, context),
      magicHeal: calculateGoblinBaseMagicHeal(1, context),
      criticalRate: 0,
    }
  }

  private generateBaseAttributes(
    race: string,
    raceId: ReturnType<typeof normalizeGoblinRaceId>
  ): NonNullable<Goblin['baseAttributes']> {
    const defaults = getGoblinBaseAttributeDefaults({ race, raceId })
    const randomOffset = () =>
      BASE_ATTRIBUTE_RANDOM_MIN +
      Math.floor(this.random() * (BASE_ATTRIBUTE_RANDOM_MAX - BASE_ATTRIBUTE_RANDOM_MIN + 1))

    return {
      power: defaults.power + randomOffset(),
      wisdom: defaults.wisdom + randomOffset(),
      spirit: defaults.spirit + randomOffset(),
      vitality: defaults.vitality + randomOffset(),
      agility: defaults.agility + randomOffset(),
      luck: defaults.luck + randomOffset(),
    }
  }
}
