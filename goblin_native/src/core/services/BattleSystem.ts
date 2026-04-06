import type { AttackTargetDetail, BattleLogEntry, Enemy, Goblin, LearnedSpell } from '../../shared/types'
import { SPELL_DEFS } from '../../shared/data/spells'
import { getRaceAdditionalDamage, getRearProtectionMultiplier } from '../../shared/data/raceAbilities'
import type { SpellDef } from '../../shared/types/Spell'
import { CombatantManager } from './CombatantManager'
import { DamageCalculator } from './DamageCalculator'
import { ModStatCalculator } from './ModStatCalculator'
import type {
  Combatant,
  DamageOptions,
  RaceDict,
  Skill,
} from './DamageCalculator'

interface SpellCharge {
  spellId: string
  remaining: number   // 残りチャージ
  maxCharges: number  // 最大チャージ
}

interface BattleUnit {
  combatant: Combatant
  currentHP: number
  maxHP: number
  initialHP: number
  spd: number
  attackCount: number
  accuracy: number
  evasion: number
  isAlly: boolean
  originalIndex: number
  damageReduction: number  // 被ダメージ軽減率（0〜100）
  row: number              // 隊列の列番号（0-based）
  rowSlot: number          // 列内のスロット番号（0-based）
  level: number            // 呪文のターゲット数計算用
  spellCharges: SpellCharge[]  // 戦闘中の呪文チャージ状態
  race?: string
}

export interface BattleResult {
  rounds: number
  outcome: 'win' | 'lose' | 'retreat'
  allyHPDelta: number[]
  enemyDefeated: number
  detailedLog: BattleLogEntry[]
}

const RACE_DICT: RaceDict = {
  goblin: { label: 'ゴブリン' },
  wolf: { label: '狼' },
  bat: { label: 'コウモリ' },
  slime: { label: 'スライム' },
  skeleton: { label: 'スケルトン' },
  orc: { label: 'オーク' },
  troll: { label: 'トロール' },
}

const BASIC_ATTACK_SKILL: Skill = {
  id: 'basic_attack',
  name: '通常攻撃',
  power: 1.0,
}

const DEFAULT_DAMAGE_OPTIONS: DamageOptions = {
  defConstant: 100,
  randomMin: 0.95,
  randomMax: 1.05,
}

/**
 * 攻撃回数に応じたダメージ補正
 * n<=2 → 1.0, n>=3 → 0.9^(n-2)
 */
export function getDamageModifier(attackNumber: number): number {
  if (attackNumber <= 2) return 1.0
  return Math.pow(0.9, attackNumber - 2)
}

/**
 * 攻撃回数に応じた命中精度補正
 * n=1 → 1.0, n>=2 → 0.6 × 0.9^(n-2)
 */
export function getAccuracyModifier(attackNumber: number): number {
  if (attackNumber <= 1) return 1.0
  return 0.6 * Math.pow(0.9, attackNumber - 2)
}

/**
 * 隊列の狙われ率の重みを取得
 * row 0→1/2, row 1→1/4, ... 最後2列は同率
 * totalRows: 生存列数
 */
export function getRowWeight(row: number, totalRows: number): number {
  if (totalRows <= 1) return 1
  // 最後の2列は同率
  const effectiveRow = Math.min(row, totalRows - 2)
  return Math.pow(0.5, effectiveRow + 1)
}

/**
 * 隊列に基づくターゲット選択
 * 生存ユニットを列グループ化し、前詰めした列番号で重み付き抽選
 */
