import type { AttackTargetDetail, BattleActionPolicy, BattleLogEntry, CharacterSkill, Enemy, Goblin, LearnedSpell } from '../../shared/types'
import { SPELL_DEFS } from '../../shared/data/spells'
import { RECOVERY_MAGIC_SPELL_TABLE } from '../../shared/data/recoveryMagic'
import {
  getActionOrderMultiplierFromSkills,
  getAdditionalDamageFromSkills,
  getMagicDamageFollowUpFromSkills,
  getCriticalAttackFollowUpFromSkills,
  getPhysicalCounterAttackFromSkills,
  getPhysicalDamagePercentFromSkills,
  getPureGoblinPartyStatBonusPercentFromSkills,
  getRearAllyDamageMultiplierFromSkills,
  getLearnedSpellsFromSkills,
  getMagicDamageReductionFromSkills,
  getPhysicalDamageReductionFromSkills,
  getRearProtectionMultiplierFromSkills,
  getRowDamageMultiplierFromSkills,
  getSpellTakenMultiplierFromSkills,
  getSpellDamagePercentFromSkills,
  hasCoverLowHpAllySkill,
  hasActTwicePerTurnSkill,
  hasImmediateReviveSkill,
  hasRecoverRandomUsedSpellOnDefendSkill,
  hasSurviveLethalDamageAtHp1Skill,
  getHpRegenPercentFromSkills,
  getHpRegenAmountFromSkills,
} from '../../shared/data/characterSkills'
import type { SpellDef } from '../../shared/types/Spell'
import { CombatantManager } from './CombatantManager'
import { DamageCalculator } from './DamageCalculator'
import { ModStatCalculator } from './ModStatCalculator'
import { getGoblinBaseAttributesAtLevel } from '../../shared/utils/goblinHp'
import { getEffectiveStats, isPureGoblin } from '../../shared/utils/goblinStats'
import i18n from '../../shared/i18n'
import { getSpellLabel } from '../../shared/i18n/entityLocalization'
import { normalizeBattleActionPolicy, shouldRunRate } from '../../shared/utils/battleActionPolicy'
import { races as RACE_DICT } from '../../shared/data/races'
import { getRaceResistanceTotals, getRaceSkills } from '../../shared/data/races'
import { getUniqueSkillsById } from '../../shared/data/characterSkills'
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
  category: SpellCategory
}

type SpellCategory = 'cleric' | 'mage'

interface BattleUnit {
  instanceId?: string
  combatant: Combatant
  logName?: string
  currentHP: number
  maxHP: number
  initialHP: number
  power?: number
  agility: number
  luck: number
  attackCount: number
  accuracy: number
  evasion: number
  isAlly: boolean
  originalIndex: number
  damageReduction: number  // 汎用の被ダメージ軽減率（0〜100）
  physicalDamageReduction: number  // 物理ダメージ軽減率（0〜100）
  magicDamageReduction: number  // 魔法ダメージ軽減率（0〜100）
  breathDamageReduction: number // ブレスダメージ軽減率（0〜100）
  shieldBarrierDamageReduction: number // シールドバリアの攻撃ダメージ軽減率（0〜100）
  shieldBarrierBreathDamageReduction: number // シールドバリアのブレスダメージ軽減率（0〜100）
  magicBarrierDamageReduction: number // マジックバリアの魔法ダメージ軽減率（0〜100）
  physicalDamageDealtMultiplier: number // 物理与ダメージ倍率
  physicalDamagePercent: number   // 物理威力の増減（%）
  magicAtk: number              // 魔法攻撃力
  magicHeal: number             // 魔法回復量
  criticalRate: number          // 必殺率（%）
  spellDamagePercent: number    // 魔法威力の増減（%）
  shieldBarrierActive?: boolean  // シールドバリア状態
  magicBarrierActive?: boolean   // マジックバリア状態
  row: number              // 隊列の列番号（0-based）
  rowSlot: number          // 列内のスロット番号（0-based）
  level: number            // 呪文のターゲット数計算用
  spellCharges: SpellCharge[]  // 戦闘中の呪文チャージ状態
  skills: CharacterSkill[]
  battleActionPolicy: BattleActionPolicy
  isDefending: boolean
}

function toCombatBuffsFromSkills(skills: CharacterSkill[]) {
  return getUniqueSkillsById(skills)
    .filter((skill) => skill.raceBonus || skill.raceTakenBonus)
    .map((skill) => ({
      id: skill.id,
      name: skill.id,
      raceBonus: skill.raceBonus,
      raceTakenBonus: skill.raceTakenBonus,
    }))
}

export interface BattleResult {
  rounds: number
  outcome: 'win' | 'lose' | 'retreat'
  allyHPDelta: number[]
  enemyDefeated: number
  detailedLog: BattleLogEntry[]
}

const BASIC_ATTACK_SKILL: Skill = {
  id: 'basic_attack',
  name: i18n.t('battle.normalAttack'),
  power: 1.0,
}

const DEFAULT_DAMAGE_OPTIONS: DamageOptions = {
  defConstant: 100,
  randomMin: 0.6,
  randomMax: 1.05,
}

const SPELL_DAMAGE_OPTIONS: DamageOptions = {
  ...DEFAULT_DAMAGE_OPTIONS,
  isMagic: true,
}

const CLERIC_MAGIC_SPELL_IDS = new Set(RECOVERY_MAGIC_SPELL_TABLE.map(entry => entry.spellId))
const ATTACK_UP_PHYSICAL_DAMAGE_MULTIPLIER = 1.6

/** レベル帯ごとの魔法追加ダメージ制限倍率 */
const SPELL_BONUS_LEVEL_LIMIT_BY_LEVEL: { maxLevel: number; multiplier: number }[] = [
  { maxLevel: 5, multiplier: 0.282 },
  { maxLevel: 10, multiplier: 0.422 },
  { maxLevel: 15, multiplier: 0.630 },
  { maxLevel: 20, multiplier: 0.758 },
  { maxLevel: 25, multiplier: 0.910 },
  { maxLevel: 99, multiplier: 1.000 },
]

function getSpellCoefficient(level: number, spellDef: SpellDef): number {
  return (spellDef.spellCoefficient ?? 0) + level * (spellDef.spellCoefficientPerLevel ?? 0)
}

function getSpellBonusDamage(level: number, magicAtk: number, spellDef: SpellDef): number {
  const entry = SPELL_BONUS_LEVEL_LIMIT_BY_LEVEL.find(e => level <= e.maxLevel)
  const spellBase = getSpellCoefficient(level, spellDef)
  if (!entry || spellBase === 0) return 0
  return entry.multiplier * (magicAtk * 0.1 + spellBase * (1 + level / 20) * 0.2)
}

