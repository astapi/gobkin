import type { AttackTargetDetail, BattleLogEntry } from '../../../shared/types'
import i18n from '../../../shared/i18n'
import type { BattleResult, BattleUnit } from './types'

export function getUnitKey(unit: BattleUnit): string {
  return unit.instanceId ?? unit.combatant.id
}

export function getLogName(unit: BattleUnit): string {
  const name = unit.logName ?? unit.combatant.name
  return `Lv${unit.level} ${name}`
}

function toAlphabetLabel(index: number): string {
  let n = index
  let label = ''

  do {
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26) - 1
  } while (n >= 0)

  return label
}

export function assignEnemyLogNames(enemyUnits: BattleUnit[]): void {
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
      unit.logName = `${unit.combatant.name}${toAlphabetLabel(index)}`
    })
  }
}

export function getPartyEffectIds(units: BattleUnit[]): string[] {
  const effects: string[] = []
  if (units.some(unit => unit.currentHP > 0 && unit.shieldBarrierActive)) {
    effects.push('shield_barrier')
  }
  if (units.some(unit => unit.currentHP > 0 && unit.magicBarrierActive)) {
    effects.push('magic_barrier')
  }
  if (units.some(unit => unit.currentHP > 0 && unit.magicFieldDamageMultiplier > 1)) {
    effects.push('magic_field')
  }
  return effects
}

export function createTurnStartLog(
  currentTurn: number,
  allyUnits: BattleUnit[],
  enemyUnits: BattleUnit[],
): BattleLogEntry {
  return {
    turn: currentTurn,
    actorId: 'system',
    actorName: i18n.t('battle.turnStartAction'),
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
        name: getLogName(unit),
        currentHP: unit.currentHP,
        maxHP: unit.maxHP,
        shieldBarrierActive: unit.shieldBarrierActive,
        magicBarrierActive: unit.magicBarrierActive,
        isDefending: unit.isDefending,
      })),
      enemies: enemyUnits.map(unit => ({
        id: unit.combatant.id,
        name: getLogName(unit),
        currentHP: unit.currentHP,
        maxHP: unit.maxHP,
        shieldBarrierActive: unit.shieldBarrierActive,
        magicBarrierActive: unit.magicBarrierActive,
        isDefending: unit.isDefending,
      })),
      allyPartyEffects: getPartyEffectIds(allyUnits),
      enemyPartyEffects: getPartyEffectIds(enemyUnits),
    },
  }
}

export function createBattleResult(
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

export function accumulateTargetDetail(
  details: Map<string, AttackTargetDetail>,
  target: BattleUnit,
  damage: number,
  isPiercing = false,
): void {
  const targetKey = getUnitKey(target)
  const existing = details.get(targetKey)
  if (existing) {
    existing.totalDamage += damage
    existing.hitCount++
    if (isPiercing) {
      existing.piercingHitCount = (existing.piercingHitCount ?? 0) + 1
    }
    existing.defeated = target.currentHP <= 0
    existing.targetHP = target.currentHP
  } else {
    details.set(targetKey, {
      targetId: target.combatant.id,
      targetName: getLogName(target),
      targetRow: target.row + 1,
      totalDamage: damage,
      hitCount: 1,
      piercingHitCount: isPiercing ? 1 : undefined,
      defeated: target.currentHP <= 0,
      targetHP: target.currentHP,
    })
  }
}

export function getSortedTargetDetails(
  details: Map<string, AttackTargetDetail>,
): AttackTargetDetail[] {
  return [...details.values()]
    .map((detail, index) => ({ detail, index }))
    .sort((a, b) => {
      if (a.detail.targetRow !== b.detail.targetRow) {
        return a.detail.targetRow - b.detail.targetRow
      }
      return a.index - b.index
    })
    .map(({ detail }) => detail)
}
