#!/usr/bin/env node
'use strict'

/**
 * ヘッドレス・バランスシミュレータ エントリ。
 *
 * 「ペルソナ × 全エリア × Tier × 多数シード」で遠征を一括実行し、
 * バランスを数値で一望する。実際のゲームと同じ ExpeditionEngine / エリア定義 /
 * 敵DB を使い、シード付き決定論シミュレーションを行う。
 *
 * ペルソナ:
 *   floor   下限（装備なし/因子なし）
 *   median  到達時点で入手可能な中程度の一式
 *   ceiling 入手可能プールを山登り最適化した準最適ビルド（上限）
 * --persona floor,median,ceiling のようにカンマ区切りで複数指定すると、
 * 同じ area×Tier 行に各ペルソナの進捗スコアを並べた比較表を出す。
 *
 * 使い方: npm run balance:sim -- [options]
 */

const fs = require('fs')
const path = require('path')

// TS ローダ・エイリアス・モックを有効化（他の src import より先に）
const { suppressEngineLogs } = require('./runtime')

const { ExpeditionEngine } = require('@/core/services/ExpeditionEngine')
const { getAreaConfig } = require('@/shared/data/expeditionArea')
const { getDungeonTierAreaLevel, DUNGEON_TIER_SELECTABLE_MAX, DUNGEON_TIER_LIST } = require('@/shared/types/DungeonTier')
const allAreaData = require('@/shared/data/expeditionArea/allArea.json')
const { getEquipmentTemplate } = require('@/shared/data/equipmentPoolLoader')
const { getFactor } = require('@/shared/data/factors')

const { getPersona, CEILING_DEFAULTS } = require('./personas')
const { extractExpeditionMetrics, aggregateMetrics, WEIGHTS, ROUND_NORM_CAP } = require('./metrics')
const { formatTable, toCsv, formatComparisonTable, toCsvComparison } = require('./report')

// エリア進行順（allArea.json の並び）
const AREA_ORDER = (allAreaData.areas || []).map(a => a.id)
const AREA_ORDER_INDEX = new Map(AREA_ORDER.map((id, i) => [id, i]))

const DEFAULTS = {
  areas: null, // null = 全エリア
  tiers: null, // null = 0..DUNGEON_TIER_SELECTABLE_MAX
  seeds: 100,
  level: null, // null = エリアの areaLevel
  format: 'table',
  out: null,
  returnPolicy: 'never',
  persona: 'floor', // カンマ区切りで複数可
  partySize: 6, // 編成上限 (MAX_PARTY_MEMBERS)
  ceilingTier: null, // 天井探索の代表Tier。null = 対象Tier集合の中央値
  ceiling: {}, // 天井探索オプション（seeds/candidateCap/starts/maxIters）
}

function parseArgs(argv) {
  const o = { ...DEFAULTS, ceiling: {} }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const val = () => {
      const v = argv[i + 1]
      if (v === undefined) throw new Error(`${arg} の値がありません`)
      i++
      return v
    }
    if (arg === '--areas') o.areas = val().split(',').map(s => s.trim()).filter(Boolean)
    else if (arg === '--tiers') o.tiers = parseTiers(val())
    else if (arg === '--seeds') o.seeds = Number(val())
    else if (arg === '--level') o.level = Number(val())
    else if (arg === '--format') o.format = val()
    else if (arg === '--out') o.out = val()
    else if (arg === '--return-policy') o.returnPolicy = val()
    else if (arg === '--persona') o.persona = val()
    else if (arg === '--party-size') o.partySize = Number(val())
    else if (arg === '--ceiling-tier') o.ceilingTier = Number(val())
    else if (arg === '--ceiling-seeds') o.ceiling.seeds = Number(val())
    else if (arg === '--ceiling-candidates') o.ceiling.candidateCap = Number(val())
    else if (arg === '--ceiling-starts') o.ceiling.starts = Number(val())
    else if (arg === '--ceiling-max-iters') o.ceiling.maxIters = Number(val())
    else if (arg === '--help' || arg === '-h') o.help = true
    else throw new Error(`不明な引数です: ${arg}`)
  }
  return o
}

// "0,1,2" / "0..3" / "2" いずれも受け付ける
function parseTiers(spec) {
  if (spec.includes('..')) {
    const [a, b] = spec.split('..').map(Number)
    const out = []
    for (let t = a; t <= b; t++) out.push(t)
    return out
  }
  return spec.split(',').map(s => Number(s.trim())).filter(t => Number.isFinite(t))
}