export function selectTarget(aliveUnits: BattleUnit[], rng: () => number): BattleUnit {
  if (aliveUnits.length === 1) return aliveUnits[0]

  // 列でグループ化（列番号順にソート済みの前提）
  const rowGroups: Map<number, BattleUnit[]> = new Map()
  for (const unit of aliveUnits) {
    const group = rowGroups.get(unit.row) ?? []
    group.push(unit)
    rowGroups.set(unit.row, group)
  }

  // 列を前詰めして連番にする（生存列のみ、元のrow順でソート）
  const sortedRows = [...rowGroups.keys()].sort((a, b) => a - b)
  const totalRows = sortedRows.length

  // 列の重み付き抽選
  const rowWeights = sortedRows.map((_, idx) => getRowWeight(idx, totalRows))
  const totalWeight = rowWeights.reduce((sum, w) => sum + w, 0)
  let roll = rng() * totalWeight
  let selectedRowIdx = 0
  for (let i = 0; i < rowWeights.length; i++) {
    roll -= rowWeights[i]
    if (roll <= 0) {
      selectedRowIdx = i
      break
    }
  }

  const selectedRow = sortedRows[selectedRowIdx]
  const candidates = rowGroups.get(selectedRow)!

  // 列内が1体ならそのまま返す
  if (candidates.length === 1) return candidates[0]

  // 列内の複数ユニットも同じ重み方式で抽選（rowSlot順で前ほど狙われやすい）
  const sorted = [...candidates].sort((a, b) => a.rowSlot - b.rowSlot)
  const slotWeights = sorted.map((_, idx) => getRowWeight(idx, sorted.length))
  const slotTotalWeight = slotWeights.reduce((sum, w) => sum + w, 0)
  let slotRoll = rng() * slotTotalWeight
  for (let i = 0; i < sorted.length; i++) {
    slotRoll -= slotWeights[i]
    if (slotRoll <= 0) return sorted[i]
  }
  return sorted[sorted.length - 1]
}

export class BattleSystem {
  private readonly combatantManager: CombatantManager
  private readonly damageCalculator: DamageCalculator

  constructor(
    combatantManager: CombatantManager = new CombatantManager(),
    damageCalculator: DamageCalculator = new DamageCalculator(),
  ) {
    this.combatantManager = combatantManager
    this.damageCalculator = damageCalculator
  }

