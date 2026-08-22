#!/usr/bin/env node

/**
 * 戦略ペルソナ(strategist)が山登り探索で到達したビルドを JSON に書き出す。
 *
 * measureArea.js / measureTiers.js が「必要Lv」を測るとき、内部では
 * searchStrategistBuild が隊列・ジョブ・亜種・装備を探索してパーティを組んでいる。
 * その探索結果はプロセス内キャッシュに載るだけで、どんなPTで測ったのかが
 * 後から辿れなかった。本スクリプトはその結果を成果物として残し、
 * tools/studio のシミュレーションから同じPTを再現できるようにする。
 *
 * 出力: scripts/balance/out/strategist-builds.json（git 管理下・レビュー可能）
 *
 * 実行:
 *   node scripts/balance/exportStrategistBuilds.js <areaId...>   # 指定エリア
 *   node scripts/balance/exportStrategistBuilds.js --all         # 全エリア(重い)
 *   node scripts/balance/exportStrategistBuilds.js --tier 3 <areaId...>
 *   node scripts/balance/exportStrategistBuilds.js --level 120 <areaId...>
 *
 * --level は探索を行うレベル。既定は 3 で、これは measureArea.js が
 * レベルグリッド下端から探索を始める挙動をそのまま再現する
 * (docs/balance_progress.md「Lv3盲目探索」を参照)。高Tierの実力を見る場合は
 * probeOptimalBuild.js と同じく高いレベルを明示すること。
 *
 * 既存の出力は areaId|tier をキーにマージする(指定しなかったエリアは消さない)。
 */

const fs = require('node:fs')
const path = require('node:path')

require('./headless/runtime')
const { ExpeditionEngine } = require('@/core/services/ExpeditionEngine')
const { suppressEngineLogs } = require('./headless/runtime')
const { extractExpeditionMetrics } = require('./headless/metrics')
const { searchStrategistBuild } = require('./headless/personas')
const { EQUIPMENT_SLOT_LEVELS } = require('@/shared/data/equipmentConfig')

const allAreaData = require('@/shared/data/expeditionArea/allArea.json')

const ROOT = path.resolve(__dirname, '../..')
const OUT_PATH = path.join(ROOT, 'scripts/balance/out/strategist-builds.json')

/** 装備枠は最大でもこの数までしか開かない(Lv200 で 23 枠)。tail 再構築にはこれだけあれば足りる。 */
const MAX_EQUIPMENT_SLOTS = EQUIPMENT_SLOT_LEVELS.length

const DEFAULT_SEARCH_LEVEL = 3
const PARTY_SIZE = 6

function parseArgs(argv) {
  const areaIds = []
  let tier = 0
  let level = DEFAULT_SEARCH_LEVEL
  let all = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--all') {
      all = true
    } else if (arg === '--tier') {
      tier = Number(argv[++i])
    } else if (arg === '--level') {
      level = Number(argv[++i])
    } else if (arg.startsWith('--')) {
      throw new Error(`未知のオプション: ${arg}`)
    } else {
      areaIds.push(arg)
    }
  }

  if (!Number.isInteger(tier) || tier < 0 || tier > 5) {
    throw new Error(`--tier は 0-5 の整数で指定してください: ${tier}`)
  }
  if (!Number.isInteger(level) || level < 1) {
    throw new Error(`--level は 1 以上の整数で指定してください: ${level}`)
  }
  if (all) {
    return { areaIds: allAreaData.areas.map(a => a.id), tier, level }
  }
  if (areaIds.length === 0) {
    throw new Error('エリアIDを1つ以上指定するか --all を付けてください')
  }
  return { areaIds, tier, level }
}

function makeSimulate(areaId) {
  return async (party, tier, seed) => {
    const engine = new ExpeditionEngine(seed)
    const replay = await suppressEngineLogs(() => engine.generateExpedition(
      { partyId: 'export', areaId, tier, returnPolicy: 'never', clientVersion: 'export' },
      party.map(g => ({ ...g, currentHp: undefined })),
    ))
    return extractExpeditionMetrics(replay)
  }
}

/**
 * detail.build を保存用のプレーンな形に変換する。
 * loadout は「最適化スロット分」のみ。残りの枠は equipmentTail から順に埋める
 * (personas.buildStrategistCompAtLevel と同じ規則)。
 */
function serializeBuild(detail, areaId, tier, level) {
  const { build, optimizedSlots, rankedEquip, score, jobs, variants } = detail
  return {
    areaId,
    tier,
    searchLevel: level,
    score: Number(score.toFixed(6)),
    frontCount: build.frontCount,
    optimizedSlots,
    /**
     * 装備枠が最適化スロットより多いレベルで使う充填候補。
     * loadout = members[i].loadout.slice(0, optimizedSlots) + equipmentTail をスロット数まで。
     */
    equipmentTail: rankedEquip.slice(optimizedSlots, MAX_EQUIPMENT_SLOTS),
    members: build.members.map(m => ({
      kind: m.kind,
      jobId: m.jobId ?? null,
      raceId: m.raceId ?? null,
      variant: m.variant ?? null,
      loadout: [...m.loadout],
    })),
    availableJobs: [...jobs],
    availableVariants: variants.map(v => v.id),
  }
}

function loadExisting() {
  if (!fs.existsSync(OUT_PATH)) return null
  try {
    return JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'))
  } catch (err) {
    console.warn(`[warn] 既存の ${path.relative(ROOT, OUT_PATH)} を読めなかったため作り直します: ${err.message}`)
    return null
  }
}

async function main() {
  const { areaIds, tier, level } = parseArgs(process.argv.slice(2))

  const existing = loadExisting()
  const byKey = new Map()
  for (const entry of existing?.builds ?? []) {
    byKey.set(`${entry.areaId}|${entry.tier}`, entry)
  }

  for (const areaId of areaIds) {
    const started = Date.now()
    const detail = await searchStrategistBuild({
      areaId,
      level,
      size: PARTY_SIZE,
      tier,
      tiers: [tier],
      simulate: makeSimulate(areaId),
    })
    const entry = serializeBuild(detail, areaId, tier, level)
    byKey.set(`${areaId}|${tier}`, entry)
    const elapsed = ((Date.now() - started) / 1000).toFixed(1)
    const comp = entry.members
      .map((m, i) => `${i < entry.frontCount ? '前' : '後'}:${m.kind === 'variant' ? m.variant : (m.jobId ?? 'なし')}`)
      .join(' ')
    console.log(`[export] ${areaId} tier${tier} score=${entry.score} (${elapsed}s) ${comp}`)
  }

  const builds = [...byKey.values()].sort((a, b) =>
    a.areaId === b.areaId ? a.tier - b.tier : (a.areaId < b.areaId ? -1 : 1))

  const output = {
    /**
     * 戦略ペルソナが到達したビルドの記録。
     * tools/studio の「戦略ビルド」PTソースがこれを読んで同じPTを再現する。
     */
    generatedAt: new Date().toISOString(),
    partySize: PARTY_SIZE,
    note: 'scripts/balance/exportStrategistBuilds.js が生成。searchLevel は探索を行ったレベル(measureArea 準拠なら 3)。',
    builds,
  }
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  console.log(`\n[done] ${builds.length}件 -> ${path.relative(ROOT, OUT_PATH)}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
