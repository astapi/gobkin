import type { GoblinBaseAttributes } from './Goblin'
import type { CharacterSkill } from './CharacterSkill'
import type { FactorDropConfig } from './Factor'
import type { LearnedSpell } from './Spell'
import type { BattleActionPolicy } from './Battle'
import type { DungeonTier } from './DungeonTier'

export interface EquipmentDropConfig {
  templateId: string   // EquipmentTemplate.id
}

export interface TierEquipmentDropConfig {
  tier: DungeonTier
  drops: EquipmentDropConfig[]
}

export interface Enemy {
  id: string
  name: string
  raceTags: string[]
  level: number
  hp: number
  baseAttributes: GoblinBaseAttributes
  atk: number
  magicAtk?: number        // 魔法攻撃力
  def: number
  magicDef?: number       // 魔法防御力
  magicHeal?: number      // 魔法回復量
  attackCount: number  // 攻撃回数
  accuracy: number     // 命中精度
  evasion: number      // 回避能力
  criticalRate?: number // 必殺率
  physicalResistancePercent?: number    // 物理耐性
  penetrationResistancePercent?: number // 貫通耐性
  criticalResistancePercent?: number    // 必殺耐性
  magicResistancePercent?: number       // 魔法耐性
  exp?: number  // 互換用に残す。実際の経験値は calculateEnemyExp で算出する。
  isBoss?: boolean // この敵自身がボスか。ボスパターンに含まれる随伴敵には付けない。
  gold: number
  factorDrops?: FactorDropConfig[]      // この敵を倒すと得られる可能性のある因子
  rareEquipmentDrops?: EquipmentDropConfig[] // 通常Tierから落ちるレアドロップ候補
  tierRareEquipmentDrops?: TierEquipmentDropConfig[] // 指定Tier以上で追加されるレアドロップ候補
  skills?: CharacterSkill[]              // パッシブ/呪文付与スキル
  spells?: LearnedSpell[]               // この敵が使える呪文リスト
  battleActionPolicy?: BattleActionPolicy // 戦闘時の行動率設定
}

export interface EnemyPattern {
  id: string
  floors: number[]
  enemies: string[][]  // enemies[row][slotIndex] = enemyId（2D配列で隊列を表現）
  isFloorBoss?: boolean
  isBoss?: boolean
}

export interface EnemyDatabase {
  enemies: Enemy[]
  patterns: EnemyPattern[]
}

export interface EnemySnap {
  id: string
  name: string
  lvl: number
  count: number
  gold: number
}
