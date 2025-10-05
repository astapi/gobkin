import type {
  ExpeditionRequest,
  ExpeditionReplay,
  TimelineEvent,
  AreaConfig,
  PartySnapshot,
  EnemySnap,
  CombatReplay,
  Drop,
  RewardSummary,
  Goblin,
  EnemyDatabase,
  Enemy,
  EnemyPattern
} from '../types/index.ts'

export class ExpeditionEngine {
  private rng: () => number
  private seed: number

  constructor(seed?: number) {
    this.seed = seed || this.generateSeed()
    this.rng = this.createSeededRandom(this.seed)
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
      "2": "mossy_cave",
      "3": "old_mine"
    }

    const areaId = dungeonToAreaMap[request.areaId] || request.areaId

    // JSONファイルからエリアデータを読み込む
    const areaData = await import(`../data/expeditionArea/${areaId}.json`)
    const area: AreaConfig = areaData.default || areaData

    if (!area) {
      throw new Error(`Area not found: ${request.areaId} (mapped to: ${areaId})`)
    }

    // 敵データを読み込む
    const enemyData = await import(`../data/enemy/${areaId}.json`)
    const enemyDatabase: EnemyDatabase = enemyData.default || enemyData

    if (!enemyDatabase) {
      throw new Error(`Enemy data not found: ${areaId}`)
    }

    const partySnapshot = this.createPartySnapshot(party, request.returnPolicy)
    const adjustedDuration = Math.floor(area.baseDurationSec / partySnapshot.speedMod)

    const events: TimelineEvent[] = []
    let currentFloor = 1
    let currentTime = 0
    let partyState = this.initializePartyState(party)
    let shouldReturn = false
    let returnReason: string | null = null

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
            const drops = this.generateDrops(area.rewards.lootPool, partySnapshot.luckMod)

            events.push({
              type: "battle",
              at: currentTime,
              floor: currentFloor,
              enemy: this.createEnemySnap(enemies),
              combat,
              xp,
              drops
            })

            // パーティ状態を更新
            this.applyBattleResults(partyState, combat)

