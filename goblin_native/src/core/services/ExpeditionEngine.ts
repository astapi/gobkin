import type {
  ExpeditionRequest,
  ExpeditionReplay,
  TimelineEvent,
  TreasureDrop,
  EnemySnap,
  CombatReplay,
  RewardSummary,
  Goblin,
  Enemy,
  EnemyPattern,
  PartyState,
  ExpeditionEndReason,
  AreaConfig,
  PartyRewardMultipliers,
  ExpeditionBoost,
  DungeonTier,
} from '../../shared/types'
import { getAreaConfig } from '../../shared/data/expeditionArea'
import { getEnemyDatabase } from '../../shared/data/enemy'
import { BattleSystem } from './BattleSystem'
import { GoblinStatCalculator } from './GoblinStatCalculator'
import { rollTreasureDrops } from './TreasureDropRoller'
import { normalizePartyRewardMultipliers, getDungeonTierAreaLevel } from '../../shared/types'
import {
  getGoldBonusPercentFromSkills,
  getPartyRareMultiplierFromSkills,
  getPartyTitleMultiplierFromSkills,
} from '../../shared/data/characterSkills'
import { getGoblinBaseAttributesAtLevel } from '../../shared/utils/goblinHp'
import { getEffectiveStats } from '../../shared/utils/goblinStats'
import { calculateEnemyExp } from '../../shared/utils/enemyExp'
import { applyDungeonTierScalingToEnemy } from '../../shared/utils/enemyTierScaling'

export const GOLDEN_ACORN_CLEAR_ENCOUNTER_ID = 'golden_acorn_ratatoskr'
const GOLDEN_ACORN_CLEAR_ENCOUNTER_EXP = 998
export const GOLDEN_ACORN_CLEAR_FACTOR_DROPS = [{
  factorId: 'ratatoskr',
  probability: 0.015,
  minDungeonTier: 3,
} satisfies NonNullable<Enemy['factorDrops']>[number]]

const GOLDEN_ACORN_CLEAR_ENCOUNTER: Enemy[][] = [[{
  id: GOLDEN_ACORN_CLEAR_ENCOUNTER_ID,
  name: 'ラタトスク',
  attackType: 'melee',
  raceTags: ['beast'],
  level: 10,
  hp: 10,
  baseAttributes: {
    power: 10,
    wisdom: 10,
    spirit: 10,
    vitality: 10,
    agility: 10,
    luck: 10,
  },
  atk: 10,
  def: 10,
  magicDef: 10,
  attackCount: 1,
  accuracy: 200,
  evasion: 1000,
  exp: GOLDEN_ACORN_CLEAR_ENCOUNTER_EXP,
  gold: 998,
  factorDrops: GOLDEN_ACORN_CLEAR_FACTOR_DROPS,
  skills: [
    {
      id: 'ratatoskr_magic_reduction_99',
      magicDamageReductionPercent: 99,
    },
  ],
}]]

export class ExpeditionEngine {
  private rng: () => number
  private seed: number
  private readonly battleSystem: BattleSystem

  constructor(seed?: number, battleSystem?: BattleSystem) {
    this.seed = seed ?? this.generateSeed()
    this.rng = this.createSeededRandom(this.seed)
    this.battleSystem = battleSystem ?? new BattleSystem()
  }

  private generateSeed(): number {
    // 実際のシード生成（簡易版）
    return Math.floor(Math.random() * 0x7FFFFFFF)
  }

  private createSeededRandom(seed: number): () => number {
    let state = seed
    return () => {
      state = (state * 1664525 + 1013904223) % 0x100000000
      return (state >>> 0) / 0x100000000
    }
  }

