import type { AttackTargetDetail, BattleLogEntry, Enemy, Goblin } from '../../shared/types'
import {
  getActionOrderMultiplierFromSkills,
  getAdditionalDamageFromSkills,
  getMagicDamageFollowUpFromSkills,
  getCriticalAttackFollowUpFromSkills,
  getPhysicalCounterAttackFromSkills,
  getCounterAttackAvoidanceRateFromSkills,
  getSpellTakenMultiplierFromSkills,
  getSpellDamageMultiplierFromSkills,
  getPartyMagicDamageMultiplierFromSkills,
  getHpRegenPercentFromSkills,
  getHpRegenAmountFromSkills,
} from '../../shared/data/characterSkills'
import type { SpellDef } from '../../shared/types/Spell'
import { CombatantManager } from './CombatantManager'
import { DamageCalculator } from './DamageCalculator'
import { isPureGoblin } from '../../shared/utils/goblinStats'
import i18n from '../../shared/i18n'
import { getSkillLabel, getSpellLabel } from '../../shared/i18n/entityLocalization'
import { shouldRunRate } from '../../shared/utils/battleActionPolicy'
import { races as RACE_DICT } from '../../shared/data/races'
import type { Skill } from './DamageCalculator'
import type { BattleResult, BattleUnit } from './battle/types'
import {
  ATTACK_UP_PHYSICAL_DAMAGE_MULTIPLIER,
  BASIC_ATTACK_SKILL,
  DEFAULT_DAMAGE_OPTIONS,
  MAX_COUNTER_ATTACK_DEPTH,
  SPELL_DAMAGE_OPTIONS,
  TWO_COLUMN_ATTACK_DAMAGE_MULTIPLIER,
} from './battle/constants'
import {
  calculateHitRate,
  getActionOrderRandomFactor,
  getActionOrderValue,
  getDamageModifier,
  getSpellBonusDamage,
} from './battle/combatMath'
import { getActionsPerTurn, selectTarget } from './battle/targeting'
import {
  accumulateTargetDetail,
  assignEnemyLogNames,
  createBattleResult,
  createTurnStartLog,
  getLogName,
  getSortedTargetDetails,
  getUnitKey,
} from './battle/logHelpers'
import { createAllyUnit, createEnemyUnit } from './battle/unitFactory'
import {
  decideSpellAction,
  getSpellHitCount,
  recoverRandomUsedSpellOnDefend,
  selectBelowHalfHpAlly,
  selectLowestHpRatioAlly,
} from './battle/spellAi'
import {
  applyDamage,
  applyHealing,
  tryImmediateReviveForFallenAllies,
  tryImmediateReviveForFallenAlly,
} from './battle/effects'
import {
  getDefendingDamageFactor,
  getRearDamageMultiplier,
  getRearGuardReductionFactor,
  getRearMagicGuardReductionFactor,
  getUnitRowDamageMultiplier,
  resolveCoverTarget,
  selectSecondColumnAttackTarget,
} from './battle/positioning'