  public executeBattle(
    allies: Goblin[],
    initialAllyHP: number[],
    enemies: Enemy[][],
    rng: () => number,
    maxTurns: number = 20,
  ): BattleResult {
    const allyUnits = allies.map((goblin, index) =>
      this.createAllyUnit(goblin, initialAllyHP[index], index),
    )
    // 2D敵配列をフラット化してBattleUnit生成（row/rowSlot付き）
    const enemyUnits: BattleUnit[] = []
    let enemyIdx = 0
    for (let row = 0; row < enemies.length; row++) {
      for (let slot = 0; slot < enemies[row].length; slot++) {
        enemyUnits.push(this.createEnemyUnit(enemies[row][slot], enemyIdx, row, slot))
        enemyIdx++
      }
    }

    const detailedLog: BattleLogEntry[] = []
    let currentTurn = 0

    while (currentTurn < maxTurns) {
      currentTurn++

      // ターン10で呪文チャージリセット
      if (currentTurn === 10) {
        for (const unit of [...allyUnits, ...enemyUnits]) {
          if (unit.currentHP <= 0) continue
          for (const sc of unit.spellCharges) {
            sc.remaining = Math.min(sc.remaining + 1, sc.maxCharges)
          }
        }
      }

      detailedLog.push(this.createTurnStartLog(currentTurn, allyUnits, enemyUnits))

      const actingUnits = [...allyUnits, ...enemyUnits].filter(unit => unit.currentHP > 0)
      actingUnits.sort((a, b) => b.spd - a.spd)

      for (const unit of actingUnits) {
        if (unit.currentHP <= 0) continue

        const targetGroup = unit.isAlly ? enemyUnits : allyUnits

        // 行動決定: 呪文チャージがあれば呪文優先
        const spellAction = this.decideSpellAction(unit)

        if (spellAction) {
          // 呪文実行
          const { targetDetails, totalHitCount } = this.executeSpell(
            unit, spellAction, targetGroup, rng,
          )

          // チャージ消費
          const charge = unit.spellCharges.find(sc => sc.spellId === spellAction.id)
          if (charge) charge.remaining--

          detailedLog.push({
            turn: currentTurn,
            actorId: unit.combatant.id,
            actorName: unit.combatant.name,
            actorRow: unit.row + 1,
            action: spellAction.name,
            attackCount: totalHitCount,
            hitCount: totalHitCount,
            actorHP: unit.currentHP,
            actorMaxHP: unit.maxHP,
            isAlly: unit.isAlly,
            targets: [...targetDetails.values()],
          })
        } else {
          // 通常攻撃
          const targetDetails: Map<string, AttackTargetDetail> = new Map()
          let totalHitCount = 0

          for (let atkIdx = 0; atkIdx < unit.attackCount; atkIdx++) {
            if (unit.currentHP <= 0) break

            const aliveTargets = targetGroup.filter(target => target.currentHP > 0)
            if (aliveTargets.length === 0) break

            const target = selectTarget(aliveTargets, rng)

            // 命中判定
            const hitRate = this.calculateHitRate(unit, target, atkIdx + 1, rng)
            const isHit = rng() * 100 < hitRate

            if (!isHit) continue

            totalHitCount++

            // ダメージ計算
            const baseDamage = this.damageCalculator.calcDamage(
              RACE_DICT,
              unit.combatant,
              target.combatant,
              BASIC_ATTACK_SKILL,
              DEFAULT_DAMAGE_OPTIONS,
              rng,
            )

            // ダメージ補正: n<=2 → 1.0, n>=3 → 0.9^(n-2)
            const dmgMod = getDamageModifier(atkIdx + 1)
            const additionalDamage = unit.race ? getRaceAdditionalDamage(unit.race) : 0

            // 被ダメージ軽減を適用
            const reductionFactor = 1 - target.damageReduction / 100
            const protectionFactor = this.getRearGuardReductionFactor(target, allyUnits)
            const damage = Math.max(
              1,
              Math.floor((baseDamage * dmgMod + additionalDamage) * reductionFactor * protectionFactor),
            )

            target.currentHP = Math.max(0, target.currentHP - damage)

            // ターゲットごとの結果を集約
            const existing = targetDetails.get(target.combatant.id)
            if (existing) {
              existing.totalDamage += damage
              existing.hitCount++
              existing.defeated = target.currentHP <= 0
              existing.targetHP = target.currentHP
            } else {
              targetDetails.set(target.combatant.id, {
                targetId: target.combatant.id,
                targetName: target.combatant.name,
                targetRow: target.row + 1,
                totalDamage: damage,
                hitCount: 1,
                defeated: target.currentHP <= 0,
                targetHP: target.currentHP,
              })
            }
          }

          detailedLog.push({
            turn: currentTurn,
            actorId: unit.combatant.id,
            actorName: unit.combatant.name,
            actorRow: unit.row + 1,
            action: BASIC_ATTACK_SKILL.name,
            attackCount: unit.attackCount,
            hitCount: totalHitCount,
            actorHP: unit.currentHP,
            actorMaxHP: unit.maxHP,
            isAlly: unit.isAlly,
            targets: [...targetDetails.values()],
          })
        }

        // 敵または味方が全滅したら即座にターン終了
        const allEnemiesDefeated = enemyUnits.every(u => u.currentHP <= 0)
        const allAlliesDefeated = allyUnits.every(u => u.currentHP <= 0)
        if (allEnemiesDefeated || allAlliesDefeated) break
      }

      const allyAlive = allyUnits.some(unit => unit.currentHP > 0)
      const enemyAlive = enemyUnits.some(unit => unit.currentHP > 0)

      if (!allyAlive) {
        return this.createBattleResult(currentTurn, 'lose', allyUnits, enemyUnits, detailedLog)
      }

      if (!enemyAlive) {
        return this.createBattleResult(currentTurn, 'win', allyUnits, enemyUnits, detailedLog)
      }
    }

    return this.createBattleResult(currentTurn, 'retreat', allyUnits, enemyUnits, detailedLog)
  }

  /**
   * 命中率を計算
   * 命中率 = 乱数A × (命中精度 × 攻撃回数補正 − 回避能力 × 残りHP補正)
   * clamp(5, 95)
   */
  private calculateHitRate(
    attacker: BattleUnit,
    defender: BattleUnit,
    attackNumber: number,
    rng: () => number,
  ): number {
    const accMod = getAccuracyModifier(attackNumber)
    const rand = rng()

    // 残りHP補正 = 0.5 * (1 + 残りHP / 最大HP)
    const hpRatio = defender.maxHP > 0 ? defender.currentHP / defender.maxHP : 0
    const hpMod = 0.5 * (1 + hpRatio)

    const hitRate = rand * (attacker.accuracy * accMod - defender.evasion * hpMod)

    // 限界値補正: 5% 〜 95%
    return Math.max(5, Math.min(95, hitRate))
  }

