import {
  getRearAllyDamageMultiplierFromSkills,
  getRearMagicProtectionMultiplierFromSkills,
  getRearProtectionMultiplierFromSkills,
  getRowDamageMultiplierForAttackType,
  getRowDamageMultiplierFromSkills,
  hasCoverLowHpAllySkill,
  hasTwoColumnAttackSkill,
} from '../../../shared/data/characterSkills'
import { getUnitKey } from './logHelpers'
import { selectTarget } from './targeting'
import type { BattleUnit } from './types'

export function getUnitRowDamageMultiplier(unit: BattleUnit): number {
  if (unit.isAlly) {
    return getRowDamageMultiplierFromSkills(unit.skills, unit.row)
  }
  return getRowDamageMultiplierForAttackType(unit.attackType, unit.row)
}

export function selectSecondColumnAttackTarget(
  attacker: BattleUnit,
  primaryTarget: BattleUnit,
  targetGroup: BattleUnit[],
  rng: () => number,
): BattleUnit | undefined {
  if (!hasTwoColumnAttackSkill(attacker.skills)) return undefined
  if (primaryTarget.row >= 5) return undefined

  const backRowTargets = targetGroup.filter(
    target => target.currentHP > 0 && target.row === primaryTarget.row + 1,
  )
  if (backRowTargets.length === 0) return undefined

  return selectTarget(backRowTargets, rng)
}

export function getRearGuardReductionFactor(target: BattleUnit, allyUnits: BattleUnit[]): number {
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

export function getRearMagicGuardReductionFactor(target: BattleUnit, allyUnits: BattleUnit[]): number {
  if (!target.isAlly || target.currentHP <= 0) return 1

  const frontmostRearGuardUnit = allyUnits
    .filter((ally) => (
      ally.currentHP > 0 &&
      ally.row < target.row &&
      getRearMagicProtectionMultiplierFromSkills(ally.skills) !== 1
    ))
    .sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row
      return a.rowSlot - b.rowSlot
    })[0]

  if (!frontmostRearGuardUnit) {
    return 1
  }

  return getRearMagicProtectionMultiplierFromSkills(frontmostRearGuardUnit.skills)
}

export function getRearDamageMultiplier(unit: BattleUnit, groupUnits: BattleUnit[]): number {
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

export function resolveCoverTarget(target: BattleUnit, defendingGroup: BattleUnit[]): BattleUnit {
  if (target.currentHP <= 0 || target.currentHP > Math.floor(target.maxHP / 2)) {
    return target
  }

  const candidates = defendingGroup
    .filter((unit) => (
      unit.currentHP > 0 &&
      getUnitKey(unit) !== getUnitKey(target) &&
      unit.row < target.row &&
      hasCoverLowHpAllySkill(unit.skills)
    ))
    .sort((a, b) => b.row - a.row)

  return candidates[0] ?? target
}

export function getDefendingDamageFactor(target: BattleUnit): number {
  return target.isDefending ? 0.5 : 1
}
