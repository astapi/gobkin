import { SPELL_DEFS } from '../../../shared/data/spells'
import { hasRecoverRandomUsedSpellOnDefendSkill } from '../../../shared/data/characterSkills'
import type { SpellDef } from '../../../shared/types/Spell'
import { shouldRunRate } from '../../../shared/utils/battleActionPolicy'
import {
  ATTACK_UP_PHYSICAL_DAMAGE_MULTIPLIER,
  CLERIC_BARRIER_SPELL_PRIORITY,
  CLERIC_SINGLE_HEAL_SPELL_PRIORITY,
  HEALTHY_HP_RATIO_THRESHOLD,
  LOW_HP_RATIO_THRESHOLD,
} from './constants'
import type { BattleUnit, UsableSpellCharge } from './types'

/**
 * 使用可能な呪文があれば返す（呪文優先AI）
 */
export function decideSpellAction(
  unit: BattleUnit,
  targetGroup: BattleUnit[],
  sourceGroup: BattleUnit[],
  rng: () => number,
): SpellDef | null {
  const usableCharges = getUsableSpellCharges(unit, targetGroup, sourceGroup)
  const clericCandidates = usableCharges.filter(({ charge }) => charge.category === 'cleric')
  if (clericCandidates.length > 0 && shouldRunRate(unit.battleActionPolicy.clericMagicRate, rng)) {
    const spell = decideClericSpellAction(clericCandidates, sourceGroup)
    if (spell) return spell
  }

  const mageCandidates = usableCharges.filter(({ charge }) => charge.category === 'mage')
  if (mageCandidates.length > 0 && shouldRunRate(unit.battleActionPolicy.mageMagicRate, rng)) {
    return decideMageSpellAction(mageCandidates, rng)
  }

  return null
}

export function getUsableSpellCharges(
  unit: BattleUnit,
  targetGroup: BattleUnit[],
  sourceGroup: BattleUnit[],
): UsableSpellCharge[] {
  return unit.spellCharges
    .filter(charge => charge.remaining > 0)
    .map(charge => ({ charge, def: SPELL_DEFS[charge.spellId] }))
    .filter((entry): entry is UsableSpellCharge => Boolean(entry.def) && canUseSpell(entry.def, targetGroup, sourceGroup))
}

export function decideMageSpellAction(
  candidates: UsableSpellCharge[],
  rng: () => number,
): SpellDef | null {
  if (candidates.length === 0) return null
  return candidates[Math.floor(rng() * candidates.length)].def
}

export function decideClericSpellAction(
  candidates: UsableSpellCharge[],
  sourceGroup: BattleUnit[],
): SpellDef | null {
  if (candidates.length === 0) return null

  const aliveAllies = sourceGroup.filter(unit => unit.currentHP > 0 && unit.maxHP > 0)
  if (aliveAllies.length === 0) return null

  const allAlliesHealthy = aliveAllies.every(unit => unit.currentHP / unit.maxHP > HEALTHY_HP_RATIO_THRESHOLD)
  if (allAlliesHealthy) {
    return findUsableSpellByPriority(candidates, CLERIC_BARRIER_SPELL_PRIORITY)
  }

  const lowHpAllies = aliveAllies.filter(unit => unit.currentHP / unit.maxHP <= LOW_HP_RATIO_THRESHOLD)
  if (lowHpAllies.length >= 2) {
    const partyHeal = candidates.find(({ def }) => def.id === 'party_heal')
    if (partyHeal) return partyHeal.def
  }

  const healTarget = selectLowestHpRatioAlly(sourceGroup)[0]
  if (!healTarget) return null

  return findUsableSpellByPriority(candidates, CLERIC_SINGLE_HEAL_SPELL_PRIORITY)
    ?? candidates.find(({ def }) => def.id === 'party_heal')?.def
    ?? null
}

export function findUsableSpellByPriority(
  candidates: UsableSpellCharge[],
  priority: readonly string[],
): SpellDef | null {
  for (const spellId of priority) {
    const found = candidates.find(({ def }) => def.id === spellId)
    if (found) return found.def
  }
  return null
}

export function canUseSpell(
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

export function recoverRandomUsedSpellOnDefend(unit: BattleUnit, rng: () => number): void {
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
export function getSpellHitCount(spellDef: SpellDef, level: number): number {
  const t = spellDef.targeting
  if (t.type === 'random_hits') return t.hitCount
  if (t.type === 'single_ally_lowest_hp') return 1
  if (t.type === 'single_ally_below_half_hp') return 1
  if (t.type === 'all_allies') return 0
  // multi_target
  const bonus = Math.floor(level / t.scaleLevelInterval) * t.scalePerLevel
  return t.baseTargets + bonus
}

export function selectLowestHpRatioAlly(sourceGroup: BattleUnit[]): BattleUnit[] {
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
export function selectBelowHalfHpAlly(sourceGroup: BattleUnit[]): BattleUnit[] {
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