  private initSpellCharges(spells: LearnedSpell[] | undefined): SpellCharge[] {
    if (!spells) return []
    return spells
      .map(ls => {
        const def = SPELL_DEFS[ls.spellId]
        if (!def) return null
        const extra = ls.extraCharges ?? 0
        return {
          spellId: ls.spellId,
          remaining: def.defaultCharges + extra,
          maxCharges: def.defaultCharges + extra,
        }
      })
      .filter((sc): sc is SpellCharge => sc !== null)
  }

  /**
   * 使用可能な呪文があれば返す（呪文優先AI）
   */
  private decideSpellAction(unit: BattleUnit): SpellDef | null {
    for (const sc of unit.spellCharges) {
      if (sc.remaining > 0) {
        const def = SPELL_DEFS[sc.spellId]
        if (def) return def
      }
    }
    return null
  }

  /**
   * 呪文のターゲット数を計算
   */
  private getSpellHitCount(spellDef: SpellDef, level: number): number {
    const t = spellDef.targeting
    if (t.type === 'random_hits') return t.hitCount
    // multi_target
    const bonus = Math.floor(level / t.scaleLevelInterval) * t.scalePerLevel
    return t.baseTargets + bonus
  }

  /**
   * 呪文を実行（必中）
   */
  private executeSpell(
    unit: BattleUnit,
    spellDef: SpellDef,
    targetGroup: BattleUnit[],
    rng: () => number,
  ): { targetDetails: Map<string, AttackTargetDetail>; totalHitCount: number } {
    const targetDetails: Map<string, AttackTargetDetail> = new Map()
    let totalHitCount = 0
    const hitCount = this.getSpellHitCount(spellDef, unit.level)

    const spellSkill: Skill = {
      id: spellDef.id,
      name: spellDef.name,
      power: spellDef.power,
    }

    if (spellDef.targeting.type === 'random_hits') {
      // マジックアロー: ランダムにhitCount回攻撃（同じ敵に複数回当たりうる）
      for (let i = 0; i < hitCount; i++) {
        const aliveTargets = targetGroup.filter(t => t.currentHP > 0)
        if (aliveTargets.length === 0) break

        // 完全ランダム選択（隊列重みなし）
        const target = aliveTargets[Math.floor(rng() * aliveTargets.length)]

        const baseDamage = this.damageCalculator.calcDamage(
          RACE_DICT, unit.combatant, target.combatant,
          spellSkill, DEFAULT_DAMAGE_OPTIONS, rng,
        )
        const reductionFactor = 1 - target.damageReduction / 100
        const damage = Math.max(1, Math.floor(baseDamage * reductionFactor))

        target.currentHP = Math.max(0, target.currentHP - damage)
        totalHitCount++

        this.accumulateTargetDetail(targetDetails, target, damage)
      }
    } else {
      // ファイヤーボール: 最大hitCount体にそれぞれ1回ダメージ（重複なし）
      const aliveTargets = targetGroup.filter(t => t.currentHP > 0)
      const count = Math.min(hitCount, aliveTargets.length)

      // ランダムにcount体選択（Fisher-Yatesシャッフルの先頭count個）
      const shuffled = [...aliveTargets]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      const selected = shuffled.slice(0, count)

      for (const target of selected) {
        const baseDamage = this.damageCalculator.calcDamage(
          RACE_DICT, unit.combatant, target.combatant,
          spellSkill, DEFAULT_DAMAGE_OPTIONS, rng,
        )
        const reductionFactor = 1 - target.damageReduction / 100
        const damage = Math.max(1, Math.floor(baseDamage * reductionFactor))

        target.currentHP = Math.max(0, target.currentHP - damage)
        totalHitCount++

        this.accumulateTargetDetail(targetDetails, target, damage)
      }
    }

    return { targetDetails, totalHitCount }
  }

