import type { ModInstance } from './Mod'
import type { CharacterSkill } from './CharacterSkill'
import type { LearnedSpell } from './Spell'
import type { GoblinRaceId } from './Race'
import type { BattleActionPolicy } from './Battle'

export type GoblinStats = {
  hp: number
  atk: number
  magicAtk: number     // 魔法攻撃力
  def: number
  magicDef: number     // 魔法防御力
  attackCount: number  // 攻撃回数（種族基本値、ゴブリン=2）
  accuracy: number     // 命中精度
  evasion: number      // 回避能力
  magicHeal: number    // 魔法回復量
  criticalRate: number // 必殺率
}

export type GoblinBaseAttributes = {
  power: number
  wisdom: number
  spirit: number
  vitality: number
  agility: number
  luck: number
}

export type GoblinJob = 'guard' | 'thief' | 'mage' | 'warrior' | 'cleric' | 'rider'

export type Goblin = {
  id: number
  name: string
  race: string
  raceId?: GoblinRaceId
  job?: GoblinJob
  level: number
  experience: number
  avatar: string
  stats: GoblinStats  // 基本ステータス（レベルアップで増加）
  currentHp?: number  // 現在HP。未設定または1以上なら遠征開始時に最大HPまで回復、0なら負傷扱い
  baseAttributes?: GoblinBaseAttributes  // 基本能力値（力、知恵、精神、体力、敏捷、運）
  effectiveStats?: GoblinStats  // 実効ステータス（stats + 因子 + Mod適用後）、未設定時はModStatCalculatorで計算
  factors?: string[]  // 獲得した因子IDの配列
  variantFactorId?: string  // 亜種として生まれた因子ID（亜種の追加効果適用に使用）
  individualValue?: number  // 個体値 (1〜64)、未定義の場合は1として扱う
  mods?: ModInstance[]  // 付与されたMod配列（0〜4個）
  skills: CharacterSkill[]  // パッシブスキル一覧
  spells?: LearnedSpell[]  // 習得した呪文リスト
  battleActionPolicy?: BattleActionPolicy // 戦闘時の行動率設定
}
