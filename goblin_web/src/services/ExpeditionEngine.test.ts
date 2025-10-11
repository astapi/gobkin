import { ExpeditionEngine } from './ExpeditionEngine.ts'
import type { ExpeditionRequest, Goblin } from '../shared/types'

// テスト用のダミーパーティ
const testParty: Goblin[] = [
  {
    id: 1,
    name: 'テストゴブリン1',
    race: 'ゴブリン',
    level: 5,
    avatar: '/test.png',
    stats: { hp: 100, atk: 50, sp: 30, spd: 40, def: 35 }
  },
  {
    id: 2,
    name: 'テストゴブリン2',
    race: 'ゴブリン',
    level: 4,
    avatar: '/test.png',
    stats: { hp: 80, atk: 60, sp: 40, spd: 45, def: 25 }
  }
]

const testRequest: ExpeditionRequest = {
  partyId: "1",
  areaId: "forest_outskirts",
  returnPolicy: "never",
  clientVersion: "1.0.0"
}

// 基本的な動作確認
export async function testExpeditionEngine(): Promise<void> {
  console.log("=== 遠征エンジンのテスト開始 ===")

  try {
    const engine = new ExpeditionEngine(12345) // 固定シードでテスト
    const result = await engine.generateExpedition(testRequest, testParty)

    console.log("✅ 遠征の生成に成功")
    console.log(`📍 エリア: ${result.meta.areaName}`)
    console.log(`⏱️  想定時間: ${result.durationSec}秒`)
    console.log(`🎯 イベント数: ${result.events.length}`)
    console.log(`🏆 成功: ${result.summary.success ? 'はい' : 'いいえ'}`)
    console.log(`📈 到達階層: ${result.summary.maxFloorReached}`)
    console.log(`⭐ 獲得XP: ${result.summary.xpGained}`)
    console.log(`💰 戦利品: ${result.summary.loot.length}個`)
    console.log(`🐾 捕獲: ${result.summary.captures.length}個`)

    // イベントタイプの確認
    const eventTypes = result.events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log("📋 イベント種別:")
    Object.entries(eventTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}回`)
    })

    console.log("\n=== 最初の5イベント ===")
    result.events.slice(0, 5).forEach((event, index) => {
      console.log(`${index + 1}. [${event.at.toFixed(1)}s] ${event.type}`)
    })

  } catch (error) {
    console.error("❌ テスト失敗:", error)
  }
}

// 決定性テスト（同じシードで同じ結果になるか）
export async function testDeterminism(): Promise<void> {
  console.log("\n=== 決定性テスト ===")

  const seed = 54321
  const engine1 = new ExpeditionEngine(seed)
  const engine2 = new ExpeditionEngine(seed)

  const result1 = await engine1.generateExpedition(testRequest, testParty)
  const result2 = await engine2.generateExpedition(testRequest, testParty)

  const eventsMatch = result1.events.length === result2.events.length &&
    result1.events.every((event, index) => {
      const other = result2.events[index]
      return event.type === other.type && Math.abs(event.at - other.at) < 0.001
    })

  if (eventsMatch) {
    console.log("✅ 決定性テスト成功: 同じシードで同じ結果")
  } else {
    console.log("❌ 決定性テスト失敗: 結果が異なる")
  }
}

// 帰還条件テスト
export async function testReturnPolicies(): Promise<void> {
  console.log("\n=== 帰還条件テスト ===")

  const policies: ExpeditionRequest["returnPolicy"][] = ["until_floor2", "if_any_ko", "never"]

  for (const policy of policies) {
    const request = { ...testRequest, returnPolicy: policy }
    const engine = new ExpeditionEngine()
    const result = await engine.generateExpedition(request, testParty)

    const returnEvent = result.events.find(e => e.type === "return")
    console.log(`${policy}: ${returnEvent ? `理由=${returnEvent.reason}` : '帰還なし'}`)
  }
}

// ブラウザ環境でのテスト実行
if (typeof window !== 'undefined') {
  (window as any).runExpeditionTests = async () => {
    await testExpeditionEngine()
    await testDeterminism()
    await testReturnPolicies()
  }
}