  public async generateExpedition(
    request: ExpeditionRequest,
    party: Goblin[],
    rewardMultipliers?: PartyRewardMultipliers,
    expeditionBoost?: ExpeditionBoost
  ): Promise<ExpeditionReplay> {
    const normalizedRewardMultipliers = normalizePartyRewardMultipliers(rewardMultipliers)
    const partySkillRewardMultipliers = this.getPartySkillRewardMultipliers(party)
    const effectiveRewardMultipliers = normalizePartyRewardMultipliers({
      ...normalizedRewardMultipliers,
      rare: normalizedRewardMultipliers.rare * partySkillRewardMultipliers.rare,
      title: normalizedRewardMultipliers.title * partySkillRewardMultipliers.title,
    })
    const rareDropMultiplierBoost = expeditionBoost?.rareDropMultiplier && expeditionBoost.rareDropMultiplier > 0
      ? expeditionBoost.rareDropMultiplier
      : 1
    const goldMultiplierBoost = expeditionBoost?.goldMultiplier && expeditionBoost.goldMultiplier > 0
      ? expeditionBoost.goldMultiplier
      : 1
    const titleMultiplierBoost = expeditionBoost?.titleMultiplier && expeditionBoost.titleMultiplier > 0
      ? expeditionBoost.titleMultiplier
      : 1
    const expMultiplierBoost = expeditionBoost?.expMultiplier && expeditionBoost.expMultiplier > 0
      ? expeditionBoost.expMultiplier
      : 1
    const tier = request.tier ?? 0
    const areaId = request.areaId

    // エリアデータを取得
    const area = getAreaConfig(areaId)
    if (!area) {
      throw new Error(`Area not found: ${areaId}`)
    }
    const effectiveAreaLevel = getDungeonTierAreaLevel(area.areaLevel, tier)
    const targetFloor = this.normalizeTargetFloor(request.targetFloor, area.floors)

    // 敵データを取得
    const enemyDatabase = getEnemyDatabase(areaId)
    if (!enemyDatabase) {
      throw new Error(`Enemy data not found: ${areaId}`)
    }

    // 表示上の規定時間をそのまま使い、終端にイベントを揃える
    // DEBUG環境変数がtrueの場合は1秒に短縮（明示指定がある場合は尊重）
    const isDebug = typeof __DEV__ !== 'undefined' ? __DEV__ : false
    const requestedDuration = request.durationSec ?? area.baseDurationSec
    const adjustedDuration = isDebug && request.durationSec == null ? 1 : Math.ceil(requestedDuration)
    const simulationDuration = Math.ceil(request.simulationDurationSec ?? requestedDuration)
    const replayTimeScale = simulationDuration > 0 ? adjustedDuration / simulationDuration : 1

    const events: TimelineEvent[] = []
    let currentFloor = 1
    let currentTime = 0
    const partyState = this.initializePartyState(party)
    // PTメンバーの基本運値の平均（小数切り捨て）。ドロップ判定の運乱数算出に使用する。
    const partyLuckAverage = partyState.length > 0
      ? Math.floor(partyState.reduce((sum, member) => sum + member.luck, 0) / partyState.length)
      : 0
    let shouldReturn = false
    let returnReason: ExpeditionEndReason | null = null
    const droppedTemplateIds = new Set<string>()  // 遠征中に既にドロップしたアイテム
    const partyGoldBonusPercent = partyState.reduce(
      (max, member) => Math.max(max, getGoldBonusPercentFromSkills(member.skills)),
      0,
    )
    const totalGoldMultiplier =
      effectiveRewardMultipliers.gold *
      (1 + partyGoldBonusPercent / 100) *
      goldMultiplierBoost
    const averageBattleGold = this.calculateAverageBattleGold(enemyDatabase.patterns, enemyDatabase.enemies, tier)

    // 移動開始イベント
    events.push({
      type: "move_start",
      at: currentTime,
      floor: currentFloor
    })

    let loopCount = 0
    const MAX_LOOPS = 1000 // 安全装置

    while (currentFloor <= targetFloor && !shouldReturn) {
      loopCount++
      if (loopCount > MAX_LOOPS) {
        console.error('ExpeditionEngine: Loop safety limit reached!')
        break
      }
      const floorEvents = this.generateFloorEvents(area, currentFloor, simulationDuration, targetFloor)

      for (const floorEvent of floorEvents) {
        if (shouldReturn) break

        currentTime = Math.min(adjustedDuration, floorEvent.at * replayTimeScale)
        if (floorEvent.isFloorEnd) {
          events.push({
            type: "floor_end",
            at: currentTime,
            floor: currentFloor,
          })
        }
        const eventType = floorEvent.isFloorEnd ? "battle" : this.selectEventType(area.encounter.eventWeights)

        switch (eventType) {
          case "battle": {
            const battleOutcome = this.processBattleEvent({
              partyState,
              enemyDatabase,
              area,
              currentFloor,
              currentTime,
              tier,
              isFloorEnd: floorEvent.isFloorEnd,
              droppedTemplateIds,
              partyLuckAverage,
              effectiveRewardMultipliers,
              rareDropMultiplierBoost,
              titleMultiplierBoost,
              expMultiplierBoost,
              returnPolicy: request.returnPolicy,
              events,
            })
            if (battleOutcome.shouldReturn) {
              shouldReturn = true
              returnReason = battleOutcome.returnReason
            }
            break
          }

          case "goldTreasure": {
            events.push({
              type: "gold_treasure",
              at: currentTime,
              floor: currentFloor,
              gold: Math.floor(averageBattleGold * 1.1 * totalGoldMultiplier),
            })
            break
          }

          case "exploring": {
            events.push({
              type: "exploring",
              at: currentTime,
              floor: currentFloor
            })
            break
          }

          default: {
            // 未知のイベントタイプはbattleとして処理
            console.warn(`Unknown event type: ${eventType}, treating as battle`)
            const battleOutcome = this.processBattleEvent({
              partyState,
              enemyDatabase,
              area,
              currentFloor,
              currentTime,
              tier,
              isFloorEnd: floorEvent.isFloorEnd,
              droppedTemplateIds,
              partyLuckAverage,
              effectiveRewardMultipliers,
              rareDropMultiplierBoost,
              titleMultiplierBoost,
              expMultiplierBoost,
              returnPolicy: request.returnPolicy,
              events,
            })
            if (battleOutcome.shouldReturn) {
              shouldReturn = true
              returnReason = battleOutcome.returnReason
            }
            break
          }
        }
      }

      if (currentFloor >= targetFloor && targetFloor < area.floors && !shouldReturn) {
        shouldReturn = true
        returnReason = 'policy_return'
      }

      // 階層移動
      if (currentFloor < area.floors && !shouldReturn) {
        currentFloor++
        events.push({
          type: "floor_up",
          at: currentTime,
          from: currentFloor - 1,
          to: currentFloor
        })
      } else if (currentFloor == area.floors && !shouldReturn) {
        // 最終階層に到達したらループを抜ける
        currentFloor++
        break
      }
    }

    // ボス戦（最上階到達時）
    if (targetFloor >= area.floors && currentFloor > area.floors && !shouldReturn) {
      const bossPatterns = enemyDatabase.patterns.filter(p => p.isBoss && p.floors.includes(area.floors))

      if (bossPatterns.length > 0) {
        const bossPattern = this.selectEnemyPattern(enemyDatabase.patterns, area.floors, tier, true)
        const bossEnemies = this.applyTierScaling(this.getEnemiesFromPattern(bossPattern, enemyDatabase.enemies), tier)

        const bossCombat = this.resolveCombat(partyState, bossEnemies, area, true)
        const bossXp = bossCombat.outcome === 'win' ? this.calculateEnemyXp(bossEnemies, expMultiplierBoost) : 0

        // 規定時間の終端でボス戦を行う（最後の秒で戦闘開始）
        const bossTime = adjustedDuration
        currentTime = bossTime

        events.push({
          type: "boss",
          at: currentTime,
          floor: area.floors,
          enemy: this.createEnemySnap(bossEnemies, true),
          combat: bossCombat,
          xp: bossXp
        })

        this.applyBattleResults(partyState, bossCombat)

        // ボス戦勝利時の宝箱ドロップ判定
        if (bossCombat.outcome === 'win') {
          const bossTreasure = rollTreasureDrops(
            bossEnemies.flat(),
            droppedTemplateIds,
            partyLuckAverage,
            effectiveRewardMultipliers,
            rareDropMultiplierBoost,
            titleMultiplierBoost,
            tier,
            this.rng
          )
          if (bossTreasure.length > 0) {
            events.push({
              type: "treasure",
              at: currentTime,
              floor: area.floors,
              items: bossTreasure
            })
          }
        }

        returnReason = bossCombat.outcome === "win" ? "completed" : "defeated"
      } else {
        // ボスなしエリア: 最終階層到達で遠征完了
        returnReason = "completed"
      }

      if (returnReason === 'completed' && this.shouldTriggerGoldenAcornClearEncounter(expeditionBoost)) {
        const encounterCombat = this.resolveCombat(partyState, GOLDEN_ACORN_CLEAR_ENCOUNTER, area)
        const encounterXp = encounterCombat.outcome === 'win'
          ? this.calculateEnemyXp(GOLDEN_ACORN_CLEAR_ENCOUNTER, expMultiplierBoost)
          : 0

        events.push({
          type: "battle",
          at: adjustedDuration,
          floor: area.floors,
          enemy: this.createEnemySnap(GOLDEN_ACORN_CLEAR_ENCOUNTER),
          combat: encounterCombat,
          xp: encounterXp
        })

        this.applyBattleResults(partyState, encounterCombat)
        // 金のドングリ遭遇戦で全滅（敗北）した場合のみ敗北扱いにする。
        // 退却（時間切れ）は踏破済み扱いを維持する。
        returnReason = encounterCombat.outcome === 'lose' ? 'defeated' : 'completed'
      }
      shouldReturn = true
    }

    // 帰還イベント
    if (shouldReturn && returnReason) {
      events.push({
        type: "return",
        at: adjustedDuration,
        reason: returnReason
      })
    }

    const summary = this.calculateRewardSummary(events, partyState, effectiveRewardMultipliers, partyGoldBonusPercent, goldMultiplierBoost)

    return {
      meta: {
        expeditionId: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        areaId: areaId,
        areaName: area.name,
        areaLevel: area.areaLevel,
        effectiveAreaLevel,
        floors: area.floors,
        baseDurationSec: simulationDuration,
        party: party.map(g => g.id.toString()),
        partySnapshot: party.map(g => ({ ...g })),
        partyRewardMultipliers: effectiveRewardMultipliers,
        expeditionBoost,
        returnPolicy: request.returnPolicy,
        tier: tier || undefined,
        seed: this.seed
      },
      durationSec: adjustedDuration,
      events,
      summary
    }
  }