  private accumulateTargetDetail(
    details: Map<string, AttackTargetDetail>,
    target: BattleUnit,
    damage: number,
  ): void {
    const existing = details.get(target.combatant.id)
    if (existing) {
      existing.totalDamage += damage
      existing.hitCount++
      existing.defeated = target.currentHP <= 0
      existing.targetHP = target.currentHP
    } else {
      details.set(target.combatant.id, {
        targetId: target.combatant.id,
        targetName: target.combatant.name,
        targetRow: target.row + 1,
        totalDamage: damage,
        hitCount: 1,
        defeated: target.currentHP <= 0,
        targetHP: target.currentHP,
      })
    }
  }

  private createAllyUnit(goblin: Goblin, initialHP: number | undefined, originalIndex: number): BattleUnit {
    const combatant = this.combatantManager.fromGoblin(goblin)
    // Mod適用後のステータスを使用
    const effectiveStats = ModStatCalculator.calculate(goblin)
    const hp = initialHP ?? effectiveStats.hp
    const damageReduction = ModStatCalculator.getDamageReduction(goblin)
    return {
      combatant,
      currentHP: hp,
      maxHP: effectiveStats.hp,
      initialHP: hp,
      spd: effectiveStats.spd,
      attackCount: effectiveStats.attackCount,
      accuracy: effectiveStats.accuracy,
      evasion: effectiveStats.evasion,
      isAlly: true,
      originalIndex,
      damageReduction,
      row: originalIndex,  // 味方は1列1体（配列順 = 列番号）
      rowSlot: 0,
      level: goblin.level,
      spellCharges: this.initSpellCharges(goblin.spells),
      race: goblin.race,
    }
  }

  private createEnemyUnit(enemy: Enemy, originalIndex: number, row: number, rowSlot: number): BattleUnit {
    const combatant = this.combatantManager.fromEnemy(enemy)
    return {
      combatant,
      currentHP: enemy.hp,
      maxHP: enemy.hp,
      initialHP: enemy.hp,
      spd: enemy.spd,
      attackCount: enemy.attackCount,
      accuracy: enemy.accuracy,
      evasion: enemy.evasion,
      isAlly: false,
      originalIndex,
      damageReduction: 0,  // 敵は被ダメージ軽減なし
      row,
      rowSlot,
      level: enemy.level,
      spellCharges: this.initSpellCharges(enemy.spells),
    }
  }

  private getRearGuardReductionFactor(target: BattleUnit, allyUnits: BattleUnit[]): number {
    if (!target.isAlly || target.currentHP <= 0) return 1

    return allyUnits.reduce((factor, ally) => {
      if (ally.currentHP <= 0 || ally.row >= target.row || !ally.race) {
        return factor
      }
      return factor * getRearProtectionMultiplier(ally.race)
    }, 1)
  }

  private createTurnStartLog(
    currentTurn: number,
    allyUnits: BattleUnit[],
    enemyUnits: BattleUnit[],
  ): BattleLogEntry {
    return {
      turn: currentTurn,
      actorId: 'system',
      actorName: 'ターン開始',
      actorRow: -1,
      action: 'turn_start',
      attackCount: 0,
      hitCount: 0,
      actorHP: 0,
      actorMaxHP: 0,
      isAlly: true,
      targets: [],
      turnState: {
        allies: allyUnits.map(unit => ({
          id: unit.combatant.id,
          name: unit.combatant.name,
          currentHP: unit.currentHP,
          maxHP: unit.maxHP,
        })),
        enemies: enemyUnits.map(unit => ({
          id: unit.combatant.id,
          name: unit.combatant.name,
          currentHP: unit.currentHP,
          maxHP: unit.maxHP,
        })),
      },
    }
  }

  private createBattleResult(
    rounds: number,
    outcome: 'win' | 'lose' | 'retreat',
    allyUnits: BattleUnit[],
    enemyUnits: BattleUnit[],
    detailedLog: BattleLogEntry[],
  ): BattleResult {
    const allyHPDelta = allyUnits.map(unit => unit.currentHP - unit.initialHP)
    const enemyDefeated = enemyUnits.filter(unit => unit.currentHP <= 0).length

    return {
      rounds,
      outcome,
      allyHPDelta,
      enemyDefeated,
      detailedLog,
    }
  }
}
