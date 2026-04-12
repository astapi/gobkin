/** ターゲットごとのダメージ詳細 */
export interface AttackTargetDetail {
  targetId: string
  targetName: string
  targetRow: number       // ターゲットの隊列番号
  totalDamage: number     // このターゲットへの合計ダメージ（回復は負値）
  hitCount: number        // このターゲットへの命中回数
  defeated: boolean       // この攻撃で倒したか
  targetHP: number        // 攻撃後の残りHP
}

export interface BattleLogEntry {
  turn: number
  actorId: string
  actorName: string
  actorRow: number        // 攻撃者の隊列番号
  action: string
  attackCount: number     // 総攻撃回数
  hitCount: number        // 総命中回数
  actorHP: number         // 攻撃者の現在HP
  actorMaxHP: number      // 攻撃者の最大HP
  isAlly: boolean
  targets: AttackTargetDetail[]  // ターゲットごとの結果
  turnState?: {
    allies: Array<{ id: string; name: string; currentHP: number; maxHP: number }>
    enemies: Array<{ id: string; name: string; currentHP: number; maxHP: number }>
  }
}

/** 戦闘結果のメタ情報（ログ表示用） */
export interface BattleLogMeta {
  outcome: 'win' | 'lose' | 'escape'
  xpGained: number
  goldGained: number
  /** 隊列順のパーティメンバー情報 */
  members: Array<{
    name: string
    currentHP: number
    maxHP: number
    level: number
    xpEach: number
    expMultiplier: number
    levelUp?: {
      oldLevel: number
      newLevel: number
    }
  }>
}

export interface CombatReplay {
  rounds: number
  outcome: "win" | "lose" | "escape"
  allyHPDelta: number[]
  enemyDefeated: number
  detailedLog?: BattleLogEntry[]
}