  private initializePartyState(party: Goblin[]): PartyState[] {
    return party.map(goblin => {
      // 基礎ステータスを保存（因子適用はGoblinStatCalculatorで行う）
      // HP0の負傷者は治療されるまで0のまま、それ以外は出発時に最大HPで開始する
      const effectiveStats = getEffectiveStats(goblin)
      const currentHP = goblin.currentHp === 0 ? 0 : effectiveStats.hp
      const baseAttributes = getGoblinBaseAttributesAtLevel(goblin, goblin.level)
      return {
        id: goblin.id.toString(),
        name: goblin.name,
        race: goblin.race,
        skills: goblin.skills,
        currentHP,
        maxHP: effectiveStats.hp,
        // 基礎ステータスを保存（ゴブリン再構築時に使用）
        baseHP: goblin.stats.hp,
        atk: goblin.stats.atk,
        def: goblin.stats.def,
        agility: baseAttributes.agility,
        luck: baseAttributes.luck,
        attackCount: goblin.stats.attackCount,
        accuracy: goblin.stats.accuracy,
        evasion: goblin.stats.evasion,
        magicAtk: goblin.stats.magicAtk,
        magicDef: goblin.stats.magicDef,
        magicHeal: goblin.stats.magicHeal,
        effectiveStats,
        isKO: currentHP <= 0,
        isDead: currentHP <= 0,
        factors: goblin.factors || [],
        variantFactorId: goblin.variantFactorId,
        spells: goblin.spells,
        battleActionPolicy: goblin.battleActionPolicy,
        level: goblin.level,
        avatar: goblin.avatar,
      }
    })
  }