function printHelp() {
  console.log(`ヘッドレス・バランスシミュレータ

使い方: npm run balance:sim -- [options]

Options:
  --areas <a,b,c>        対象エリアID（カンマ区切り）。既定: 全エリア（進行順）
  --tiers <0..3 | 0,1>   対象Tier。既定: 0..${DUNGEON_TIER_SELECTABLE_MAX}（ゲーム内選択可能範囲）
  --seeds <N>            計測シード数。既定: ${DEFAULTS.seeds}（seed=1..N の固定列 / common random numbers）
  --level <L>            パーティのレベル。既定: エリアの areaLevel
  --persona <ids>        ペルソナ（カンマ区切り可）: floor,median,ceiling。既定: ${DEFAULTS.persona}
  --party-size <N>       出撃人数。既定: ${DEFAULTS.partySize}（編成上限）
  --return-policy <p>    帰還方針。既定: ${DEFAULTS.returnPolicy}（never=最後まで測定）
  --format <table|csv>   出力形式。既定: ${DEFAULTS.format}
  --out <path>           出力先ファイル。未指定なら標準出力

天井(ceiling)探索オプション:
  --ceiling-tier <T>       山登り評価に使う代表Tier。既定: 対象Tier集合の中央値
  --ceiling-seeds <K>      近傍評価のシード数(CRN)。既定: ${CEILING_DEFAULTS.seeds}
  --ceiling-candidates <M> 各スロットの候補上位数。既定: ${CEILING_DEFAULTS.candidateCap}
  --ceiling-starts <S>     多スタート数。既定: ${CEILING_DEFAULTS.starts}
  --ceiling-max-iters <N>  山登り反復上限。既定: ${CEILING_DEFAULTS.maxIters}
  --help                   このヘルプ

進捗スコア = ${WEIGHTS.success}×成功率 + ${WEIGHTS.floorReach}×到達フロア率 + ${WEIGHTS.enemyDefeat}×撃破率 + ${WEIGHTS.loseSurvival}×正規化生存ラウンド(cap ${ROUND_NORM_CAP})
`)
}

async function runExpedition(areaId, tier, party, seed, returnPolicy) {
  const engine = new ExpeditionEngine(seed)
  return suppressEngineLogs(() =>
    engine.generateExpedition(
      {
        partyId: 'balance-sim',
        areaId,
        tier,
        returnPolicy,
        clientVersion: 'headless-balance-sim',
      },
      party.map(g => ({ ...g, currentHp: undefined })),
    ),
  )
}

// 天井探索が使う simulate コールバック（party×tier×seed → 1遠征メトリクス）
function makeSimulate(areaId, returnPolicy) {
  return async (party, tier, seed) => {
    const replay = await runExpedition(areaId, tier, party, seed, returnPolicy)
    return extractExpeditionMetrics(replay)
  }
}

