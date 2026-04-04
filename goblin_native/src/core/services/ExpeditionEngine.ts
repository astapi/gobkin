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
} from '../../shared/types'
import { getAreaConfig } from '../../shared/data/expeditionArea'
import { getEnemyDatabase } from '../../shared/data/enemy'
import { getEquipmentTemplate, getEquipmentByDungeonLevel } from '../../shared/data/equipmentPoolLoader'
import { BattleSystem } from './BattleSystem'
import { ModStatCalculator } from './ModStatCalculator'
import { EquipmentTitleService } from './EquipmentTitleService'

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
    // DEBUG環境変数がtrueの場合は1秒に短縮（明示指定がある場合は尊重）
    const isDebug = typeof __DEV__ !== 'undefined' ? __DEV__ : false
    const requestedDuration = request.durationSec ?? area.baseDurationSec
    const adjustedDuration = isDebug && request.durationSec == null ? 1 : Math.ceil(requestedDuration)

    const events: TimelineEvent[] = []
    let currentFloor = 1
    let currentTime = 0
    const partyState = this.initializePartyState(party)
    let shouldReturn = false
    let returnReason: ExpeditionEndReason | null = null
    const droppedTemplateIds = new Set<string>()  // 遠征中に既にドロップしたアイテム

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

            // 宝箱ドロップ判定（勝利時のみ）
            const treasureDrops = this.rollTreasureDrops(area.dropChance, area.areaLevel, enemies.flat(), droppedTemplateIds)
            if (treasureDrops.length > 0) {
              events.push({
                type: "treasure",
                at: currentTime,
                floor: currentFloor,
                items: treasureDrops
              })
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

            // 宝箱ドロップ判定（勝利時のみ）
            const defaultTreasure = this.rollTreasureDrops(area.dropChance, area.areaLevel, enemies.flat(), droppedTemplateIds)
            if (defaultTreasure.length > 0) {
              events.push({
                type: "treasure",
                at: currentTime,
                floor: currentFloor,
                items: defaultTreasure
              })
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
        enemy: this.createEnemySnap(bossEnemies, true),
        combat: bossCombat,
        xp: bossXp
      })

      this.applyBattleResults(partyState, bossCombat)

      // ボス戦勝利時の宝箱ドロップ判定
      if (bossCombat.outcome === 'win') {
        const bossTreasure = this.rollTreasureDrops(area.dropChance, area.areaLevel, bossEnemies.flat(), droppedTemplateIds)
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
        baseDurationSec: adjustedDuration,
        party: party.map(g => g.id.toString()),
        partySnapshot: party.map(g => ({ ...g })),
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
        attackCount: goblin.stats.attackCount,
        accuracy: goblin.stats.accuracy,
        evasion: goblin.stats.evasion,
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

  private createEnemySnap(enemies2D: Enemy[][], isBoss = false): EnemySnap {
    const enemies = enemies2D.flat()
    // ボス戦の場合、ボス（IDが "B" または "B_" で始まる敵）を代表として選ぶ
    let representative = enemies[0]
    if (isBoss) {
      const boss = enemies.find(e => e.id.startsWith('B_') || e.id.startsWith('B'))
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
        def: member.def,
        attackCount: member.attackCount ?? 2,
        accuracy: member.accuracy ?? 20,
        evasion: member.evasion ?? 15,
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
      case "never":
        // 帰還条件なし - 最後まで探索（ボスクリアまたは全滅まで続行）
        break
    }

    return { shouldReturn: false, reason: null }
  }

  /**
   * 宝箱ドロップを判定（同一遠征中に同じアイテムは1個まで）
   * 1. ダンジョンレベルに対応する装備プールから均等抽選
   * 2. 敵個別の equipmentDrops でレアアイテムを抽選
   * 3. ドロップ時に称号を抽選して付与
   */
  private rollTreasureDrops(
    dropChance: number | undefined,
    dungeonLevel: number,
    enemies: Enemy[],
    droppedIds: Set<string>,
    titleMultiplier: number = 1
  ): TreasureDrop[] {
    const drops: TreasureDrop[] = []

    // ダンジョンレベルに応じた装備プールから抽選
    if (dropChance !== undefined && this.rng() < dropChance) {
      const pool = getEquipmentByDungeonLevel(dungeonLevel)
      const candidates = pool.filter(t => !droppedIds.has(t.id))

      if (candidates.length > 0) {
        const index = Math.floor(this.rng() * candidates.length)
        const selected = candidates[index]

        // 称号を抽選
        const title = EquipmentTitleService.rollTitle(titleMultiplier, this.rng)
        const displayName = EquipmentTitleService.formatTitledName(title.titleName, selected.name)

        drops.push({
          templateId: selected.id,
          name: displayName,
          titleId: title.titleId !== 'none' ? title.titleId : undefined,
          titleName: title.titleName || undefined,
        })
        droppedIds.add(selected.id)
      }
    }

    // 敵個別のレアアイテムドロップ（将来用）
    for (const enemy of enemies) {
      if (!enemy.equipmentDrops) continue
      for (const drop of enemy.equipmentDrops) {
        if (droppedIds.has(drop.templateId)) continue
        if (this.rng() < drop.probability) {
          const template = getEquipmentTemplate(drop.templateId)
          if (template) {
            // 称号を抽選
            const title = EquipmentTitleService.rollTitle(titleMultiplier, this.rng)
            const displayName = EquipmentTitleService.formatTitledName(title.titleName, template.name)

            drops.push({
              templateId: drop.templateId,
              name: displayName,
              titleId: title.titleId !== 'none' ? title.titleId : undefined,
              titleName: title.titleName || undefined,
            })
            droppedIds.add(drop.templateId)
          }
        }
      }
    }

    return drops
  }

  private calculateRewardSummary(events: TimelineEvent[], partyState: PartyState[]): RewardSummary {
    let xpGained = 0
    let goldGained = 0
    let maxFloorReached = 1
    const treasureDrops: TreasureDrop[] = []

    for (const event of events) {
      if (event.type === "battle" || event.type === "boss") {
        xpGained += event.xp
        goldGained += event.enemy.gold
        maxFloorReached = Math.max(maxFloorReached, event.floor)
      } else if (event.type === "floor_up") {
        maxFloorReached = Math.max(maxFloorReached, event.to)
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

    return {
      success,
      maxFloorReached,
      xpGained,
      goldGained,
      casualties,
      treasureDrops: treasureDrops.length > 0 ? treasureDrops : undefined,
    }
  }
}