  private getPartySkillRewardMultipliers(party: Goblin[]): Pick<PartyRewardMultipliers, 'rare' | 'title'> {
    return party.reduce(
      (multipliers, goblin) => ({
        rare: multipliers.rare * getPartyRareMultiplierFromSkills(goblin.skills),
        title: multipliers.title * getPartyTitleMultiplierFromSkills(goblin.skills),
      }),
      { rare: 1, title: 1 },
    )
  }

  private generateFloorEvents(
    area: AreaConfig,
    floor: number,
    totalDuration: number,
    explorationFloors: number
  ): Array<{ at: number; isFloorEnd: boolean }> {
    const floorDuration = totalDuration / explorationFloors
    const floorStart = (floor - 1) * floorDuration
    const floorEnd = floorStart + floorDuration
    const baseDurationForFloors = area.baseDurationSec * (explorationFloors / area.floors)
    const durationScale = baseDurationForFloors > 0
      ? Math.max(1, totalDuration / baseDurationForFloors)
      : 1
    const eventIntervalSec = Math.max(1, (area.encounter.eventIntervalSec ?? floorDuration) * durationScale)
    const events: Array<{ at: number; isFloorEnd: boolean }> = []

    for (let at = floorStart + eventIntervalSec; at < floorEnd; at += eventIntervalSec) {
      events.push({
        at,
        isFloorEnd: false,
      })
    }
    events.push({
      at: floorEnd,
      isFloorEnd: true,
    })

    return events.sort((a, b) => a.at - b.at)
  }