            // 帰還条件をチェック
            const returnCheck = this.checkReturnConditions(partyState, request.returnPolicy, currentFloor)
            if (returnCheck.shouldReturn) {
              shouldReturn = true
              returnReason = returnCheck.reason
            }
            break
          }

          case "resource": {
            const loot = this.generateDrops(area.rewards.lootPool, partySnapshot.luckMod * 0.7)
            events.push({
              type: "resource",
              at: currentTime,
              floor: currentFloor,
              loot
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
            // 未知のイベントタイプの処理
            console.warn(`Unknown event type: ${eventType}, treating as battle`)
            // battleとして処理
            const pattern = this.selectEnemyPattern(enemyDatabase.patterns, currentFloor, false)
            const enemies = this.getEnemiesFromPattern(pattern, enemyDatabase.enemies)
            const combat = this.resolveCombat(partyState, enemies, area)
            const xp = area.rewards.xpFloor[currentFloor - 1] || 10
            const drops = this.generateDrops(area.rewards.lootPool, partySnapshot.luckMod)

            events.push({
              type: "battle",
              at: currentTime,
              floor: currentFloor,
              enemy: this.createEnemySnap(enemies),
              combat,
              xp,
              drops
            })

            this.applyBattleResults(partyState, combat)

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
      const bossDrops = this.generateDrops(area.rewards.lootPool, partySnapshot.luckMod * 1.5)

      events.push({
        type: "boss",
        at: currentTime,
        floor: area.floors,
        enemy: this.createEnemySnap(bossEnemies),
        combat: bossCombat,
        xp: bossXp,
        drops: bossDrops
      })

      this.applyBattleResults(partyState, bossCombat)
      returnReason = bossCombat.outcome === "win" ? "boss_clear" : "lose"
      shouldReturn = true
    }

    // 帰還イベント
    if (shouldReturn && returnReason) {
      events.push({
        type: "return",
        at: Math.min(currentTime + 1, adjustedDuration),
        reason: returnReason as any
      })
    }

    console.log('ExpeditionEngine: Generated events:', events.length)
    const summary = this.calculateRewardSummary(events, partyState)
    console.log('ExpeditionEngine: Expedition complete', summary)

    return {
      meta: {
        expeditionId: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        areaId: request.areaId,
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

  private createPartySnapshot(party: Goblin[], returnPolicy: ExpeditionRequest["returnPolicy"]): PartySnapshot {
    const totalStats = party.reduce((acc, goblin) => ({
      hp: acc.hp + goblin.stats.hp,
      atk: acc.atk + goblin.stats.atk,
      sp: acc.sp + goblin.stats.sp,
      spd: acc.spd + goblin.stats.spd,
      def: acc.def + goblin.stats.def
    }), { hp: 0, atk: 0, sp: 0, spd: 0, def: 0 })

    return {
      members: party.map(g => g.id.toString()),
      returnPolicy,
      foodSupply: 1.0,
      speedMod: Math.min(1.0 + (totalStats.spd / 1000), 1.3),
      luckMod: Math.min(1.0 + (totalStats.sp / 1000), 1.2),
      captureSlots: Math.min(party.length, 6),
      carryWeight: party.length * 10,
      powerRating: totalStats.atk + totalStats.def + (totalStats.hp / 10)
    }
  }

  private initializePartyState(party: Goblin[]) {
    return party.map(goblin => ({
      id: goblin.id.toString(),
      currentHP: goblin.stats.hp,
      maxHP: goblin.stats.hp,
      atk: goblin.stats.atk,
      def: goblin.stats.def,
      isKO: false,
      isDead: false
    }))
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
    return {
      id: representative.id,
      name: representative.name,
      lvl: representative.level,
      count: enemies.length
    }
  }

  private resolveCombat(partyState: any[], enemies: Enemy[], area: AreaConfig, isBoss = false): CombatReplay {
    // パーティの戦力計算（HP + ATK + DEF）
    const partyPower = partyState
      .filter(m => !m.isKO)
      .reduce((sum, member) => sum + (member.maxHP + member.atk + member.def), 0)

    // 敵の戦力計算（各敵のHP + ATK + DEF の合計）
    const enemyPower = enemies.reduce((sum, enemy) =>
      sum + (enemy.hp + enemy.atk + enemy.def), 0
    )

    const difficulty = isBoss ? 20 : 15

    const winProb = 1 / (1 + Math.exp(-(partyPower - enemyPower) / difficulty))
    const isWin = this.rng() < winProb

    const rounds = Math.max(1, Math.floor(this.rng() * 5) + 1)

    let allyHPDelta: number[] = []
    if (isWin) {
      // 勝利時のダメージ計算（敵の攻撃力ベース）
      const totalEnemyAtk = enemies.reduce((sum, enemy) => sum + enemy.atk, 0)
      allyHPDelta = partyState.map(member => {
        if (member.isKO) return 0
        const defense = member.def || 1
        const rawDamage = totalEnemyAtk / partyState.filter(m => !m.isKO).length
        const damage = Math.max(1, Math.floor(rawDamage * (1 - defense / (defense + 100)) * (0.5 + this.rng() * 0.5)))
        return -damage
      })
    } else {
      // 敗北時は大ダメージ
      const totalEnemyAtk = enemies.reduce((sum, enemy) => sum + enemy.atk, 0)
      allyHPDelta = partyState.map(member => {
        if (member.isKO) return 0
        const defense = member.def || 1
        const rawDamage = totalEnemyAtk / partyState.filter(m => !m.isKO).length
        const damage = Math.floor(rawDamage * (1 - defense / (defense + 100)) * (1.5 + this.rng() * 0.5))
        return -damage
      })
    }

    const captureCheck = isWin && !isBoss && this.rng() < (area.rewards.captureBonus + 0.1)
    const representative = enemies[0]

    return {
      rounds,
      outcome: isWin ? "win" : "lose",
      allyHPDelta,
      enemyDefeated: isWin ? enemies.length : 0,
      capture: captureCheck ? {
        eligible: true,
        success: this.rng() < 0.3,
        rate: 0.3,
        captured: { id: representative.id, qty: 1 }
      } : { eligible: false }
    }
  }

  private applyBattleResults(partyState: any[], combat: CombatReplay): void {
    combat.allyHPDelta.forEach((delta, index) => {
      if (partyState[index]) {
        partyState[index].currentHP = Math.max(0, partyState[index].currentHP + delta)
        if (partyState[index].currentHP <= 0) {
          partyState[index].isKO = true
        }
      }
    })
  }

  private generateDrops(lootPool: { id: string; w: number }[], luckMod: number): Drop[] {
    const drops: Drop[] = []
    const numDrops = Math.floor(this.rng() * 3) + 1

    for (let i = 0; i < numDrops; i++) {
      const adjustedPool = lootPool.map(item => ({
        ...item,
        w: item.w * (1 + (luckMod - 1) * 0.5)
      }))

      const totalWeight = adjustedPool.reduce((sum, item) => sum + item.w, 0)
      const roll = this.rng() * totalWeight

      let current = 0
      for (const item of adjustedPool) {
        current += item.w
        if (roll <= current) {
          drops.push({ id: item.id, qty: 1 })
          break
        }
      }
    }

    return drops
  }

  private checkReturnConditions(partyState: any[], returnPolicy: ExpeditionRequest["returnPolicy"], currentFloor: number): { shouldReturn: boolean; reason: string } {
    const aliveMembers = partyState.filter(member => !member.isKO).length

    switch (returnPolicy) {
      case "if_any_ko":
        if (partyState.some(member => member.isKO)) {
          return { shouldReturn: true, reason: "if_any_ko" }
        }
        break
      case "last_one":
        if (aliveMembers <= 1) {
          return { shouldReturn: true, reason: "last_one" }
        }
        break
      case "until_floor2":
        if (currentFloor >= 2) {
          return { shouldReturn: true, reason: "until_floorN" }
        }
        break
      case "until_floor3":
        if (currentFloor >= 3) {
          return { shouldReturn: true, reason: "until_floorN" }
        }
        break
    }

    return { shouldReturn: false, reason: "" }
  }

  private calculateRewardSummary(events: TimelineEvent[], partyState: any[]): RewardSummary {
    let xpGained = 0
    const loot: Drop[] = []
    const captures: Drop[] = []
    let maxFloorReached = 1

    for (const event of events) {
      if (event.type === "battle" || event.type === "boss") {
        xpGained += event.xp
        loot.push(...event.drops)
        if (event.combat.capture?.success && event.combat.capture.captured) {
          captures.push(event.combat.capture.captured)
        }
        maxFloorReached = Math.max(maxFloorReached, event.floor)
      } else if (event.type === "resource") {
        loot.push(...event.loot)
      } else if (event.type === "floor_up") {
        maxFloorReached = Math.max(maxFloorReached, event.to)
      }
    }

    const casualties = partyState.filter(member => member.isDead).map(member => member.id)
    const injuries = partyState.filter(member => member.isKO && !member.isDead).map(member => member.id)
    const success = events.some(event =>
      event.type === "return" && (event.reason === "boss_clear" || event.reason === "until_floorN")
    )

    return {
      success,
      maxFloorReached,
      xpGained,
      loot,
      captures,
      casualties,
      injuries
    }
  }
}