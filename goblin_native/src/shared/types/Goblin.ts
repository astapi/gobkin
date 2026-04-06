import type { ModInstance } from './Mod'
import type { CharacterSkill } from './CharacterSkill'
import type { LearnedSpell } from './Spell'

export type GoblinStats = {
  hp: number
  atk: number
  sp: number
  spd: number
  def: number
  attackCount: number  // 攻撃回数（種族基本値、ゴブリン=2）
  accuracy: number     // 命中精度
  evasion: number      // 回避能力
}

export type Goblin = {
  id: number
  name: string
  race: string
  level: number
  experience: number
  avatar: string
  stats: GoblinStats  // 基本ステータス（レベルアップで増加）
  effectiveStats?: GoblinStats  // 実効ステータス（stats + 因子 + Mod適用後）、未設定時はModStatCalculatorで計算
  factors?: string[]  // 獲得した因子IDの配列
  variantFactorId?: string  // 亜種として生まれた因子ID（亜種の追加効果適用に使用）
  individualValue?: number  // 個体値 (1〜64)、未定義の場合は1として扱う
  mods?: ModInstance[]  // 付与されたMod配列（0〜4個）
  skills: CharacterSkill[]  // パッシブスキル一覧
  spells?: LearnedSpell[]  // 習得した呪文リスト
}
