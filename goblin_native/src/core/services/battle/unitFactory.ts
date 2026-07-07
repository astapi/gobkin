import type { CharacterSkill, Enemy, Goblin, LearnedSpell } from '../../../shared/types'
import { SPELL_DEFS } from '../../../shared/data/spells'
import {
  getCriticalDamageBonusFromSkills,
  getLearnedSpellsFromSkills,
  getMagicDamageReductionFromSkills,
  getPhysicalDamagePercentFromSkills,
  getPhysicalDamageReductionFromSkills,
  getPureGoblinPartyStatBonusPercentFromSkills,
  getRangedAttackDamageReductionFromSkills,
  getSpellDamagePercentFromSkills,
  getUniqueSkillsById,
} from '../../../shared/data/characterSkills'
import { getGoblinBaseAttributesAtLevel } from '../../../shared/utils/goblinHp'
import { getEffectiveStats } from '../../../shared/utils/goblinStats'
import { normalizeBattleActionPolicy } from '../../../shared/utils/battleActionPolicy'
import { getRaceResistanceTotals, getRaceSkills } from '../../../shared/data/races'
import { CombatantManager } from '../CombatantManager'
import { GoblinStatCalculator } from '../GoblinStatCalculator'
import { CLERIC_MAGIC_SPELL_IDS } from './constants'
import type { BattleUnit, SpellCategory, SpellCharge } from './types'

export function toCombatBuffsFromSkills(skills: CharacterSkill[]) {
  return getUniqueSkillsById(skills)
    .filter((skill) => skill.raceBonus || skill.raceTakenBonus)
    .map((skill) => ({
      id: skill.id,
      name: skill.id,
      raceBonus: skill.raceBonus,
      raceTakenBonus: skill.raceTakenBonus,
    }))
}

function mergeLearnedSpells(
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

function getSpellCategory(spellId: string): SpellCategory {
  if (CLERIC_MAGIC_SPELL_IDS.has(spellId)) {
    return 'cleric'
  }
  return 'mage'
}

function initSpellCharges(spells: LearnedSpell[] | undefined): SpellCharge[] {
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
        category: getSpellCategory(ls.spellId),
      }
    })
    .filter((sc): sc is SpellCharge => sc !== null)
}

export function createAllyUnit(
  combatantManager: CombatantManager,
  goblin: Goblin,
  initialHP: number | undefined,
  originalIndex: number,
  pureGoblinCount: number,
): BattleUnit {
  const skills = getUniqueSkillsById(goblin.skills)
  const combatant = combatantManager.fromGoblin(goblin)
  combatant.buffs = toCombatBuffsFromSkills(skills)
  const actionOrderAgility = (goblin as Goblin & { agility?: number }).agility
  const baseAttributes = getGoblinBaseAttributesAtLevel(goblin, goblin.level)
  // 実効ステータスを使用
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
  const damageReduction = GoblinStatCalculator.getDamageReduction(goblin)
  const physicalDamageReduction = getPhysicalDamageReductionFromSkills(goblin.skills)
  const rangedAttackDamageReduction = getRangedAttackDamageReductionFromSkills(goblin.skills)
  const magicDamageReduction = getMagicDamageReductionFromSkills(goblin.skills)
  const learnedSpells = mergeLearnedSpells(goblin.spells, goblin.skills, goblin.level)
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
    rangedAttackDamageReduction,
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
    criticalDamageBonusPercent: getCriticalDamageBonusFromSkills(goblin.skills),
    spellDamagePercent: getSpellDamagePercentFromSkills(goblin.skills),
    magicFieldDamageMultiplier: 1,
    shieldBarrierActive: false,
    magicBarrierActive: false,
    row: originalIndex,  // 味方は1列1体（配列順 = 列番号）
    rowSlot: 0,
    level: goblin.level,
    spellCharges: initSpellCharges(learnedSpells),
    skills,
    battleActionPolicy: normalizeBattleActionPolicy(goblin.battleActionPolicy),
    isDefending: false,
    attackType: 'melee',
  }
}

export function createEnemyUnit(
  combatantManager: CombatantManager,
  enemy: Enemy,
  originalIndex: number,
  row: number,
  rowSlot: number,
): BattleUnit {
  const skills = getUniqueSkillsById([...(enemy.skills ?? []), ...getRaceSkills(enemy.raceTags)])
  const combatant = combatantManager.fromEnemy(enemy)
  combatant.buffs = toCombatBuffsFromSkills(skills)
  const learnedSpells = mergeLearnedSpells(enemy.spells, skills, enemy.level)
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
    rangedAttackDamageReduction: getRangedAttackDamageReductionFromSkills(skills),
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
    criticalDamageBonusPercent: getCriticalDamageBonusFromSkills(skills),
    spellDamagePercent: getSpellDamagePercentFromSkills(skills),
    magicFieldDamageMultiplier: 1,
    shieldBarrierActive: false,
    magicBarrierActive: false,
    row,
    rowSlot,
    level: enemy.level,
    spellCharges: initSpellCharges(learnedSpells),
    skills,
    battleActionPolicy: normalizeBattleActionPolicy(enemy.battleActionPolicy),
    isDefending: false,
    attackType: enemy.attackType,
  }
}