// 公開APIとして分割前と同じシンボルを再エクスポート（index.ts の `export *` と既存テスト向け）
export type { BattleResult, BattleUnit, SpellCharge, SpellCategory, UsableSpellCharge } from './battle/types'
export {
  getAccuracyModifier,
  getActionOrderValue,
  getDamageModifier,
  getHitRateRandomModifier,
} from './battle/combatMath'
export { getRowWeight, selectTarget } from './battle/targeting'

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

  private applyBattleStartPartyEffects(
    units: BattleUnit[],
    detailedLog: BattleLogEntry[],
  ): void {
    const livingUnits = units.filter(unit => unit.currentHP > 0)
    if (livingUnits.length === 0) return

    const strongestMagicField = livingUnits
      .map(unit => ({
        unit,
        multiplier: getPartyMagicDamageMultiplierFromSkills(unit.skills),
      }))
      .filter(entry => entry.multiplier > 1)
      .sort((a, b) => b.multiplier - a.multiplier)[0]

    if (!strongestMagicField) return

    for (const unit of livingUnits) {
      unit.magicFieldDamageMultiplier = Math.max(unit.magicFieldDamageMultiplier, strongestMagicField.multiplier)
    }

    detailedLog.push({
      turn: 0,
      actorId: strongestMagicField.unit.combatant.id,
      actorName: getLogName(strongestMagicField.unit),
      actorRow: strongestMagicField.unit.row + 1,
      action: getSkillLabel({ id: 'magic_field', partyMagicDamageMultiplier: strongestMagicField.multiplier }),
      attackCount: 0,
      hitCount: 0,
      actorHP: strongestMagicField.unit.currentHP,
      actorMaxHP: strongestMagicField.unit.maxHP,
      isAlly: strongestMagicField.unit.isAlly,
      actionEffect: 'magic_field',
      targets: [],
    })
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
      createAllyUnit(this.combatantManager, goblin, initialAllyHP[index], index, pureGoblinCount),
    )
    // 2D敵配列をフラット化してBattleUnit生成（row/rowSlot付き）
    const enemyUnits: BattleUnit[] = []
    let enemyIdx = 0
    for (let row = 0; row < enemies.length; row++) {
      for (let slot = 0; slot < enemies[row].length; slot++) {
        enemyUnits.push(createEnemyUnit(this.combatantManager, enemies[row][slot], enemyIdx, row, slot))
        enemyIdx++
      }
    }
    assignEnemyLogNames(enemyUnits)

    const detailedLog: BattleLogEntry[] = []
    this.applyBattleStartPartyEffects(allyUnits, detailedLog)
    this.applyBattleStartPartyEffects(enemyUnits, detailedLog)
    let currentTurn = 0

    while (currentTurn < maxTurns) {
      currentTurn++

      for (const unit of [...allyUnits, ...enemyUnits]) {
        unit.isDefending = false
      }

      // ターン10で呪文チャージを1回復（最大チャージまで）
      if (currentTurn === 10) {
        for (const unit of [...allyUnits, ...enemyUnits]) {
          if (unit.currentHP <= 0) continue
          for (const sc of unit.spellCharges) {
            sc.remaining = Math.min(sc.remaining + 1, sc.maxCharges)
          }
        }
      }

      detailedLog.push(createTurnStartLog(currentTurn, allyUnits, enemyUnits))

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
        const unitKey = getUnitKey(unit)
        if (turnConsumedUnitKeys.has(unitKey)) continue

        const targetGroup = unit.isAlly ? enemyUnits : allyUnits
        const sourceGroup = unit.isAlly ? allyUnits : enemyUnits

        // 行動決定: 有効に使える呪文チャージがあれば呪文優先
        const spellAction = decideSpellAction(unit, targetGroup, sourceGroup, rng)

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
            actorName: getLogName(unit),
            actorRow: unit.row + 1,
            action: spellAction.name,
            attackCount: totalHitCount,
            hitCount: totalHitCount,
            actorHP: unit.currentHP,
            actorMaxHP: unit.maxHP,
            isAlly: unit.isAlly,
            actionEffect: spellAction.effect ?? 'damage',
            targets: getSortedTargetDetails(targetDetails),
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
            actorName: getLogName(unit),
            actorRow: unit.row + 1,
            action: BASIC_ATTACK_SKILL.name,
            attackCount: unit.attackCount,
            hitCount: totalHitCount,
            actorHP: unit.currentHP,
            actorMaxHP: unit.maxHP,
            isAlly: unit.isAlly,
            isCritical,
            targets: getSortedTargetDetails(targetDetails),
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
          recoverRandomUsedSpellOnDefend(unit, rng)
          detailedLog.push({
            turn: currentTurn,
            actorId: unit.combatant.id,
            actorName: getLogName(unit),
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
            actorName: getLogName(unit),
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
              targetName: getLogName(unit),
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
        return createBattleResult(currentTurn, 'lose', allyUnits, enemyUnits, detailedLog)
      }

      if (!enemyAlive) {
        return createBattleResult(currentTurn, 'win', allyUnits, enemyUnits, detailedLog)
      }
    }

    return createBattleResult(currentTurn, 'retreat', allyUnits, enemyUnits, detailedLog)
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
      const target = fixedTarget ?? resolveCoverTarget(initialTarget, targetGroup)
      const attackTargets = [{ target, damageMultiplier: 1, isPiercing: false }]
      const secondColumnTarget = selectSecondColumnAttackTarget(unit, target, targetGroup, rng)
      if (secondColumnTarget) {
        attackTargets.push({
          target: secondColumnTarget,
          damageMultiplier: TWO_COLUMN_ATTACK_DAMAGE_MULTIPLIER,
          isPiercing: true,
        })
      }

      for (const { target: attackTarget, damageMultiplier, isPiercing } of attackTargets) {
        if (unit.currentHP <= 0 || attackTarget.currentHP <= 0) continue

        const hitRate = calculateHitRate(unit, attackTarget, atkIdx + 1, rng)
        const isHit = rng() * 100 < hitRate

        if (!isHit) {
          continue
        }

        const landedHitNumber = totalHitCount + 1
        totalHitCount++

        const damageTarget = isCritical
          ? { ...attackTarget.combatant, def: Math.floor(attackTarget.combatant.def * 0.5) }
          : attackTarget.combatant
        const baseDamage = this.damageCalculator.calcDamage(
          RACE_DICT,
          unit.combatant,
          damageTarget,
          BASIC_ATTACK_SKILL,
          DEFAULT_DAMAGE_OPTIONS,
          rng,
        )
        const dmgMod = getDamageModifier(landedHitNumber)
        const additionalDamage = getAdditionalDamageFromSkills(unit.skills)
        const rearDamageMultiplier = getRearDamageMultiplier(unit, sourceGroup)
        const rowDamageMultiplier = getUnitRowDamageMultiplier(unit)
        const reductionFactor = 1 - attackTarget.damageReduction / 100
        const physicalReductionFactor = 1 - attackTarget.physicalDamageReduction / 100
        const rangedAttackReductionFactor = unit.attackType === 'range'
          ? 1 - attackTarget.rangedAttackDamageReduction / 100
          : 1
        const shieldBarrierReductionFactor = 1 - attackTarget.shieldBarrierDamageReduction / 100
        const protectionFactor = getRearGuardReductionFactor(attackTarget, allyUnits)
        const defendingFactor = getDefendingDamageFactor(attackTarget)
        const physicalDamageFactor = 1 + unit.physicalDamagePercent / 100
        const criticalDamageFactor = isCritical
          ? 1 + (unit.criticalDamageBonusPercent ?? 0) / 100
          : 1
        const damage = Math.max(
          1,
          Math.floor((baseDamage * dmgMod * rearDamageMultiplier * rowDamageMultiplier + additionalDamage) * physicalDamageFactor * criticalDamageFactor * unit.physicalDamageDealtMultiplier * reductionFactor * physicalReductionFactor * rangedAttackReductionFactor * shieldBarrierReductionFactor * protectionFactor * defendingFactor * damageMultiplier),
        )

        applyDamage(attackTarget, damage)
        damagedTargets.set(getUnitKey(attackTarget), attackTarget)
        tryImmediateReviveForFallenAlly(
          attackTarget,
          attackTarget.isAlly ? allyUnits : targetGroup,
          currentTurn,
          detailedLog,
          turnActedUnitKeys,
          turnConsumedUnitKeys,
        )

        accumulateTargetDetail(targetDetails, attackTarget, damage, isPiercing)
      }
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
    depth: number = 0,
  ): void {
    if (attacker.currentHP <= 0) return
    if (depth >= MAX_COUNTER_ATTACK_DEPTH) return

    for (const defender of damagedTargets.values()) {
      if (defender.currentHP <= 0 || attacker.currentHP <= 0) continue
      const counterAttack = getPhysicalCounterAttackFromSkills(defender.skills)
      if (!counterAttack) continue

      const triggerRate = Math.max(0, Math.min(100, defender.power ?? 0))
      if (rng() * 100 >= triggerRate) continue

      const counterAvoidanceRate = Math.max(0, Math.min(1, getCounterAttackAvoidanceRateFromSkills(attacker.skills)))
      if (counterAvoidanceRate > 0 && rng() < counterAvoidanceRate) continue

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
        actorName: getLogName(defender),
        actorRow: defender.row + 1,
        action: i18n.t('battle.physicalCounterAttackAction'),
        attackCount: followUpAttackCount,
        hitCount: totalHitCount,
        actorHP: defender.currentHP,
        actorMaxHP: defender.maxHP,
        isAlly: defender.isAlly,
        isCritical,
        actionEffect: 'damage',
        targets: getSortedTargetDetails(targetDetails),
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
        depth + 1,
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
        actorName: getLogName(supporter),
        actorRow: supporter.row + 1,
        action: i18n.t('battle.criticalSupportFollowUpAction'),
        attackCount: followUpAttackCount,
        hitCount: totalHitCount,
        actorHP: supporter.currentHP,
        actorMaxHP: supporter.maxHP,
        isAlly: supporter.isAlly,
        isCritical,
        actionEffect: 'damage',
        targets: getSortedTargetDetails(targetDetails),
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
        actorName: getLogName(supporter),
        actorRow: supporter.row + 1,
        action: i18n.t('battle.magicSupportFollowUpAction'),
        attackCount: followUpAttackCount,
        hitCount: totalHitCount,
        actorHP: supporter.currentHP,
        actorMaxHP: supporter.maxHP,
        isAlly: supporter.isAlly,
        isCritical,
        actionEffect: 'damage',
        targets: getSortedTargetDetails(targetDetails),
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
    const hitCount = getSpellHitCount(spellDef, unit.level)
    const effect = spellDef.effect ?? 'damage'

    if (effect === 'heal') {
      let targets: BattleUnit[]
      if (spellDef.targeting.type === 'all_allies') {
        targets = sourceGroup.filter(target => target.currentHP > 0 && target.currentHP < target.maxHP)
      } else if (spellDef.targeting.type === 'single_ally_below_half_hp') {
        targets = selectBelowHalfHpAlly(sourceGroup)
      } else {
        targets = selectLowestHpRatioAlly(sourceGroup)
      }

      for (const target of targets) {
        const healAmount = spellDef.fullHeal
          ? target.maxHP - target.currentHP
          : Math.max(0, Math.floor(unit.magicHeal + (spellDef.healBonus ?? 0)))
        const healed = applyHealing(target, healAmount)
        if (healed <= 0) continue
        totalHitCount++
        accumulateTargetDetail(targetDetails, target, -healed)
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
        const rearDamageMultiplier = getRearDamageMultiplier(unit, sourceGroup)
        const spellDamageFactor = (1 + unit.spellDamagePercent / 100)
          * getSpellDamageMultiplierFromSkills(unit.skills, spellDef.id)
          * unit.magicFieldDamageMultiplier
        const spellTakenMultiplier = getSpellTakenMultiplierFromSkills(target.skills, spellDef.id)
        const reductionFactor = 1 - target.damageReduction / 100
        const magicReductionFactor = 1 - target.magicDamageReduction / 100
        const magicBarrierFactor = 1 - target.magicBarrierDamageReduction / 100
        const magicProtectionFactor = getRearMagicGuardReductionFactor(target, targetGroup)
        const defendingFactor = getDefendingDamageFactor(target)
        const damage = Math.max(1, Math.floor(baseDamage * rearDamageMultiplier * spellDamageFactor * spellTakenMultiplier * reductionFactor * magicReductionFactor * magicBarrierFactor * magicProtectionFactor * defendingFactor))

        applyDamage(target, damage)
        totalHitCount++

        accumulateTargetDetail(targetDetails, target, damage)
      }
      tryImmediateReviveForFallenAllies(
        targetGroup,
        currentTurn,
        detailedLog,
        turnActedUnitKeys,
        turnConsumedUnitKeys,
      )
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
        const rearDamageMultiplier = getRearDamageMultiplier(unit, sourceGroup)
        const spellDamageFactor = (1 + unit.spellDamagePercent / 100)
          * getSpellDamageMultiplierFromSkills(unit.skills, spellDef.id)
          * unit.magicFieldDamageMultiplier
        const spellTakenMultiplier = getSpellTakenMultiplierFromSkills(target.skills, spellDef.id)
        const reductionFactor = 1 - target.damageReduction / 100
        const magicReductionFactor = 1 - target.magicDamageReduction / 100
        const magicBarrierFactor = 1 - target.magicBarrierDamageReduction / 100
        const magicProtectionFactor = getRearMagicGuardReductionFactor(target, targetGroup)
        const defendingFactor = getDefendingDamageFactor(target)
        const damage = Math.max(1, Math.floor(baseDamage * rearDamageMultiplier * spellDamageFactor * spellTakenMultiplier * reductionFactor * magicReductionFactor * magicBarrierFactor * magicProtectionFactor * defendingFactor))

        applyDamage(target, damage)
        totalHitCount++

        accumulateTargetDetail(targetDetails, target, damage)
      }
      tryImmediateReviveForFallenAllies(
        targetGroup,
        currentTurn,
        detailedLog,
        turnActedUnitKeys,
        turnConsumedUnitKeys,
      )
    }

    return { targetDetails, totalHitCount }
  }

  // 既存テストが private メソッド経由でアクセスするため薄いラッパーを維持
  private getSortedTargetDetails(
    details: Map<string, AttackTargetDetail>,
  ): AttackTargetDetail[] {
    return getSortedTargetDetails(details)
  }
}