function fmtDuration(ms) {
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}分${sec}秒` : `${sec}秒`
}

// 天井ビルドを人間可読テキストに整形する
function describeCeilingBuild(areaId, detail) {
  const b = detail.build
  const names = ids => (ids.length ? ids.map(id => {
    const t = getEquipmentTemplate(id)
    return t ? `${t.name}(${id})` : id
  }).join(', ') : '(なし)')
  const factorName = b.factorId ? (getFactor(b.factorId)?.name ?? b.factorId) : '(なし)'
  const lines = [
    `# ${areaId} 天井ビルド (代表Tier=${detail.tier}, score=${detail.score.toFixed(3)})`,
    `  前衛数(frontCount): ${b.frontCount}`,
    `  前衛(最適化スロット): ${names(b.front)}`,
    `  後衛(最適化スロット): ${names(b.back)}`,
  ]
  if (detail.tail && detail.tail.length > 0) {
    lines.push(`  残スロット(greedy充填/前後衛共通): ${names(detail.tail)}`)
  }
  lines.push(`  因子: ${factorName}`)
  return lines.join('\n')
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    printHelp()
    return
  }

  const personaIds = opts.persona.split(',').map(s => s.trim()).filter(Boolean)
  const personas = personaIds.map(id => {
    const p = getPersona(id)
    if (!p) throw new Error(`未知のペルソナです: ${id}`)
    return p
  })

  const areas = opts.areas || AREA_ORDER
  const tiers = opts.tiers || DUNGEON_TIER_LIST.slice(0, DUNGEON_TIER_SELECTABLE_MAX + 1)
  const seeds = []
  for (let s = 1; s <= opts.seeds; s++) seeds.push(s)

  // 天井の代表Tier（対象Tier集合の中央値。--ceiling-tier で上書き可）
  const ceilingTier = opts.ceilingTier != null
    ? opts.ceilingTier
    : tiers[Math.floor((tiers.length - 1) / 2)]

  // エリア進行順にソート
  const sortedAreas = [...areas].sort((a, b) =>
    (AREA_ORDER_INDEX.get(a) ?? 999) - (AREA_ORDER_INDEX.get(b) ?? 999),
  )

  const combos = []
  for (const areaId of sortedAreas) {
    const area = getAreaConfig(areaId)
    if (!area) {
      console.error(`[skip] エリアが見つかりません: ${areaId}`)
      continue
    }
    for (const tier of tiers) combos.push({ areaId, area, tier })
  }

  const totalRuns = combos.length * seeds.length * personas.length
  console.error(`シミュレーション開始: ${combos.length} 組 (エリア×Tier) × ${seeds.length} seeds × ${personas.length} persona = ${totalRuns} 計測遠征`)
  console.error(`ペルソナ: ${personas.map(p => p.label).join(' / ')} / returnPolicy: ${opts.returnPolicy}`)
  if (personaIds.includes('ceiling')) {
    console.error(`天井探索: 代表Tier=${ceilingTier}（このビルドを全Tierに流用）。探索用シミュレーションは上記計測数に含まれません`)
  }

  const startedAt = Date.now()
  let doneRuns = 0

  // 比較セル: key=`${area}|${tier}` -> { ..., byPersona: { id: agg } }
  const cellMap = new Map()
  // 単一ペルソナ用の詳細行
  const detailRows = []
  const ceilingDetails = []

  for (const { areaId, area, tier } of combos) {
    const partyLevel = opts.level != null ? opts.level : area.areaLevel
    const simulate = makeSimulate(areaId, opts.returnPolicy)
    const cellKey = `${areaId}|${tier}`

    for (const persona of personas) {
      // パーティ生成（ceiling は代表Tierで山登り。cache により2回目以降は即返る）
      const ctx = {
        level: partyLevel,
        size: opts.partySize,
        areaId,
        tier: ceilingTier,
        tiers,
        simulate,
        options: { ceiling: opts.ceiling },
      }
      let party
      try {
        party = await persona.buildParty(ctx)
      } catch (err) {
        console.error(`\n[skip] ${areaId} tier${tier} ${persona.id}: パーティ生成失敗 (${err.message})`)
        continue
      }

      // 天井ビルド詳細を一度だけ収集
      if (persona.id === 'ceiling' && persona.describeBuild && !ceilingDetails.find(d => d.areaId === areaId)) {
        try {
          const detail = await persona.describeBuild(ctx)
          ceilingDetails.push({ areaId, detail })
        } catch (_) { /* noop */ }
      }

      const perExpedition = []
      let unsupported = false
      for (const seed of seeds) {
        try {
          const replay = await runExpedition(areaId, tier, party, seed, opts.returnPolicy)
          perExpedition.push(extractExpeditionMetrics(replay))
        } catch (err) {
          unsupported = true
          break
        }
        doneRuns++
      }

      const elapsed = Date.now() - startedAt
      const eta = doneRuns > 0 ? (elapsed / doneRuns) * (totalRuns - doneRuns) : 0
      process.stderr.write(
        `\r進捗 ${doneRuns}/${totalRuns}  経過 ${fmtDuration(elapsed)}  残り約 ${fmtDuration(eta)}   `,
      )

      if (unsupported || perExpedition.length === 0) {
        console.error(`\n[skip] ${areaId} tier${tier} ${persona.id}: このTierは対応する敵パターンがありません`)
        continue
      }

      const agg = aggregateMetrics(perExpedition)

      if (!cellMap.has(cellKey)) {
        cellMap.set(cellKey, {
          area: areaId,
          areaLevel: area.areaLevel,
          tier,
          effAreaLevel: getDungeonTierAreaLevel(area.areaLevel, tier),
          partyLevel,
          seeds: seeds.length,
          byPersona: {},
        })
      }
      cellMap.get(cellKey).byPersona[persona.id] = agg

      // 単一ペルソナ時の詳細行（従来フォーマット互換）
      if (personas.length === 1) {
        detailRows.push({
          area: areaId,
          areaLevel: area.areaLevel,
          tier,
          effAreaLevel: getDungeonTierAreaLevel(area.areaLevel, tier),
          partyLevel,
          ...agg,
        })
      }
    }
  }

  process.stderr.write('\n')
  console.error(`完了: ${fmtDuration(Date.now() - startedAt)}`)

  const cells = [...cellMap.values()]

  let output
  if (personas.length === 1) {
    output = opts.format === 'csv' ? toCsv(detailRows) : formatTable(detailRows)
  } else {
    output = opts.format === 'csv'
      ? toCsvComparison(cells, personaIds)
      : formatComparisonTable(cells, personaIds)
  }

  // 天井ビルド詳細（付随情報）
  let buildSection = ''
  if (ceilingDetails.length > 0) {
    const lines = ['', '===== 天井ビルド詳細 =====']
    for (const { areaId, detail } of ceilingDetails) {
      lines.push(describeCeilingBuild(areaId, detail))
    }
    buildSection = lines.join('\n')
    // stderr にも要約を出す（--out 未指定でも見えるように）
    console.error(buildSection)
  }

  if (opts.out) {
    const outPath = path.resolve(opts.out)
    fs.writeFileSync(outPath, output + '\n' + buildSection + '\n', 'utf8')
    console.error(`出力: ${outPath}`)
  } else {
    console.log(output)
  }
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : err)
  process.exit(1)
})
