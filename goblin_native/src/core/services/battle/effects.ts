import type { AttackTargetDetail, BattleLogEntry } from '../../../shared/types'
import { SPELL_DEFS } from '../../../shared/data/spells'
import {
  hasImmediateReviveSkill,
  hasSurviveLethalDamageAtHp1Skill,
} from '../../../shared/data/characterSkills'
import type { SpellDef } from '../../../shared/types/Spell'
import { PARTY_HEAL_SPELL_ID } from './constants'
import {
  accumulateTargetDetail,
  getLogName,
  getSortedTargetDetails,
  getUnitKey,
} from './logHelpers'
import type { BattleUnit, SpellCharge } from './types'

export function applyDamage(target: BattleUnit, damage: number): void {
  const nextHP = target.currentHP - damage

  if (nextHP <= 0 && target.currentHP > 1 && hasSurviveLethalDamageAtHp1Skill(target.skills)) {
    target.currentHP = 1
    return
  }

  target.currentHP = Math.max(0, nextHP)
}

export function applyHealing(target: BattleUnit, amount: number): number {
  const before = target.currentHP
  target.currentHP = Math.min(target.maxHP, target.currentHP + amount)
  return target.currentHP - before
}

export function tryImmediateReviveForFallenAlly(
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

  tryImmediateReviveForFallenAllies(
    alliedUnits,
    currentTurn,
    detailedLog,
    turnActedUnitKeys,
    turnConsumedUnitKeys,
  )
}

export function tryImmediateReviveForFallenAllies(
  alliedUnits: BattleUnit[],
  currentTurn: number,
  detailedLog: BattleLogEntry[],
  turnActedUnitKeys: Set<string>,
  turnConsumedUnitKeys: Set<string>,
): void {
  if (!alliedUnits.some(unit => unit.currentHP <= 0)) {
    return
  }

  const reviver = [...alliedUnits]
    .filter((unit) => {
      if (unit.currentHP <= 0) return false
      if (turnActedUnitKeys.has(getUnitKey(unit))) return false
      return hasImmediateReviveSkill(unit.skills) && getImmediateReviveSpell(unit, alliedUnits) !== null
    })
    .sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row
      if (a.rowSlot !== b.rowSlot) return a.rowSlot - b.rowSlot
      return a.originalIndex - b.originalIndex
    })[0]

  if (!reviver) {
    return
  }

  const revival = getImmediateReviveSpell(reviver, alliedUnits)
  if (!revival) {
    return
  }

  const targetDetails: Map<string, AttackTargetDetail> = new Map()
  const targets = getImmediateReviveTargets(reviver, alliedUnits, revival.spellDef)
  for (const healTarget of targets) {
    const healAmount = getImmediateReviveHealAmount(reviver, healTarget, revival.spellDef)
    const healed = applyHealing(healTarget, healAmount)
    if (healed <= 0) continue
    accumulateTargetDetail(targetDetails, healTarget, -healed)
  }

  if (targetDetails.size === 0) {
    return
  }

  revival.charge.remaining--
  const reviverKey = getUnitKey(reviver)
  turnActedUnitKeys.add(reviverKey)
  turnConsumedUnitKeys.add(reviverKey)

  detailedLog.push({
    turn: currentTurn,
    actorId: reviver.combatant.id,
    actorName: getLogName(reviver),
    actorRow: reviver.row + 1,
    action: revival.spellDef.name,
    actorHP: reviver.currentHP,
    actorMaxHP: reviver.maxHP,
    isAlly: reviver.isAlly,
    actionEffect: 'heal',
    attackCount: targetDetails.size,
    hitCount: targetDetails.size,
    targets: getSortedTargetDetails(targetDetails),
  })
}

export function getImmediateReviveSpell(
  unit: BattleUnit,
  alliedUnits: BattleUnit[],
): { charge: SpellCharge; spellDef: SpellDef } | null {
  const fallenAllies = alliedUnits.filter(ally => ally.currentHP <= 0)
  if (fallenAllies.length === 0) return null

  const healCharges = unit.spellCharges
    .filter(charge => charge.remaining > 0 && charge.category === 'cleric')
    .map(charge => ({ charge, spellDef: SPELL_DEFS[charge.spellId] }))
    .filter((entry): entry is { charge: SpellCharge; spellDef: SpellDef } => (
      Boolean(entry.spellDef) && (entry.spellDef.effect ?? 'damage') === 'heal'
    ))

  const partyHeal = healCharges.find(({ spellDef }) => spellDef.id === PARTY_HEAL_SPELL_ID)
  if (partyHeal && fallenAllies.length >= 2) {
    return partyHeal
  }

  const reviveTarget = selectImmediateReviveTarget(alliedUnits)
  if (!reviveTarget) return null

  let best: { charge: SpellCharge; spellDef: SpellDef; healAmount: number } | null = null

  for (const { charge, spellDef } of healCharges) {
    if (spellDef.id === PARTY_HEAL_SPELL_ID) continue
    const healAmount = getImmediateReviveHealAmount(unit, reviveTarget, spellDef)
    if (healAmount <= 0) continue
    if (!best || healAmount > best.healAmount) {
      best = { charge, spellDef, healAmount }
    }
  }

  if (best) {
    return { charge: best.charge, spellDef: best.spellDef }
  }

  return partyHeal ?? null
}

export function getImmediateReviveTargets(
  unit: BattleUnit,
  alliedUnits: BattleUnit[],
  spellDef: SpellDef,
): BattleUnit[] {
  if (spellDef.id === PARTY_HEAL_SPELL_ID) {
    return alliedUnits.filter(ally => ally.currentHP < ally.maxHP)
  }

  const reviveTarget = selectImmediateReviveTarget(alliedUnits)
  if (!reviveTarget || getUnitKey(reviveTarget) === getUnitKey(unit)) {
    return []
  }
  return [reviveTarget]
}

export function selectImmediateReviveTarget(alliedUnits: BattleUnit[]): BattleUnit | null {
  return alliedUnits
    .filter(unit => unit.currentHP <= 0)
    .sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row
      if (a.rowSlot !== b.rowSlot) return a.rowSlot - b.rowSlot
      return a.originalIndex - b.originalIndex
    })[0] ?? null
}

export function getImmediateReviveHealAmount(unit: BattleUnit, target: BattleUnit, spellDef: SpellDef): number {
  if (spellDef.fullHeal) {
    return target.maxHP
  }

  return Math.max(0, Math.floor(unit.magicHeal + (spellDef.healBonus ?? 0)))
}
