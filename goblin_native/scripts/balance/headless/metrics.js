'use strict'

/**
 * リプレイ → メトリクスの純関数群。
 *
 * 設計上の狙い（最重要）:
 *   勝率だけでは「壁エリア」で 0% → 0% となり、装備1つの改善が見えない。
 *   そこで「敗北の中身の前進」を一級メトリクスとして出す:
 *     - 敗北戦闘の平均生存ラウンド数（loseAvgRounds）
 *     - 敵撃破率（enemyDefeatRatio, 敗北戦闘を含む全戦闘）
 *     - 平均到達フロア率（floorReachRatio）
 *   これらを合成した単一スカラー progressScore を出すことで、
 *   「装備を変えたら数字が 0.31 → 0.44 に上がった」と読み取れるようにする。
 */

// ---------------------------------------------------------------------------
// 進捗スコアの重み。ここ一箇所に集約する。根拠はコメント参照。
// ---------------------------------------------------------------------------
const WEIGHTS = {
  // 成功率（遠征クリア率）。最終目標なので最大の重み 1.0。
  success: 1.0,
  // 到達フロア率。壁の手前でも「どこまで潜れたか」を粗く捉える中間指標。0.3。
  floorReach: 0.3,
  // 敵撃破率。全滅遠征でも「何割削れたか」で装備差が滲む。0.2。
  enemyDefeat: 0.2,
  // 正規化した敗北生存ラウンド。壁エリアで唯一動く指標のため小さめだが独立配点 0.1。
  loseSurvival: 0.1,
}

// 敗北生存ラウンドを 0..1 に正規化する基準。
// 通常戦闘は概ね数ラウンドで決着し、10ラウンド粘れれば「相当善戦」とみなせるため 10 を上限とする。
// （2ターン全滅 → 3ターン全滅 のような微小前進を 0.2 → 0.3 として拾える粒度）
const ROUND_NORM_CAP = 10

const HOUR_SEC = 3600

function mean(values) {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

/**
 * 1遠征分のリプレイから、集計前の生メトリクスを抽出する純関数。
 */
function extractExpeditionMetrics(replay) {
  const events = replay.events
  const floors = replay.meta.floors || 1
  const simSec = replay.meta.baseDurationSec || 0 // = simulationDurationSec

  // 戦闘単位の集計（battle と boss を戦闘として扱う）
  let battleCount = 0
  let winBattles = 0
  const loseRounds = [] // 敗北戦闘の生存ラウンド
  const winRounds = []
  let enemyDefeatedTotal = 0
  let enemyCountTotal = 0

  // 残HP計算用（エンジンの applyBattleResults を再現）
  const snapshot = replay.meta.partySnapshot || []
  const maxHP = snapshot.map(g => (g.effectiveStats && g.effectiveStats.hp) || (g.stats && g.stats.hp) || 0)
  const curHP = maxHP.slice()

  let treasureDropCount = 0

  for (const event of events) {
    if (event.type === 'battle' || event.type === 'boss') {
      const combat = event.combat
      battleCount++
      if (combat.outcome === 'win') {
        winBattles++
        winRounds.push(combat.rounds)
      } else if (combat.outcome === 'lose') {
        loseRounds.push(combat.rounds)
      }
      enemyDefeatedTotal += combat.enemyDefeated || 0
      enemyCountTotal += (event.enemy && event.enemy.count) || 0
      // 残HP更新（クランプ付き）
      const deltas = combat.allyHPDelta || []
      for (let i = 0; i < curHP.length; i++) {
        const d = deltas[i] || 0
        curHP[i] = Math.max(0, Math.min(maxHP[i], curHP[i] + d))
      }
    } else if (event.type === 'treasure') {
      treasureDropCount += (event.items && event.items.length) || 0
    }
  }

  const totalMax = maxHP.reduce((a, b) => a + b, 0)
  const totalCur = curHP.reduce((a, b) => a + b, 0)
  const remainingHpPct = totalMax > 0 ? (100 * totalCur) / totalMax : 0

  return {
    success: replay.summary.success ? 1 : 0,
    maxFloorReached: replay.summary.maxFloorReached,
    floors,
    floorReachRatio: replay.summary.maxFloorReached / floors,
    battleCount,
    winBattles,
    loseBattles: loseRounds.length,
    loseRounds,
    winRounds,
    enemyDefeatedTotal,
    enemyCountTotal,
    remainingHpPct,
    casualties: (replay.summary.casualties || []).length,
    gold: replay.summary.goldGained || 0,
    xp: replay.summary.xpGained || 0,
    treasureDropCount,
    simSec,
  }
}

/**
 * 同一 (エリア×Tier×ペルソナ) の複数シード分メトリクスを集計し、進捗スコアを付ける純関数。
 */
function aggregateMetrics(perExpeditionList) {
  const n = perExpeditionList.length
  if (n === 0) return null

  const sum = (sel) => perExpeditionList.reduce((a, m) => a + sel(m), 0)

  const totalBattles = sum(m => m.battleCount)
  const totalWinBattles = sum(m => m.winBattles)
  const totalEnemyDefeated = sum(m => m.enemyDefeatedTotal)
  const totalEnemyCount = sum(m => m.enemyCountTotal)
  const allLoseRounds = perExpeditionList.flatMap(m => m.loseRounds)
  const allWinRounds = perExpeditionList.flatMap(m => m.winRounds)

  const successRate = mean(perExpeditionList.map(m => m.success))
  const floorReachRatio = mean(perExpeditionList.map(m => m.floorReachRatio))
  const enemyDefeatRatio = totalEnemyCount > 0 ? totalEnemyDefeated / totalEnemyCount : 0
  const loseAvgRounds = allLoseRounds.length > 0 ? mean(allLoseRounds) : 0
  const normalizedLoseSurvival = Math.min(1, loseAvgRounds / ROUND_NORM_CAP)

  // 進捗スコア: 重み付き合成（単一スカラー）。装備1つの変更が数字の増減として見える。
  const progressScore =
    WEIGHTS.success * successRate +
    WEIGHTS.floorReach * floorReachRatio +
    WEIGHTS.enemyDefeat * enemyDefeatRatio +
    WEIGHTS.loseSurvival * normalizedLoseSurvival

  const avgSimSec = mean(perExpeditionList.map(m => m.simSec))
  const goldPerHour = avgSimSec > 0 ? (mean(perExpeditionList.map(m => m.gold)) / avgSimSec) * HOUR_SEC : 0
  const xpPerHour = avgSimSec > 0 ? (mean(perExpeditionList.map(m => m.xp)) / avgSimSec) * HOUR_SEC : 0

  return {
    seeds: n,
    successRate,
    battleWinRate: totalBattles > 0 ? totalWinBattles / totalBattles : 0,
    loseAvgRounds,
    winAvgRounds: allWinRounds.length > 0 ? mean(allWinRounds) : 0,
    loseBattleSamples: allLoseRounds.length,
    enemyDefeatRatio,
    avgMaxFloor: mean(perExpeditionList.map(m => m.maxFloorReached)),
    floors: perExpeditionList[0].floors,
    floorReachRatio,
    remainingHpPct: mean(perExpeditionList.map(m => m.remainingHpPct)),
    avgCasualties: mean(perExpeditionList.map(m => m.casualties)),
    goldPerHour,
    xpPerHour,
    dropsPerExpedition: mean(perExpeditionList.map(m => m.treasureDropCount)),
    progressScore,
  }
}

module.exports = {
  WEIGHTS,
  ROUND_NORM_CAP,
  extractExpeditionMetrics,
  aggregateMetrics,
}
