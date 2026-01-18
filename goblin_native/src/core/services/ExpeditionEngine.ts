import type {
  ExpeditionRequest,
  ExpeditionReplay,
  TimelineEvent,
  EnemySnap,
  CombatReplay,
  RewardSummary,
  Goblin,
  Enemy,
  EnemyPattern,
  PartyState,
  ExpeditionEndReason,
  AreaConfig,
} from '../../shared/types'
import { getAreaConfig } from '../../shared/data/expeditionArea'
import { getEnemyDatabase } from '../../shared/data/enemy'
import { BattleSystem } from './BattleSystem'
import { ModStatCalculator } from './ModStatCalculator'

export class ExpeditionEngine {
  private rng: () => number
  private seed: number
  private readonly battleSystem: BattleSystem

  constructor(seed?: number, battleSystem?: BattleSystem) {
    this.seed = seed || this.generateSeed()
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

  public async generateExpedition(request: ExpeditionRequest, party: Goblin[]): Promise<ExpeditionReplay> {
    console.log('ExpeditionEngine: Starting generateExpedition', { request, partySize: party.length })
    // ダンジョンIDからエリアIDにマッピング
    const dungeonToAreaMap: Record<string, string> = {
      "1": "forest_outskirts",
      "2": "goblin_village",
      "3": "orc_camp",
      "4": "slime_cave"
    }

    const areaId = dungeonToAreaMap[request.areaId] || request.areaId

    // エリアデータを取得
    const area = getAreaConfig(areaId)
    if (!area) {
      throw new Error(`Area not found: ${request.areaId} (mapped to: ${areaId})`)
    }

    // 敵データを取得
    const enemyDatabase = getEnemyDatabase(areaId)
    if (!enemyDatabase) {
      throw new Error(`Enemy data not found: ${areaId}`)
    }

    // 表示上の規定時間をそのまま使い、終端にイベントを揃える
    // DEBUG環境変数がtrueの場合は1秒に短縮
    const isDebug = typeof __DEV__ !== 'undefined' ? __DEV__ : false
    const adjustedDuration = isDebug ? 1 : Math.ceil(area.baseDurationSec)

    const events: TimelineEvent[] = []
    let currentFloor = 1
    let currentTime = 0
    const partyState = this.initializePartyState(party)
    let shouldReturn = false
    let returnReason: ExpeditionEndReason | null = null

    // 移動開始イベント
    events.push({
      type: "move_start",
      at: currentTime,
      floor: currentFloor
    })

    console.log('ExpeditionEngine: Starting main loop', { floors: area.floors, adjustedDuration })
    let loopCount = 0
    const MAX_LOOPS = 1000 // 安全装置

    while (currentFloor <= area.floors && !shouldReturn) {
      loopCount++
      if (loopCount > MAX_LOOPS) {
        console.error('ExpeditionEngine: Loop safety limit reached!')
        break
      }
      console.log(`Loop ${loopCount}: Floor ${currentFloor}/${area.floors}, shouldReturn: ${shouldReturn}`)
      const floorEvents = this.generateFloorEvents(area, currentFloor, adjustedDuration)

      console.log(`Floor ${currentFloor} events:`, floorEvents)
      for (const eventTime of floorEvents) {
        if (shouldReturn) break

        currentTime = eventTime
        const eventType = this.selectEventType(area.encounter.eventWeights)
        console.log(`Event type selected: ${eventType} at time ${eventTime}`)

        switch (eventType) {
          case "battle": {
            const pattern = this.selectEnemyPattern(enemyDatabase.patterns, currentFloor, false)
            const enemies = this.getEnemiesFromPattern(pattern, enemyDatabase.enemies)
            const combat = this.resolveCombat(partyState, enemies, area)
            const xp = area.rewards.xpFloor[currentFloor - 1] || 10

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
              shouldReturn = true
              returnReason = 'defeated'
              break
            }

            // 帰還条件をチェック
            const returnCheck = this.checkReturnConditions(partyState, request.returnPolicy, currentFloor)
            if (returnCheck.shouldReturn && returnCheck.reason) {
              shouldReturn = true
              returnReason = returnCheck.reason
            }
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
            // 未知のイベントタイプの処理
            console.warn(`Unknown event type: ${eventType}, treating as battle`)
            // battleとして処理
            const pattern = this.selectEnemyPattern(enemyDatabase.patterns, currentFloor, false)
            const enemies = this.getEnemiesFromPattern(pattern, enemyDatabase.enemies)
            const combat = this.resolveCombat(partyState, enemies, area)
            const xp = area.rewards.xpFloor[currentFloor - 1] || 10

            events.push({
              type: "battle",
              at: currentTime,
              floor: currentFloor,
              enemy: this.createEnemySnap(enemies),
              combat,
              xp
            })

            this.applyBattleResults(partyState, combat)

            // 戦闘敗北時は即座に帰還
            if (combat.outcome === 'lose') {
              shouldReturn = true
              returnReason = 'defeated'
              break
            }

            const returnCheck = this.checkReturnConditions(partyState, request.returnPolicy, currentFloor)
            if (returnCheck.shouldReturn) {
              shouldReturn = true
              returnReason = returnCheck.reason
            }
            break
          }
        }
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
    if (currentFloor > area.floors && !shouldReturn) {
      const bossPattern = this.selectEnemyPattern(enemyDatabase.patterns, area.floors, true)
      const bossEnemies = this.getEnemiesFromPattern(bossPattern, enemyDatabase.enemies)

      const bossCombat = this.resolveCombat(partyState, bossEnemies, area, true)
      const bossXp = area.rewards.xpBoss

      // 規定時間の終端でボス戦を行う（最後の秒で戦闘開始）
      const bossTime = adjustedDuration
      currentTime = bossTime

      events.push({
        type: "boss",
        at: currentTime,
        floor: area.floors,
        enemy: this.createEnemySnap(bossEnemies),
        combat: bossCombat,
        xp: bossXp
      })

      this.applyBattleResults(partyState, bossCombat)
      returnReason = bossCombat.outcome === "win" ? "completed" : "defeated"
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

    console.log('ExpeditionEngine: Generated events:', events.length)
    const summary = this.calculateRewardSummary(events, partyState)
    console.log('ExpeditionEngine: Expedition complete', summary)

    return {
      meta: {
        expeditionId: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        areaId: areaId,
        areaName: area.name,
        floors: area.floors,
        baseDurationSec: area.baseDurationSec,
        party: party.map(g => g.id.toString()),
        returnPolicy: request.returnPolicy,
        seed: this.seed
      },
      durationSec: adjustedDuration,
      events,
      summary
    }
  }

  private initializePartyState(party: Goblin[]): PartyState[] {
    return party.map(goblin => {
      // 基礎ステータスを保存（因子・Mod適用はModStatCalculatorで行う）
      // currentHP/maxHPは因子・Mod適用後の値を使用（戦闘中のHP管理のため）
      const effectiveStats = ModStatCalculator.calculate(goblin)
      return {
        id: goblin.id.toString(),
        name: goblin.name,
        currentHP: effectiveStats.hp,
        maxHP: effectiveStats.hp,
        // 基礎ステータスを保存（ゴブリン再構築時に使用）
        baseHP: goblin.stats.hp,
        atk: goblin.stats.atk,
        def: goblin.stats.def,
        spd: goblin.stats.spd,
        sp: goblin.stats.sp,
        isKO: false,
        isDead: false,
        mods: goblin.mods || [],
        factors: goblin.factors || [],
        variantFactorId: goblin.variantFactorId,
        level: goblin.level,
        avatar: goblin.avatar,
      }
    })
  }

  private generateFloorEvents(area: AreaConfig, floor: number, totalDuration: number): number[] {
    const floorDuration = totalDuration / area.floors
    const floorStart = (floor - 1) * floorDuration
    const events: number[] = []

    for (let i = 0; i < area.encounter.perFloorEvents; i++) {
      const baseTime = floorStart + (i + 1) * (floorDuration / (area.encounter.perFloorEvents + 1))
      const jitter = (this.rng() - 0.5) * (floorDuration * 0.2)
      events.push(Math.max(floorStart + 1, baseTime + jitter))
    }

    return events.sort((a, b) => a - b)
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

  private selectEnemyPattern(patterns: EnemyPattern[], floor: number, isBoss: boolean): EnemyPattern {
    // ボス戦の場合はボスパターンを選択
    if (isBoss) {
      const bossPatterns = patterns.filter(p => p.isBoss && p.floors.includes(floor))
      if (bossPatterns.length === 0) {
        throw new Error(`No boss pattern found for floor ${floor}`)
      }
      return bossPatterns[Math.floor(this.rng() * bossPatterns.length)]
    }

    // 通常戦闘の場合
    const availablePatterns = patterns.filter(p => !p.isBoss && p.floors.includes(floor))
    if (availablePatterns.length === 0) {
      throw new Error(`No enemy pattern found for floor ${floor}`)
    }
    return availablePatterns[Math.floor(this.rng() * availablePatterns.length)]
  }

  private getEnemiesFromPattern(pattern: EnemyPattern, enemyList: Enemy[]): Enemy[] {
    return pattern.enemies.map(enemyId => {
      const enemy = enemyList.find(e => e.id === enemyId)
      if (!enemy) {
        throw new Error(`Enemy not found: ${enemyId}`)
      }
      return enemy
    })
  }

  private createEnemySnap(enemies: Enemy[]): EnemySnap {
    // 代表的な敵（最初の敵）の情報を使用
    const representative = enemies[0]
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

  private resolveCombat(partyState: PartyState[], enemies: Enemy[], _area: AreaConfig, _isBoss = false): CombatReplay {
    // partyStateから全ゴブリンを再構築（死亡メンバーも含む、modsも保持）
    // 基礎ステータスを使用（ModStatCalculatorが因子・Modを適用する）
    const allGoblins: Goblin[] = partyState.map(member => ({
      id: parseInt(member.id),
      name: member.name,
      race: 'ゴブリン' as const,
      level: member.level,
      experience: 0,
      avatar: member.avatar,
      stats: {
        hp: member.baseHP,  // 基礎HPを使用（ModStatCalculatorが因子・Modを適用）
        atk: member.atk,
        sp: member.sp,
        spd: member.spd,
        def: member.def
      },
      mods: member.mods,
      factors: member.factors,
      variantFactorId: member.variantFactorId,
    }))

    // 各メンバーの現在HPを配列で渡す
    const currentHP = partyState.map(member => member.currentHP)

    // 新しい戦闘システムを実行
    const battleResult = this.battleSystem.executeBattle(allGoblins, currentHP, enemies, this.rng)

    // CombatReplayに変換
    const outcome = battleResult.outcome === 'retreat' ? 'lose' : battleResult.outcome

    return {
      rounds: battleResult.rounds,
      outcome,
      allyHPDelta: battleResult.allyHPDelta,
      enemyDefeated: battleResult.enemyDefeated,
      detailedLog: battleResult.detailedLog,
    }
  }

  private applyBattleResults(partyState: PartyState[], combat: CombatReplay): void {
    combat.allyHPDelta.forEach((delta, index) => {
      if (partyState[index]) {
        partyState[index].currentHP = Math.max(0, partyState[index].currentHP + delta)
        if (partyState[index].currentHP <= 0) {
          partyState[index].isKO = true
          partyState[index].isDead = true
        }
      }
    })
  }

  private checkReturnConditions(partyState: PartyState[], returnPolicy: ExpeditionRequest["returnPolicy"], currentFloor: number): { shouldReturn: boolean; reason: ExpeditionEndReason | null } {
    const aliveMembers = partyState.filter(member => !member.isKO).length

    switch (returnPolicy) {
      case "if_any_ko":
        if (partyState.some(member => member.isKO)) {
          return { shouldReturn: true, reason: "policy_return" }
        }
        break
      case "last_one":
        if (aliveMembers <= 1) {
          return { shouldReturn: true, reason: "policy_return" }
        }
        break
      case "until_floor2":
        if (currentFloor >= 2) {
          return { shouldReturn: true, reason: "policy_return" }
        }
        break
      case "until_floor3":
        if (currentFloor >= 3) {
          return { shouldReturn: true, reason: "policy_return" }
        }
        break
    }

    return { shouldReturn: false, reason: null }
  }

  private calculateRewardSummary(events: TimelineEvent[], partyState: PartyState[]): RewardSummary {
    let xpGained = 0
    let goldGained = 0
    let maxFloorReached = 1

    for (const event of events) {
      if (event.type === "battle" || event.type === "boss") {
        xpGained += event.xp
        goldGained += event.enemy.gold
        maxFloorReached = Math.max(maxFloorReached, event.floor)
      } else if (event.type === "floor_up") {
        maxFloorReached = Math.max(maxFloorReached, event.to)
      }
    }

    const casualties = partyState.filter(member => member.isDead).map(member => member.id)
    const injuries = partyState.filter(member => member.isKO && !member.isDead).map(member => member.id)
    const successReasons: Set<ExpeditionEndReason> = new Set([
      "completed",
      "policy_return"
    ])
    const success = events.some(event =>
      event.type === "return" &&
      event.reason !== undefined &&
      successReasons.has(event.reason)
    )

    return {
      success,
      maxFloorReached,
      xpGained,
      goldGained,
      casualties,
      injuries
    }
  }
}
