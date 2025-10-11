import type { BattleLogEntry, Enemy, Goblin } from '../../shared/types'
import { CombatantManager } from './CombatantManager'
import { DamageCalculator } from './DamageCalculator'
import type {
  Combatant,
  DamageOptions,
  RaceDict,
  Skill,
} from './DamageCalculator'

interface BattleUnit {
  combatant: Combatant
  currentHP: number
  maxHP: number
  initialHP: number
  spd: number
  isAlly: boolean
  originalIndex: number
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
    enemies: Enemy[],
    rng: () => number,
    maxTurns: number = 20,
  ): BattleResult {
    const allyUnits = allies.map((goblin, index) =>
      this.createAllyUnit(goblin, initialAllyHP[index], index),
    )
    const enemyUnits = enemies.map((enemy, index) =>
      this.createEnemyUnit(enemy, index),
    )

    const detailedLog: BattleLogEntry[] = []
    let currentTurn = 0

    while (currentTurn < maxTurns) {
      currentTurn++
      detailedLog.push(this.createTurnStartLog(currentTurn, allyUnits, enemyUnits))

      const actingUnits = [...allyUnits, ...enemyUnits].filter(unit => unit.currentHP > 0)
      actingUnits.sort((a, b) => b.spd - a.spd)

      for (const unit of actingUnits) {
        if (unit.currentHP <= 0) continue

        const targetGroup = unit.isAlly ? enemyUnits : allyUnits
        const aliveTargets = targetGroup.filter(target => target.currentHP > 0)
        if (aliveTargets.length === 0) break

        const targetIndex = Math.floor(rng() * aliveTargets.length)
        const target = aliveTargets[targetIndex]

        const damage = this.damageCalculator.calcDamage(
          RACE_DICT,
          unit.combatant,
          target.combatant,
          BASIC_ATTACK_SKILL,
          DEFAULT_DAMAGE_OPTIONS,
          rng,
        )

        target.currentHP = Math.max(0, target.currentHP - damage)
        const targetDefeated = target.currentHP <= 0

        detailedLog.push({
          turn: currentTurn,
          actorId: unit.combatant.id,
          actorName: unit.combatant.name,
          action: BASIC_ATTACK_SKILL.name,
          targetId: target.combatant.id,
          targetName: target.combatant.name,
          damage,
          isAlly: unit.isAlly,
          targetDefeated,
          actorHP: unit.currentHP,
          targetHP: target.currentHP,
        })
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

  private createAllyUnit(goblin: Goblin, initialHP: number | undefined, originalIndex: number): BattleUnit {
    const combatant = this.combatantManager.fromGoblin(goblin)
    const hp = initialHP ?? goblin.stats.hp
    return {
      combatant,
      currentHP: hp,
      maxHP: goblin.stats.hp,
      initialHP: hp,
      spd: goblin.stats.spd,
      isAlly: true,
      originalIndex,
    }
  }

  private createEnemyUnit(enemy: Enemy, originalIndex: number): BattleUnit {
    const combatant = this.combatantManager.fromEnemy(enemy)
    return {
      combatant,
      currentHP: enemy.hp,
      maxHP: enemy.hp,
      initialHP: enemy.hp,
      spd: enemy.spd,
      isAlly: false,
      originalIndex,
    }
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
      action: 'turn_start',
      targetId: '',
      targetName: '',
      damage: 0,
      isAlly: true,
      targetDefeated: false,
      actorHP: 0,
      targetHP: 0,
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