// 差5程度なら低敏捷側にも約10%の先行余地を持たせるため、広めの乗算乱数を使う
const ACTION_ORDER_RANDOM_MIN = 0.21
const ACTION_ORDER_RANDOM_MAX = 1.0

function getActionOrderRandomFactor(rng: () => number): number {
  return ACTION_ORDER_RANDOM_MIN + rng() * (ACTION_ORDER_RANDOM_MAX - ACTION_ORDER_RANDOM_MIN)
}

export function getActionOrderValue(agility: number, actionOrderMultiplier: number, randomB: number): number {
  const normalizedAgility = Math.max(1, agility)
  return normalizedAgility * normalizedAgility * actionOrderMultiplier * randomB
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
 * 命中率計算に使う乱数係数
 * 0.95 <= rand < 1.05 に収め、式全体を過度に変動させないようにする
 */
export function getHitRateRandomModifier(rng: () => number): number {
  return 0.95 + rng() * 0.1
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

function getActionsPerTurn(unit: Pick<BattleUnit, 'skills'>): number {
  return hasActTwicePerTurnSkill(unit.skills) ? 2 : 1
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

  private mergeLearnedSpells(
    explicitSpells: LearnedSpell[] | undefined,
    skills: CharacterSkill[],
    level: number,
  ): LearnedSpell[] | undefined {
    const merged = new Map<string, LearnedSpell>()

    for (const spell of explicitSpells ?? []) {
      merged.set(spell.spellId, { ...spell })
    }

    for (const spell of getLearnedSpellsFromSkills(skills, level)) {
      const existing = merged.get(spell.spellId)
      if (!existing) {
        merged.set(spell.spellId, { ...spell })
        continue
      }

      existing.extraCharges = Math.max(existing.extraCharges ?? 0, spell.extraCharges ?? 0)
    }

    return merged.size > 0 ? [...merged.values()] : undefined
  }

  public executeBattle(
    allies: Goblin[],
    initialAllyHP: number[],
    enemies: Enemy[][],
    rng: () => number,
    maxTurns: number = 20,
  ): BattleResult {
    const pureGoblinCount = allies.filter((goblin) => isPureGoblin(goblin)).length
    const allyUnits = allies.map((goblin, index) =>
      this.createAllyUnit(goblin, initialAllyHP[index], index, pureGoblinCount),
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
    this.assignEnemyLogNames(enemyUnits)

    const detailedLog: BattleLogEntry[] = []
    let currentTurn = 0

    while (currentTurn < maxTurns) {
      currentTurn++

      for (const unit of [...allyUnits, ...enemyUnits]) {
        unit.isDefending = false
      }

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

      const turnActedUnitKeys = new Set<string>()
      const turnConsumedUnitKeys = new Set<string>()

      const actingUnits = [...allyUnits, ...enemyUnits]
        .filter(unit => unit.currentHP > 0)
        .flatMap((unit) => {
          const actionOrder = getActionOrderValue(
            unit.agility,
            getActionOrderMultiplierFromSkills(unit.skills),
            getActionOrderRandomFactor(rng),
          )
          return Array.from({ length: getActionsPerTurn(unit) }, (_, actionIndex) => ({
            unit,
            actionOrder,
            actionIndex,
          }))
        })
        .sort((a, b) => {
          if (b.actionOrder !== a.actionOrder) return b.actionOrder - a.actionOrder
          if (a.unit.originalIndex !== b.unit.originalIndex) return a.unit.originalIndex - b.unit.originalIndex
          return a.actionIndex - b.actionIndex
        })
        .map(({ unit }) => unit)

      for (const unit of actingUnits) {
        if (unit.currentHP <= 0) continue
        const unitKey = this.getUnitKey(unit)
        if (turnConsumedUnitKeys.has(unitKey)) continue

        const targetGroup = unit.isAlly ? enemyUnits : allyUnits
        const sourceGroup = unit.isAlly ? allyUnits : enemyUnits

        // 行動決定: 有効に使える呪文チャージがあれば呪文優先
        const spellAction = this.decideSpellAction(unit, targetGroup, sourceGroup, rng)

        if (spellAction) {
          // 呪文実行
          const { targetDetails, totalHitCount } = this.executeSpell(
            unit,
            spellAction,
            targetGroup,
            sourceGroup,
            currentTurn,
            detailedLog,
            turnActedUnitKeys,
            turnConsumedUnitKeys,
            rng,
          )

          // チャージ消費
          const charge = unit.spellCharges.find(sc => sc.spellId === spellAction.id)
          if (charge) charge.remaining--

          detailedLog.push({
            turn: currentTurn,
            actorId: unit.combatant.id,
            actorName: this.getLogName(unit),
            actorRow: unit.row + 1,
            action: spellAction.name,
            attackCount: totalHitCount,
            hitCount: totalHitCount,
            actorHP: unit.currentHP,
            actorMaxHP: unit.maxHP,
            isAlly: unit.isAlly,
            actionEffect: spellAction.effect ?? 'damage',
            targets: [...targetDetails.values()],
          })
          this.tryMagicSupportFollowUps(
            unit,
            spellAction,
            sourceGroup,
            targetGroup,
            allyUnits,
            currentTurn,
            detailedLog,
            turnActedUnitKeys,
            turnConsumedUnitKeys,
            rng,
          )
          turnActedUnitKeys.add(unitKey)
        } else if (shouldRunRate(unit.battleActionPolicy.attackRate, rng)) {
          const { targetDetails, totalHitCount, isCritical, damagedTargets } = this.executeBasicAttack(
            unit,
            targetGroup,
            sourceGroup,
            allyUnits,
            currentTurn,
            detailedLog,
            turnActedUnitKeys,
            turnConsumedUnitKeys,
            rng,
            unit.attackCount,
            unit.criticalRate,
          )

          detailedLog.push({
            turn: currentTurn,
            actorId: unit.combatant.id,
            actorName: this.getLogName(unit),
            actorRow: unit.row + 1,
            action: BASIC_ATTACK_SKILL.name,
            attackCount: unit.attackCount,
            hitCount: totalHitCount,
            actorHP: unit.currentHP,
            actorMaxHP: unit.maxHP,
            isAlly: unit.isAlly,
            isCritical,
            targets: [...targetDetails.values()],
          })
          if (isCritical) {
            this.tryCriticalAttackFollowUps(
              unit,
              sourceGroup,
              targetGroup,
              allyUnits,
              currentTurn,
              detailedLog,
              turnActedUnitKeys,
              turnConsumedUnitKeys,
              rng,
            )
          }
          this.tryPhysicalCounterAttacks(
            unit,
            damagedTargets,
            allyUnits,
            enemyUnits,
            currentTurn,
            detailedLog,
            turnActedUnitKeys,
            turnConsumedUnitKeys,
            rng,
          )
          turnActedUnitKeys.add(unitKey)
        } else {
          unit.isDefending = true
          this.recoverRandomUsedSpellOnDefend(unit, rng)
          detailedLog.push({
            turn: currentTurn,
            actorId: unit.combatant.id,
            actorName: this.getLogName(unit),
            actorRow: unit.row + 1,
            action: i18n.t('battle.defendAction'),
            attackCount: 0,
            hitCount: 0,
            actorHP: unit.currentHP,
            actorMaxHP: unit.maxHP,
            isAlly: unit.isAlly,
            actionEffect: 'defend',
            targets: [],
          })
          turnActedUnitKeys.add(unitKey)
        }

        // 敵または味方が全滅したら即座にターン終了
        const allEnemiesDefeated = enemyUnits.every(u => u.currentHP <= 0)
        const allAlliesDefeated = allyUnits.every(u => u.currentHP <= 0)
        if (allEnemiesDefeated || allAlliesDefeated) break
      }

      // ターン終了時：HP回復能力を持つ生存ユニットのHP回復
      for (const unit of [...allyUnits, ...enemyUnits]) {
        if (unit.currentHP <= 0) continue
        const regenPercent = getHpRegenPercentFromSkills(unit.skills)
        const regenFlat = getHpRegenAmountFromSkills(unit.skills)
        const regenAmount = Math.floor(unit.maxHP * regenPercent / 100) + regenFlat
        if (regenAmount <= 0) continue
        const before = unit.currentHP
        unit.currentHP = Math.min(unit.maxHP, unit.currentHP + regenAmount)
        if (unit.currentHP > before) {
          detailedLog.push({
            turn: currentTurn,
            actorId: unit.combatant.id,
            actorName: this.getLogName(unit),
            actorRow: unit.row + 1,
            action: i18n.t('battle.hpRegenAction'),
            attackCount: 0,
            hitCount: 0,
            actorHP: unit.currentHP,
            actorMaxHP: unit.maxHP,
            isAlly: unit.isAlly,
            actionEffect: 'regen',
            targets: [{
              targetId: unit.combatant.id,
              targetName: this.getLogName(unit),
              targetRow: unit.row + 1,
              totalDamage: -(unit.currentHP - before),
              hitCount: 0,
              defeated: false,
              targetHP: unit.currentHP,
            }],
          })
        }
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
   * 乱数A は 0.95 以上 1.05 未満
   * clamp(5, 95)
   */
  private calculateHitRate(
    attacker: BattleUnit,
    defender: BattleUnit,
    attackNumber: number,
    rng: () => number,
  ): number {
    const accMod = getAccuracyModifier(attackNumber)
    const rand = getHitRateRandomModifier(rng)

    // 残りHP補正 = 0.5 * (1 + 残りHP / 最大HP)
    const hpRatio = defender.maxHP > 0 ? defender.currentHP / defender.maxHP : 0
    const hpMod = 0.5 * (1 + hpRatio)

    const hitRate = rand * (attacker.accuracy * accMod - defender.evasion * hpMod)

    // 限界値補正: 5% 〜 95%
    return Math.max(5, Math.min(95, hitRate))
  }

  private executeBasicAttack(
    unit: BattleUnit,
    targetGroup: BattleUnit[],
    sourceGroup: BattleUnit[],
    allyUnits: BattleUnit[],
    currentTurn: number,
    detailedLog: BattleLogEntry[],
    turnActedUnitKeys: Set<string>,
    turnConsumedUnitKeys: Set<string>,
    rng: () => number,
    attackCount: number,
    criticalRate: number,
    fixedTarget?: BattleUnit,
  ): {
    targetDetails: Map<string, AttackTargetDetail>
    totalHitCount: number
    isCritical: boolean
    damagedTargets: Map<string, BattleUnit>
  } {
    let totalHitCount = 0
    const targetDetails: Map<string, AttackTargetDetail> = new Map()
    const damagedTargets: Map<string, BattleUnit> = new Map()
    const isCritical = rng() * 100 < criticalRate

    for (let atkIdx = 0; atkIdx < attackCount; atkIdx++) {
      if (unit.currentHP <= 0) break

      const aliveTargets = fixedTarget
        ? (fixedTarget.currentHP > 0 ? [fixedTarget] : [])
        : targetGroup.filter(target => target.currentHP > 0)
      if (aliveTargets.length === 0) break

      const initialTarget = fixedTarget ?? selectTarget(aliveTargets, rng)
      const target = fixedTarget ?? this.resolveCoverTarget(initialTarget, targetGroup)

      const hitRate = this.calculateHitRate(unit, target, atkIdx + 1, rng)
      const isHit = rng() * 100 < hitRate

      if (!isHit) continue

      totalHitCount++

      const damageTarget = isCritical
        ? { ...target.combatant, def: Math.floor(target.combatant.def * 0.5) }
        : target.combatant
      const baseDamage = this.damageCalculator.calcDamage(
        RACE_DICT,
        unit.combatant,
        damageTarget,
        BASIC_ATTACK_SKILL,
        DEFAULT_DAMAGE_OPTIONS,
        rng,
      )
      const dmgMod = getDamageModifier(atkIdx + 1)
      const additionalDamage = getAdditionalDamageFromSkills(unit.skills)
      const rearDamageMultiplier = this.getRearDamageMultiplier(unit, sourceGroup)
      const rowDamageMultiplier = getRowDamageMultiplierFromSkills(unit.skills, unit.row)
      const reductionFactor = 1 - target.damageReduction / 100
      const physicalReductionFactor = 1 - target.physicalDamageReduction / 100
      const shieldBarrierReductionFactor = 1 - target.shieldBarrierDamageReduction / 100
      const protectionFactor = this.getRearGuardReductionFactor(target, allyUnits)
      const defendingFactor = this.getDefendingDamageFactor(target)
      const physicalDamageFactor = 1 + unit.physicalDamagePercent / 100
      const damage = Math.max(
        1,
        Math.floor((baseDamage * dmgMod * rearDamageMultiplier * rowDamageMultiplier + additionalDamage) * physicalDamageFactor * unit.physicalDamageDealtMultiplier * reductionFactor * physicalReductionFactor * shieldBarrierReductionFactor * protectionFactor * defendingFactor),
      )

      this.applyDamage(target, damage)
      damagedTargets.set(this.getUnitKey(target), target)
      this.tryImmediateReviveForFallenAlly(
        target,
        target.isAlly ? allyUnits : targetGroup,
        currentTurn,
        detailedLog,
        turnActedUnitKeys,
        turnConsumedUnitKeys,
      )

      this.accumulateTargetDetail(targetDetails, target, damage)
    }

    return { targetDetails, totalHitCount, isCritical, damagedTargets }
  }

  private tryPhysicalCounterAttacks(
    attacker: BattleUnit,
    damagedTargets: Map<string, BattleUnit>,
    allyUnits: BattleUnit[],
    enemyUnits: BattleUnit[],
    currentTurn: number,
    detailedLog: BattleLogEntry[],
    turnActedUnitKeys: Set<string>,
    turnConsumedUnitKeys: Set<string>,
    rng: () => number,
  ): void {
    if (attacker.currentHP <= 0) return

    for (const defender of damagedTargets.values()) {
      if (defender.currentHP <= 0 || attacker.currentHP <= 0) continue
      const counterAttack = getPhysicalCounterAttackFromSkills(defender.skills)
      if (!counterAttack) continue

      const triggerRate = Math.max(0, Math.min(100, defender.power ?? 0))
      if (rng() * 100 >= triggerRate) continue

      const sourceGroup = defender.isAlly ? allyUnits : enemyUnits
      const followUpAttackCount = Math.max(1, Math.floor(defender.attackCount * counterAttack.attackCountMultiplier))
      const { targetDetails, totalHitCount, isCritical, damagedTargets: counterDamagedTargets } = this.executeBasicAttack(
        defender,
        [attacker],
        sourceGroup,
        allyUnits,
        currentTurn,
        detailedLog,
        turnActedUnitKeys,
        turnConsumedUnitKeys,
        rng,
        followUpAttackCount,
        defender.criticalRate * counterAttack.criticalRateMultiplier,
        attacker,
      )

      detailedLog.push({
        turn: currentTurn,
        actorId: defender.combatant.id,
        actorName: this.getLogName(defender),
        actorRow: defender.row + 1,
        action: i18n.t('battle.physicalCounterAttackAction'),
        attackCount: followUpAttackCount,
        hitCount: totalHitCount,
        actorHP: defender.currentHP,
        actorMaxHP: defender.maxHP,
        isAlly: defender.isAlly,
        isCritical,
        actionEffect: 'damage',
        targets: [...targetDetails.values()],
      })

      this.tryPhysicalCounterAttacks(
        defender,
        counterDamagedTargets,
        allyUnits,
        enemyUnits,
        currentTurn,
        detailedLog,
        turnActedUnitKeys,
        turnConsumedUnitKeys,
        rng,
      )
    }
  }

  private tryCriticalAttackFollowUps(
    attacker: BattleUnit,
    sourceGroup: BattleUnit[],
    targetGroup: BattleUnit[],
    allyUnits: BattleUnit[],
    currentTurn: number,
    detailedLog: BattleLogEntry[],
    turnActedUnitKeys: Set<string>,
    turnConsumedUnitKeys: Set<string>,
    rng: () => number,
  ): void {
    if (!targetGroup.some(target => target.currentHP > 0)) return

    for (const supporter of sourceGroup) {
      if (supporter.currentHP <= 0 || supporter === attacker) continue
      const followUp = getCriticalAttackFollowUpFromSkills(supporter.skills)
      if (!followUp) continue

      const triggerRate = Math.max(0, Math.min(100, supporter.agility + supporter.luck))
      if (rng() * 100 >= triggerRate) continue

      const followUpAttackCount = Math.max(1, Math.floor(supporter.attackCount * followUp.attackCountMultiplier))
      const { targetDetails, totalHitCount, isCritical, damagedTargets } = this.executeBasicAttack(
        supporter,
        targetGroup,
        sourceGroup,
        allyUnits,
        currentTurn,
        detailedLog,
        turnActedUnitKeys,
        turnConsumedUnitKeys,
        rng,
        followUpAttackCount,
        supporter.criticalRate * followUp.criticalRateMultiplier,
      )

      detailedLog.push({
        turn: currentTurn,
        actorId: supporter.combatant.id,
        actorName: this.getLogName(supporter),
        actorRow: supporter.row + 1,
        action: i18n.t('battle.criticalSupportFollowUpAction'),
        attackCount: followUpAttackCount,
        hitCount: totalHitCount,
        actorHP: supporter.currentHP,
        actorMaxHP: supporter.maxHP,
        isAlly: supporter.isAlly,
        isCritical,
        actionEffect: 'damage',
        targets: [...targetDetails.values()],
      })
      this.tryPhysicalCounterAttacks(
        supporter,
        damagedTargets,
        allyUnits,
        supporter.isAlly ? targetGroup : sourceGroup,
        currentTurn,
        detailedLog,
        turnActedUnitKeys,
        turnConsumedUnitKeys,
        rng,
      )

      if (!targetGroup.some(target => target.currentHP > 0)) return
    }
  }

  private tryMagicSupportFollowUps(
    caster: BattleUnit,
    spellDef: SpellDef,
    sourceGroup: BattleUnit[],
    targetGroup: BattleUnit[],
    allyUnits: BattleUnit[],
    currentTurn: number,
    detailedLog: BattleLogEntry[],
    turnActedUnitKeys: Set<string>,
    turnConsumedUnitKeys: Set<string>,
    rng: () => number,
  ): void {
    if ((spellDef.effect ?? 'damage') !== 'damage') return
    if (!targetGroup.some(target => target.currentHP > 0)) return

    for (const supporter of sourceGroup) {
      if (supporter.currentHP <= 0 || supporter === caster) continue
      const followUp = getMagicDamageFollowUpFromSkills(supporter.skills)
      if (!followUp) continue

      const triggerRate = Math.max(0, Math.min(100, supporter.agility + supporter.luck))
      if (rng() * 100 >= triggerRate) continue

      const followUpAttackCount = Math.max(1, Math.floor(supporter.attackCount * followUp.attackCountMultiplier))
      const { targetDetails, totalHitCount, isCritical, damagedTargets } = this.executeBasicAttack(
        supporter,
        targetGroup,
        sourceGroup,
        allyUnits,
        currentTurn,
        detailedLog,
        turnActedUnitKeys,
        turnConsumedUnitKeys,
        rng,
        followUpAttackCount,
        supporter.criticalRate * followUp.criticalRateMultiplier,
      )

      detailedLog.push({
        turn: currentTurn,
        actorId: supporter.combatant.id,
        actorName: this.getLogName(supporter),
        actorRow: supporter.row + 1,
        action: i18n.t('battle.magicSupportFollowUpAction'),
        attackCount: followUpAttackCount,
        hitCount: totalHitCount,
        actorHP: supporter.currentHP,
        actorMaxHP: supporter.maxHP,
        isAlly: supporter.isAlly,
        isCritical,
        actionEffect: 'damage',
        targets: [...targetDetails.values()],
      })
      this.tryPhysicalCounterAttacks(
        supporter,
        damagedTargets,
        allyUnits,
        supporter.isAlly ? targetGroup : sourceGroup,
        currentTurn,
        detailedLog,
        turnActedUnitKeys,
        turnConsumedUnitKeys,
        rng,
      )

      if (!targetGroup.some(target => target.currentHP > 0)) return
    }
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
          category: this.getSpellCategory(ls.spellId),
        }
      })
      .filter((sc): sc is SpellCharge => sc !== null)
  }

  private getSpellCategory(spellId: string): SpellCategory {
    if (CLERIC_MAGIC_SPELL_IDS.has(spellId)) {
      return 'cleric'
    }
    return 'mage'
  }

  /**
   * 使用可能な呪文があれば返す（呪文優先AI）
   */
  private decideSpellAction(
    unit: BattleUnit,
    targetGroup: BattleUnit[],
    sourceGroup: BattleUnit[],
    rng: () => number,
  ): SpellDef | null {
    for (const sc of unit.spellCharges) {
      if (sc.remaining > 0) {
        const def = SPELL_DEFS[sc.spellId]
        if (!def || !this.canUseSpell(def, targetGroup, sourceGroup)) continue
        const useRate = sc.category === 'cleric'
          ? unit.battleActionPolicy.clericMagicRate
          : unit.battleActionPolicy.mageMagicRate
        if (shouldRunRate(useRate, rng)) return def
      }
    }
    return null
  }

  private canUseSpell(
    spellDef: SpellDef,
    targetGroup: BattleUnit[],
    sourceGroup: BattleUnit[],
  ): boolean {
    const effect = spellDef.effect ?? 'damage'

    if (effect === 'damage') {
      return targetGroup.some(unit => unit.currentHP > 0)
    }

    if (effect === 'heal') {
      if (spellDef.targeting.type === 'single_ally_below_half_hp') {
        return sourceGroup.some(unit => unit.currentHP > 0 && unit.maxHP > 0 && unit.currentHP <= unit.maxHP / 2)
      }
      return sourceGroup.some(unit => unit.currentHP > 0 && unit.currentHP < unit.maxHP)
    }

    if (effect === 'barrier') {
      const reduction = spellDef.damageReductionPercent ?? 0
      const breathReduction = spellDef.breathDamageReductionPercent ?? 0
      const magicReduction = spellDef.magicDamageReductionPercent ?? 0
      return sourceGroup.some(unit => (
        unit.currentHP > 0 &&
        (
          (reduction > 0 && unit.shieldBarrierDamageReduction < reduction) ||
          (breathReduction > 0 && unit.shieldBarrierBreathDamageReduction < breathReduction) ||
          (magicReduction > 0 && unit.magicBarrierDamageReduction < magicReduction)
        )
      ))
    }

    if (effect === 'attack_up') {
      return sourceGroup.some(unit => (
        unit.currentHP > 0 &&
        unit.physicalDamageDealtMultiplier < ATTACK_UP_PHYSICAL_DAMAGE_MULTIPLIER
      ))
    }

    // cure: 現在は状態異常システム未実装のため常にfalse
    if (effect === 'cure') {
      return false
    }

    return false
  }

  private recoverRandomUsedSpellOnDefend(unit: BattleUnit, rng: () => number): void {
    if (!hasRecoverRandomUsedSpellOnDefendSkill(unit.skills)) {
      return
    }

    const usedSpellCharges = unit.spellCharges.filter((charge) => charge.remaining < charge.maxCharges)
    if (usedSpellCharges.length === 0) {
      return
    }

    const selectedCharge = usedSpellCharges[Math.floor(rng() * usedSpellCharges.length)]
    selectedCharge.remaining = Math.min(selectedCharge.remaining + 1, selectedCharge.maxCharges)
  }

  /**
   * 呪文のターゲット数を計算
   */
  private getSpellHitCount(spellDef: SpellDef, level: number): number {
    const t = spellDef.targeting
    if (t.type === 'random_hits') return t.hitCount
    if (t.type === 'single_ally_lowest_hp') return 1
    if (t.type === 'single_ally_below_half_hp') return 1
    if (t.type === 'all_allies') return 0
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
    sourceGroup: BattleUnit[],
    currentTurn: number,
    detailedLog: BattleLogEntry[],
    turnActedUnitKeys: Set<string>,
    turnConsumedUnitKeys: Set<string>,
    rng: () => number,
  ): { targetDetails: Map<string, AttackTargetDetail>; totalHitCount: number } {
    const targetDetails: Map<string, AttackTargetDetail> = new Map()
    let totalHitCount = 0
    const hitCount = this.getSpellHitCount(spellDef, unit.level)
    const effect = spellDef.effect ?? 'damage'

    if (effect === 'heal') {
      let targets: BattleUnit[]
      if (spellDef.targeting.type === 'all_allies') {
        targets = sourceGroup.filter(target => target.currentHP > 0 && target.currentHP < target.maxHP)
      } else if (spellDef.targeting.type === 'single_ally_below_half_hp') {
        targets = this.selectBelowHalfHpAlly(sourceGroup)
      } else {
        targets = this.selectLowestHpRatioAlly(sourceGroup)
      }

      for (const target of targets) {
        const healAmount = spellDef.fullHeal
          ? target.maxHP - target.currentHP
          : Math.max(0, Math.floor(unit.magicHeal + (spellDef.healBonus ?? 0)))
        const healed = this.applyHealing(target, healAmount)
        if (healed <= 0) continue
        totalHitCount++
        this.accumulateTargetDetail(targetDetails, target, -healed)
      }

      return { targetDetails, totalHitCount }
    }

    if (effect === 'barrier') {
      const damageReduction = spellDef.damageReductionPercent ?? 0
      const breathReduction = spellDef.breathDamageReductionPercent ?? 0
      const magicReduction = spellDef.magicDamageReductionPercent ?? 0
      const targets = sourceGroup.filter(target => target.currentHP > 0)

      for (const target of targets) {
        if (damageReduction > 0) {
          target.shieldBarrierDamageReduction = Math.max(target.shieldBarrierDamageReduction, damageReduction)
        }
        if (breathReduction > 0) {
          target.shieldBarrierBreathDamageReduction = Math.max(target.shieldBarrierBreathDamageReduction, breathReduction)
        }
        if (magicReduction > 0) {
          target.magicBarrierDamageReduction = Math.max(target.magicBarrierDamageReduction, magicReduction)
          target.magicBarrierActive = true
        }
        if (damageReduction > 0 || breathReduction > 0) {
          target.shieldBarrierActive = true
        }
      }

      return { targetDetails, totalHitCount }
    }

    if (effect === 'attack_up') {
      const targets = sourceGroup.filter(target => target.currentHP > 0)

      for (const target of targets) {
        target.physicalDamageDealtMultiplier = Math.max(
          target.physicalDamageDealtMultiplier,
          ATTACK_UP_PHYSICAL_DAMAGE_MULTIPLIER,
        )
      }

      return { targetDetails, totalHitCount }
    }

    // cure: 状態異常システム実装時に処理追加
    if (effect === 'cure') {
      return { targetDetails, totalHitCount }
    }

    const spellSkill: Skill = {
      id: spellDef.id,
      name: getSpellLabel(spellDef),
      power: spellDef.power,
    }
    const spellBonusDamage = getSpellBonusDamage(unit.level, unit.magicAtk, spellDef)

    if (spellDef.targeting.type === 'random_hits') {
      // マジックアロー: ランダムにhitCount回攻撃（同じ敵に複数回当たりうる）
      for (let i = 0; i < hitCount; i++) {
        const aliveTargets = targetGroup.filter(t => t.currentHP > 0)
        if (aliveTargets.length === 0) break

        // 完全ランダム選択（隊列重みなし）
        const target = aliveTargets[Math.floor(rng() * aliveTargets.length)]

        const baseDamage = this.damageCalculator.calcDamage(
          RACE_DICT, unit.combatant, target.combatant,
          spellSkill, SPELL_DAMAGE_OPTIONS, rng,
        ) + spellBonusDamage
        const rearDamageMultiplier = this.getRearDamageMultiplier(unit, sourceGroup)
        const spellDamageFactor = 1 + unit.spellDamagePercent / 100
        const spellTakenMultiplier = getSpellTakenMultiplierFromSkills(target.skills, spellDef.id)
        const reductionFactor = 1 - target.damageReduction / 100
        const magicReductionFactor = 1 - target.magicDamageReduction / 100
        const magicBarrierFactor = 1 - target.magicBarrierDamageReduction / 100
        const defendingFactor = this.getDefendingDamageFactor(target)
        const damage = Math.max(1, Math.floor(baseDamage * rearDamageMultiplier * spellDamageFactor * spellTakenMultiplier * reductionFactor * magicReductionFactor * magicBarrierFactor * defendingFactor))

        this.applyDamage(target, damage)
        this.tryImmediateReviveForFallenAlly(
          target,
          targetGroup,
          currentTurn,
          detailedLog,
          turnActedUnitKeys,
          turnConsumedUnitKeys,
        )
        totalHitCount++

        this.accumulateTargetDetail(targetDetails, target, damage)
      }
    } else if (spellDef.targeting.type === 'multi_target') {
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
          spellSkill, SPELL_DAMAGE_OPTIONS, rng,
        ) + spellBonusDamage
        const rearDamageMultiplier = this.getRearDamageMultiplier(unit, sourceGroup)
        const spellDamageFactor = 1 + unit.spellDamagePercent / 100
        const spellTakenMultiplier = getSpellTakenMultiplierFromSkills(target.skills, spellDef.id)
        const reductionFactor = 1 - target.damageReduction / 100
        const magicReductionFactor = 1 - target.magicDamageReduction / 100
        const magicBarrierFactor = 1 - target.magicBarrierDamageReduction / 100
        const defendingFactor = this.getDefendingDamageFactor(target)
        const damage = Math.max(1, Math.floor(baseDamage * rearDamageMultiplier * spellDamageFactor * spellTakenMultiplier * reductionFactor * magicReductionFactor * magicBarrierFactor * defendingFactor))

        this.applyDamage(target, damage)
        this.tryImmediateReviveForFallenAlly(
          target,
          targetGroup,
          currentTurn,
          detailedLog,
          turnActedUnitKeys,
          turnConsumedUnitKeys,
        )
        totalHitCount++

        this.accumulateTargetDetail(targetDetails, target, damage)
      }
    }

    return { targetDetails, totalHitCount }
  }

  private selectLowestHpRatioAlly(sourceGroup: BattleUnit[]): BattleUnit[] {
    const target = sourceGroup
      .filter(unit => unit.currentHP > 0 && unit.currentHP < unit.maxHP)
      .sort((a, b) => {
        const aRatio = a.maxHP > 0 ? a.currentHP / a.maxHP : 1
        const bRatio = b.maxHP > 0 ? b.currentHP / b.maxHP : 1
        if (aRatio !== bRatio) return aRatio - bRatio
        return a.row - b.row
      })[0]

    return target ? [target] : []
  }

  /**
   * HPが半分以下の味方の中で最もHP割合が低い1体を選択（フルヒール用）
   */
  private selectBelowHalfHpAlly(sourceGroup: BattleUnit[]): BattleUnit[] {
    const target = sourceGroup
      .filter(unit => unit.currentHP > 0 && unit.maxHP > 0 && unit.currentHP <= unit.maxHP / 2)
      .sort((a, b) => {
        const aRatio = a.currentHP / a.maxHP
        const bRatio = b.currentHP / b.maxHP
        if (aRatio !== bRatio) return aRatio - bRatio
        return a.row - b.row
      })[0]

    return target ? [target] : []
  }

  private accumulateTargetDetail(
    details: Map<string, AttackTargetDetail>,
    target: BattleUnit,
    damage: number,
  ): void {
    const targetKey = this.getUnitKey(target)
    const existing = details.get(targetKey)
    if (existing) {
      existing.totalDamage += damage
      existing.hitCount++
      existing.defeated = target.currentHP <= 0
      existing.targetHP = target.currentHP
    } else {
      details.set(targetKey, {
        targetId: target.combatant.id,
        targetName: this.getLogName(target),
        targetRow: target.row + 1,
        totalDamage: damage,
        hitCount: 1,
        defeated: target.currentHP <= 0,
        targetHP: target.currentHP,
      })
    }
  }

  private applyDamage(target: BattleUnit, damage: number): void {
    const nextHP = target.currentHP - damage

    if (nextHP <= 0 && target.currentHP > 1 && hasSurviveLethalDamageAtHp1Skill(target.skills)) {
      target.currentHP = 1
      return
    }

    target.currentHP = Math.max(0, nextHP)
  }

  private tryImmediateReviveForFallenAlly(
    target: BattleUnit,
    alliedUnits: BattleUnit[],
    currentTurn: number,
    detailedLog: BattleLogEntry[],
    turnActedUnitKeys: Set<string>,
    turnConsumedUnitKeys: Set<string>,
  ): void {
    if (target.currentHP > 0) {
      return
    }

    const reviver = [...alliedUnits]
      .filter((unit) => {
        if (unit.currentHP <= 0) return false
        if (this.getUnitKey(unit) === this.getUnitKey(target)) return false
        if (turnActedUnitKeys.has(this.getUnitKey(unit))) return false
        return hasImmediateReviveSkill(unit.skills) && this.getImmediateReviveSpell(unit, target) !== null
      })
      .sort((a, b) => {
        if (a.row !== b.row) return a.row - b.row
        if (a.rowSlot !== b.rowSlot) return a.rowSlot - b.rowSlot
        return a.originalIndex - b.originalIndex
      })[0]

    if (!reviver) {
      return
    }

    const revival = this.getImmediateReviveSpell(reviver, target)
    if (!revival) {
      return
    }

    const healed = this.applyHealing(target, revival.healAmount)
    if (healed <= 0) {
      return
    }

    revival.charge.remaining--
    const reviverKey = this.getUnitKey(reviver)
    turnActedUnitKeys.add(reviverKey)
    turnConsumedUnitKeys.add(reviverKey)

    detailedLog.push({
      turn: currentTurn,
      actorId: reviver.combatant.id,
      actorName: this.getLogName(reviver),
      actorRow: reviver.row + 1,
      action: revival.spellDef.name,
      attackCount: 1,
      hitCount: 1,
      actorHP: reviver.currentHP,
      actorMaxHP: reviver.maxHP,
      isAlly: reviver.isAlly,
      actionEffect: 'heal',
      targets: [{
        targetId: target.combatant.id,
        targetName: this.getLogName(target),
        targetRow: target.row + 1,
        totalDamage: -healed,
        hitCount: 1,
        defeated: false,
        targetHP: target.currentHP,
      }],
    })
  }

  private getImmediateReviveSpell(
    unit: BattleUnit,
    target: BattleUnit,
  ): { charge: SpellCharge; spellDef: SpellDef; healAmount: number } | null {
    let best: { charge: SpellCharge; spellDef: SpellDef; healAmount: number } | null = null

    for (const charge of unit.spellCharges) {
      if (charge.remaining <= 0 || charge.category !== 'cleric') continue
      const spellDef = SPELL_DEFS[charge.spellId]
      if (!spellDef || (spellDef.effect ?? 'damage') !== 'heal') continue
      const healAmount = this.getImmediateReviveHealAmount(unit, target, spellDef)
      if (healAmount <= 0) continue
      if (!best || healAmount > best.healAmount) {
        best = { charge, spellDef, healAmount }
      }
    }

    return best
  }

  private getImmediateReviveHealAmount(unit: BattleUnit, target: BattleUnit, spellDef: SpellDef): number {
    if (spellDef.fullHeal) {
      return target.maxHP
    }

    return Math.max(0, Math.floor(unit.magicHeal + (spellDef.healBonus ?? 0)))
  }

  private applyHealing(target: BattleUnit, amount: number): number {
    const before = target.currentHP
    target.currentHP = Math.min(target.maxHP, target.currentHP + amount)
    return target.currentHP - before
  }

  private getDefendingDamageFactor(target: BattleUnit): number {
    return target.isDefending ? 0.5 : 1
  }

  private createAllyUnit(
    goblin: Goblin,
    initialHP: number | undefined,
    originalIndex: number,
    pureGoblinCount: number,
  ): BattleUnit {
    const skills = getUniqueSkillsById(goblin.skills)
    const combatant = this.combatantManager.fromGoblin(goblin)
    combatant.buffs = toCombatBuffsFromSkills(skills)
    const actionOrderAgility = (goblin as Goblin & { agility?: number }).agility
    const baseAttributes = getGoblinBaseAttributesAtLevel(goblin, goblin.level)
    // Mod適用後のステータスを使用
    const effectiveStats = getEffectiveStats(goblin)
    const packBonusPercent =
      getPureGoblinPartyStatBonusPercentFromSkills(skills, goblin.level) * pureGoblinCount
    const packStatMultiplier = 1 + packBonusPercent / 100
    const maxHP = Math.floor(effectiveStats.hp * packStatMultiplier)
    const atk = Math.floor(combatant.atk * packStatMultiplier)
    combatant.atk = atk
    const hp = initialHP === undefined || initialHP >= effectiveStats.hp
      ? maxHP
      : Math.min(initialHP, maxHP)
    const damageReduction = ModStatCalculator.getDamageReduction(goblin)
    const physicalDamageReduction = getPhysicalDamageReductionFromSkills(goblin.skills)
    const magicDamageReduction = getMagicDamageReductionFromSkills(goblin.skills)
    const learnedSpells = this.mergeLearnedSpells(goblin.spells, goblin.skills, goblin.level)
    return {
      instanceId: `ally:${combatant.id}`,
      combatant,
      currentHP: hp,
      maxHP,
      initialHP: hp,
      power: baseAttributes.power,
      agility: actionOrderAgility ?? baseAttributes.agility,
      luck: baseAttributes.luck,
      attackCount: effectiveStats.attackCount,
      accuracy: effectiveStats.accuracy,
      evasion: effectiveStats.evasion,
      isAlly: true,
      originalIndex,
      damageReduction,
      physicalDamageReduction,
      magicDamageReduction,
      breathDamageReduction: 0,
      shieldBarrierDamageReduction: 0,
      shieldBarrierBreathDamageReduction: 0,
      magicBarrierDamageReduction: 0,
      physicalDamageDealtMultiplier: 1,
      physicalDamagePercent: getPhysicalDamagePercentFromSkills(goblin.skills),
      magicAtk: effectiveStats.magicAtk,
      magicHeal: effectiveStats.magicHeal,
      criticalRate: effectiveStats.criticalRate,
      spellDamagePercent: getSpellDamagePercentFromSkills(goblin.skills),
      shieldBarrierActive: false,
      magicBarrierActive: false,
      row: originalIndex,  // 味方は1列1体（配列順 = 列番号）
      rowSlot: 0,
      level: goblin.level,
      spellCharges: this.initSpellCharges(learnedSpells),
      skills,
      battleActionPolicy: normalizeBattleActionPolicy(goblin.battleActionPolicy),
      isDefending: false,
    }
  }

  private createEnemyUnit(enemy: Enemy, originalIndex: number, row: number, rowSlot: number): BattleUnit {
    const skills = getUniqueSkillsById([...(enemy.skills ?? []), ...getRaceSkills(enemy.raceTags)])
    const combatant = this.combatantManager.fromEnemy(enemy)
    combatant.buffs = toCombatBuffsFromSkills(skills)
    const learnedSpells = this.mergeLearnedSpells(enemy.spells, skills, enemy.level)
    const raceResistance = getRaceResistanceTotals(enemy.raceTags)
    return {
      instanceId: `enemy:${combatant.id}:${originalIndex}`,
      combatant,
      currentHP: enemy.hp,
      maxHP: enemy.hp,
      initialHP: enemy.hp,
      power: enemy.baseAttributes.power,
      agility: enemy.baseAttributes.agility,
      luck: enemy.baseAttributes.luck,
      attackCount: enemy.attackCount,
      accuracy: enemy.accuracy,
      evasion: enemy.evasion,
      isAlly: false,
      originalIndex,
      damageReduction: 0,  // 敵は被ダメージ軽減なし
      physicalDamageReduction:
        raceResistance.physicalResistancePercent +
        (enemy.physicalResistancePercent ?? 0) +
        getPhysicalDamageReductionFromSkills(skills),
      magicDamageReduction:
        raceResistance.magicResistancePercent +
        (enemy.magicResistancePercent ?? 0) +
        getMagicDamageReductionFromSkills(skills),
      breathDamageReduction: 0,
      shieldBarrierDamageReduction: 0,
      shieldBarrierBreathDamageReduction: 0,
      magicBarrierDamageReduction: 0,
      physicalDamageDealtMultiplier: 1,
      physicalDamagePercent: getPhysicalDamagePercentFromSkills(skills),
      magicAtk: enemy.magicAtk ?? enemy.atk,
      magicHeal: enemy.magicHeal ?? 0,
      criticalRate: enemy.criticalRate ?? 0,
      spellDamagePercent: getSpellDamagePercentFromSkills(skills),
      shieldBarrierActive: false,
      magicBarrierActive: false,
      row,
      rowSlot,
      level: enemy.level,
      spellCharges: this.initSpellCharges(learnedSpells),
      skills,
      battleActionPolicy: normalizeBattleActionPolicy(enemy.battleActionPolicy),
      isDefending: false,
    }
  }

  private getRearGuardReductionFactor(target: BattleUnit, allyUnits: BattleUnit[]): number {
    if (!target.isAlly || target.currentHP <= 0) return 1

    const frontmostRearGuardUnit = allyUnits
      .filter((ally) => (
        ally.currentHP > 0 &&
        ally.row < target.row &&
        getRearProtectionMultiplierFromSkills(ally.skills) !== 1
      ))
      .sort((a, b) => {
        if (a.row !== b.row) return a.row - b.row
        return a.rowSlot - b.rowSlot
      })[0]

    if (!frontmostRearGuardUnit) {
      return 1
    }

    return getRearProtectionMultiplierFromSkills(frontmostRearGuardUnit.skills)
  }

  private getRearDamageMultiplier(unit: BattleUnit, groupUnits: BattleUnit[]): number {
    const frontmostInspireUnit = groupUnits
      .filter((ally) => (
        ally.currentHP > 0 &&
        ally.row < unit.row &&
        getRearAllyDamageMultiplierFromSkills(ally.skills) !== 1
      ))
      .sort((a, b) => {
        if (a.row !== b.row) return a.row - b.row
        return a.rowSlot - b.rowSlot
      })[0]

    if (!frontmostInspireUnit) {
      return 1
    }

    return getRearAllyDamageMultiplierFromSkills(frontmostInspireUnit.skills)
  }

  private resolveCoverTarget(target: BattleUnit, defendingGroup: BattleUnit[]): BattleUnit {
    if (target.currentHP <= 0 || target.currentHP > Math.floor(target.maxHP / 2)) {
      return target
    }

    const candidates = defendingGroup
      .filter((unit) => (
        unit.currentHP > 0 &&
        this.getUnitKey(unit) !== this.getUnitKey(target) &&
        unit.row < target.row &&
        hasCoverLowHpAllySkill(unit.skills)
      ))
      .sort((a, b) => b.row - a.row)

    return candidates[0] ?? target
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
          name: this.getLogName(unit),
          currentHP: unit.currentHP,
          maxHP: unit.maxHP,
          shieldBarrierActive: unit.shieldBarrierActive,
          magicBarrierActive: unit.magicBarrierActive,
          isDefending: unit.isDefending,
        })),
        enemies: enemyUnits.map(unit => ({
          id: unit.combatant.id,
          name: this.getLogName(unit),
          currentHP: unit.currentHP,
          maxHP: unit.maxHP,
          shieldBarrierActive: unit.shieldBarrierActive,
          magicBarrierActive: unit.magicBarrierActive,
          isDefending: unit.isDefending,
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

  private getUnitKey(unit: BattleUnit): string {
    return unit.instanceId ?? unit.combatant.id
  }

  private getLogName(unit: BattleUnit): string {
    const name = unit.logName ?? unit.combatant.name
    return `Lv${unit.level} ${name}`
  }

  private assignEnemyLogNames(enemyUnits: BattleUnit[]): void {
    const groups = new Map<string, BattleUnit[]>()

    for (const unit of enemyUnits) {
      const group = groups.get(unit.combatant.id) ?? []
      group.push(unit)
      groups.set(unit.combatant.id, group)
    }

    for (const group of groups.values()) {
      if (group.length === 1) {
        group[0].logName = group[0].combatant.name
        continue
      }

      group.forEach((unit, index) => {
        unit.logName = `${unit.combatant.name}${this.toAlphabetLabel(index)}`
      })
    }
  }

  private toAlphabetLabel(index: number): string {
    let n = index
    let label = ''

    do {
      label = String.fromCharCode(65 + (n % 26)) + label
      n = Math.floor(n / 26) - 1
    } while (n >= 0)

    return label
  }
}