  private selectEventType(weights: AreaConfig["encounter"]["eventWeights"]): string {
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0)
    const roll = this.rng() * total

    let current = 0
    for (const [type, weight] of Object.entries(weights)) {
      current += weight
      if (roll <= current) {
        return type
      }
    }
    return "battle"
  }

  private selectEnemyPattern(
    patterns: EnemyPattern[],
    floor: number,
    tier: DungeonTier,
    isBoss: boolean,
    preferFloorBoss = false
  ): EnemyPattern {
    // ボス戦の場合はボスパターンを選択
    if (isBoss) {
      const bossPatterns = patterns.filter(p =>
        p.isBoss &&
        p.floors.includes(floor) &&
        this.isPatternAvailableForTier(p, tier)
      )
      if (bossPatterns.length === 0) {
        throw new Error(`No boss pattern found for floor ${floor} tier ${tier}`)
      }
      return bossPatterns[Math.floor(this.rng() * bossPatterns.length)]
    }

    if (preferFloorBoss) {
      const floorBossPatterns = patterns.filter(p =>
        p.isFloorBoss &&
        !p.isBoss &&
        p.floors.includes(floor) &&
        this.isPatternAvailableForTier(p, tier)
      )
      if (floorBossPatterns.length > 0) {
        return floorBossPatterns[Math.floor(this.rng() * floorBossPatterns.length)]
      }
    }

    // 通常戦闘の場合
    const availablePatterns = patterns.filter(p =>
      !p.isBoss &&
      !p.isFloorBoss &&
      p.floors.includes(floor) &&
      this.isPatternAvailableForTier(p, tier)
    )
    if (availablePatterns.length === 0) {
      const fallbackPatterns = patterns.filter(p =>
        !p.isBoss &&
        p.floors.includes(floor) &&
        this.isPatternAvailableForTier(p, tier)
      )
      if (fallbackPatterns.length > 0) {
        return fallbackPatterns[Math.floor(this.rng() * fallbackPatterns.length)]
      }
      throw new Error(`No enemy pattern found for floor ${floor} tier ${tier}`)
    }
    return availablePatterns[Math.floor(this.rng() * availablePatterns.length)]
  }

  private applyTierScaling(
    enemies2D: Enemy[][],
    tier: DungeonTier
  ): Enemy[][] {
    return enemies2D.map(row =>
      row.map(enemy => applyDungeonTierScalingToEnemy(enemy, tier))
    )
  }

  private isPatternAvailableForTier(pattern: EnemyPattern, tier: DungeonTier): boolean {
    return (
      (pattern.minTier === undefined || tier >= pattern.minTier) &&
      (pattern.maxTier === undefined || tier <= pattern.maxTier)
    )
  }

  private getEnemiesFromPattern(pattern: EnemyPattern, enemyList: Enemy[]): Enemy[][] {
    return pattern.enemies.map(row =>
      row.map(enemyId => {
        const enemy = enemyList.find(e => e.id === enemyId)
        if (!enemy) {
          throw new Error(`Enemy not found: ${enemyId}`)
        }
        return enemy
      })
    )
  }

  private calculateAverageBattleGold(
    patterns: EnemyPattern[],
    enemyList: Enemy[],
    tier: DungeonTier
  ): number {
    const battlePatterns = patterns.filter(pattern =>
      !pattern.isBoss && this.isPatternAvailableForTier(pattern, tier)
    )
    if (battlePatterns.length === 0) return 0

    const totalGold = battlePatterns.reduce((sum, pattern) => {
      const enemies = this.applyTierScaling(this.getEnemiesFromPattern(pattern, enemyList), tier)
      return sum + enemies.flat().reduce((enemySum, enemy) => enemySum + enemy.gold, 0)
    }, 0)

    return totalGold / battlePatterns.length
  }

  private calculateEnemyXp(enemies2D: Enemy[][], expMultiplier: number = 1): number {
    const baseXp = enemies2D.flat().reduce(
      (sum, enemy) => sum + this.calculateSingleEnemyXp(enemy),
      0
    )
    return Math.floor(baseXp * Math.max(0, expMultiplier))
  }

  private calculateSingleEnemyXp(enemy: Enemy): number {
    if (enemy.id === GOLDEN_ACORN_CLEAR_ENCOUNTER_ID) {
      return GOLDEN_ACORN_CLEAR_ENCOUNTER_EXP
    }
    return calculateEnemyExp(enemy.level, enemy.raceTags, enemy.isBoss === true)
  }

  private shouldTriggerGoldenAcornClearEncounter(expeditionBoost?: ExpeditionBoost): boolean {
    return expeditionBoost?.goldenAcornUsed === true
  }

  private createEnemySnap(enemies2D: Enemy[][], isBoss = false): EnemySnap {
    const enemies = enemies2D.flat()
    let representative = enemies[0]
    if (isBoss) {
      const boss = enemies.find(e => e.isBoss === true)
      if (boss) {
        representative = boss
      }
    }

    // 全ての敵のゴールドを合計
    const totalGold = enemies.reduce((sum, enemy) => sum + enemy.gold, 0)
    return {
      id: representative.id,
      name: representative.name,
      lvl: representative.level,
      count: enemies.length,
      gold: totalGold
    }
  }

  private resolveCombat(partyState: PartyState[], enemies: Enemy[][], _area: AreaConfig, _isBoss = false): CombatReplay {
    // partyStateから全ゴブリンを再構築（死亡メンバーも含む）
    // 基礎ステータスを使用（GoblinStatCalculatorが因子を適用する）
    const allGoblins: Goblin[] = partyState.map(member => ({
      id: parseInt(member.id),
      name: member.name,
      race: member.race,
      level: member.level,
      experience: 0,
      avatar: member.avatar,
      stats: {
        hp: member.baseHP,  // 基礎HPを使用（GoblinStatCalculatorが因子を適用）
        atk: member.atk,
        magicAtk: member.magicAtk,
        def: member.def,
        magicDef: member.magicDef,
        attackCount: member.attackCount,
        accuracy: member.accuracy,
        evasion: member.evasion,
        magicHeal: member.magicHeal,
        criticalRate: 0,
      },
      effectiveStats: member.effectiveStats,
      agility: member.agility,
      skills: member.skills,
      factors: member.factors,
      variantFactorId: member.variantFactorId,
      spells: member.spells,
      battleActionPolicy: member.battleActionPolicy,
    } as Goblin))

    // 各メンバーの現在HPを配列で渡す
    const currentHP = partyState.map(member => member.currentHP)

    // 新しい戦闘システムを実行
    const battleResult = this.battleSystem.executeBattle(allGoblins, currentHP, enemies, this.rng)

    // CombatReplayに変換
    const outcome = battleResult.outcome === 'retreat' ? 'escape' : battleResult.outcome

    return {
      rounds: battleResult.rounds,
      outcome,
      allyHPDelta: battleResult.allyHPDelta,
      enemyDefeated: battleResult.enemyDefeated,
      detailedLog: battleResult.detailedLog,
    }
  }

  /**
   * 通常/不明イベントの戦闘処理（battleイベントとdefaultイベントで共通化）
   * 戦闘結果の反映・宝箱ドロップ・帰還判定までを行い、帰還要否を返す。
   */
  private processBattleEvent(params: {
    partyState: PartyState[]
    enemyDatabase: ReturnType<typeof getEnemyDatabase>
    area: AreaConfig
    currentFloor: number
    currentTime: number
    tier: DungeonTier
    isFloorEnd: boolean
    droppedTemplateIds: Set<string>
    partyLuckAverage: number
    effectiveRewardMultipliers: PartyRewardMultipliers
    rareDropMultiplierBoost: number
    titleMultiplierBoost: number
    expMultiplierBoost: number
    returnPolicy: ExpeditionRequest['returnPolicy']
    events: TimelineEvent[]
  }): { shouldReturn: boolean; returnReason: ExpeditionEndReason | null } {
    const {
      partyState, enemyDatabase, area, currentFloor, currentTime, tier, isFloorEnd,
      droppedTemplateIds, partyLuckAverage, effectiveRewardMultipliers,
      rareDropMultiplierBoost, titleMultiplierBoost, expMultiplierBoost, returnPolicy, events,
    } = params

    const pattern = this.selectEnemyPattern(enemyDatabase!.patterns, currentFloor, tier, false, isFloorEnd)
    const enemies = this.applyTierScaling(this.getEnemiesFromPattern(pattern, enemyDatabase!.enemies), tier)
    const combat = this.resolveCombat(partyState, enemies, area)
    const xp = combat.outcome === 'win' ? this.calculateEnemyXp(enemies, expMultiplierBoost) : 0

    events.push({
      type: "battle",
      at: currentTime,
      floor: currentFloor,
      enemy: this.createEnemySnap(enemies),
      combat,
      xp
    })

    // パーティ状態を更新
    this.applyBattleResults(partyState, combat)

    // 戦闘敗北時は即座に帰還
    if (combat.outcome === 'lose') {
      return { shouldReturn: true, returnReason: 'defeated' }
    }

    if (combat.outcome === 'win') {
      const treasureDrops = rollTreasureDrops(
        enemies.flat(),
        droppedTemplateIds,
        partyLuckAverage,
        effectiveRewardMultipliers,
        rareDropMultiplierBoost,
        titleMultiplierBoost,
        tier,
        this.rng
      )
      if (treasureDrops.length > 0) {
        events.push({
          type: "treasure",
          at: currentTime,
          floor: currentFloor,
          items: treasureDrops
        })
      }
    }

    // 帰還条件をチェック
    const returnCheck = this.checkReturnConditions(partyState, returnPolicy, currentFloor)
    if (returnCheck.shouldReturn && returnCheck.reason) {
      return { shouldReturn: true, returnReason: returnCheck.reason }
    }

    return { shouldReturn: false, returnReason: null }
  }

  private applyBattleResults(partyState: PartyState[], combat: CombatReplay): void {
    combat.allyHPDelta.forEach((delta, index) => {
      const member = partyState[index]
      if (!member) return
      // 純ゴブリンの群れボーナス等で戦闘中maxHPが膨らむため、本来の最大HPで上限クランプする
      const maxHP = member.effectiveStats?.hp ?? member.maxHP
      member.currentHP = Math.max(0, Math.min(maxHP, member.currentHP + delta))
      if (member.currentHP <= 0) {
        member.isKO = true
        member.isDead = true
      } else {
        // 蘇生（immediate_revive）等でHPが正に戻った場合はKO/死亡フラグを解除する
        member.isKO = false
        member.isDead = false
      }
    })
  }

  private checkReturnConditions(partyState: PartyState[], returnPolicy: ExpeditionRequest["returnPolicy"], _currentFloor: number): { shouldReturn: boolean; reason: ExpeditionEndReason | null } {
    const aliveMembers = partyState.filter(member => !member.isKO).length

    switch (returnPolicy) {
      case "if_any_ko":
        if (partyState.some(member => member.isKO)) {
          return { shouldReturn: true, reason: "policy_return" }
        }
        break
      case "if_two_ko":
        if (partyState.filter(member => member.isKO).length >= 2) {
          return { shouldReturn: true, reason: "policy_return" }
        }
        break
      case "last_one":
        if (aliveMembers <= 1) {
          return { shouldReturn: true, reason: "policy_return" }
        }
        break
      case "never":
        // 帰還条件なし - 最後まで探索（ボスクリアまたは全滅まで続行）
        break
    }

    return { shouldReturn: false, reason: null }
  }

  private normalizeTargetFloor(targetFloor: number | null | undefined, areaFloors: number): number {
    if (typeof targetFloor !== 'number' || !Number.isFinite(targetFloor)) {
      return areaFloors
    }
    return Math.max(1, Math.min(areaFloors, Math.floor(targetFloor)))
  }

  private calculateRewardSummary(
    events: TimelineEvent[],
    partyState: PartyState[],
    rewardMultipliers?: PartyRewardMultipliers,
    goldBonusPercent: number = 0,
    goldMultiplierBoost: number = 1,
  ): RewardSummary {
    const { gold: goldMultiplier } = normalizePartyRewardMultipliers(rewardMultipliers)
    const skillGoldMultiplier = 1 + goldBonusPercent / 100
    const effectiveGoldBoost = goldMultiplierBoost > 0 ? goldMultiplierBoost : 1
    let xpGained = 0
    let baseGoldGained = 0
    let flatGoldGained = 0
    let maxFloorReached = 1
    const treasureDrops: TreasureDrop[] = []

    for (const event of events) {
      if (event.type === "battle" || event.type === "boss") {
        if (event.combat.outcome === "win") {
          xpGained += event.xp
          baseGoldGained += event.enemy.gold
        }
        maxFloorReached = Math.max(maxFloorReached, event.floor)
      } else if (event.type === "floor_up") {
        maxFloorReached = Math.max(maxFloorReached, event.to)
      } else if (event.type === "floor_end") {
        maxFloorReached = Math.max(maxFloorReached, event.floor)
      } else if (event.type === "gold_treasure") {
        flatGoldGained += event.gold
        maxFloorReached = Math.max(maxFloorReached, event.floor)
      } else if (event.type === "treasure") {
        treasureDrops.push(...event.items)
      }
    }

    const casualties = partyState.filter(member => member.isDead).map(member => member.id)
    const successReasons: Set<ExpeditionEndReason> = new Set([
      "completed",
      "policy_return"
    ])
    const success = events.some(event =>
      event.type === "return" &&
      event.reason !== undefined &&
      successReasons.has(event.reason)
    )

    const goldGained = Math.floor(baseGoldGained * goldMultiplier * skillGoldMultiplier * effectiveGoldBoost) + flatGoldGained
    const totalGoldMultiplier = goldMultiplier * skillGoldMultiplier * effectiveGoldBoost

    return {
      success,
      maxFloorReached,
      xpGained,
      goldGained,
      goldMultiplier: totalGoldMultiplier,
      casualties,
      treasureDrops: treasureDrops.length > 0 ? treasureDrops : undefined,
    }
  }
}
