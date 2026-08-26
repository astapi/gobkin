import type { Goblin, GoblinStats } from '../../shared/types'
import { GoblinStatCalculator } from './GoblinStatCalculator'
import { FactorInheritanceService, type InheritanceResult } from './FactorInheritanceService'
import { BirthSkillService } from './BirthSkillService'
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
   * 単体のゴブリンを生成する
   * @param nextGoblinId 次のゴブリンID
   * @param plusValue 血統の＋値
   * @param baseGoblins 因子引き継ぎ元の拠点ゴブリン（オプション）
   * @param baseRank 拠点ランク（1-7）、誕生スキル抽選に使用（オプション）
   */
  public createNewGoblin(
    nextGoblinId: number,
    plusValue = 0,
    baseGoblins?: Goblin[],
    baseRank?: number,
  ): Goblin {
    const inheritance = baseGoblins
      ? this.evaluateFactorInheritance(baseGoblins, plusValue)
      : undefined
    return this.createGoblin(nextGoblinId, plusValue, inheritance, baseRank)
  }

  /** 固定選択した個体の因子スナップショットから新しいゴブリンを生成する。 */
  public createNewGoblinFromFactorSources(
    nextGoblinId: number,
    plusValue: number,
    sourceFactorIds: readonly string[],
    baseRank?: number,
  ): Goblin {
    const inheritance = FactorInheritanceService.evaluateFactorIds(sourceFactorIds, this.random, plusValue)
    return this.createGoblin(
      nextGoblinId,
      plusValue,
      inheritance.inheritedFactors.length > 0 ? inheritance : undefined,
      baseRank,
    )
  }

  /**
   * 因子引き継ぎを評価
   * @param baseGoblins 拠点所属ゴブリン
   */
  private evaluateFactorInheritance(
    baseGoblins: Goblin[],
    plusValue: number,
  ): InheritanceResult | undefined {
    console.log('[GoblinBirth] evaluateFactorInheritance called', {
      baseGoblinsCount: baseGoblins.length,
      baseGoblins: baseGoblins.map(g => ({ name: g.name, factors: g.factors })),
    })

    if (baseGoblins.length === 0) {
      console.log('[GoblinBirth] No base goblins, skipping inheritance')
      return undefined
    }

    const parents = FactorInheritanceService.selectParents(baseGoblins, this.random)
    const factorIds = [
      ...(parents.parent1?.factors ?? []),
      ...(parents.parent2?.factors ?? []),
    ]
    const inheritance = FactorInheritanceService.evaluateFactorIds(factorIds, this.random, plusValue)

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
   * @param plusValue 血統の＋値
   * @param inheritance 因子引き継ぎ結果（オプション）
   */
  private createGoblin(
    id: number,
    plusValue = 0,
    inheritance?: InheritanceResult,
    baseRank?: number
  ): Goblin {
    const name = this.selectRandomName()
    const normalizedPlusValue = Math.max(0, Math.floor(plusValue))

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
      plusValue: normalizedPlusValue,
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
