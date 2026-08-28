#!/usr/bin/env node

/**
 * strategist-builds.json の往復検証。
 *
 * tools/studio の `src/lib/strategistParty.ts` は、シミュレータ側
 * `scripts/balance/headless/strategistLayer.js` の buildStrategistGoblin を
 * TypeScript に手で移植したもの。ここがズレると「バランス調整で使ったPT」と
 * 「studio が再現するPT」が別物になるが、両者は別リポジトリ階層にあるため
 * 型チェックでは検出できない。
 *
 * 本スクリプトは studio の TS モジュールを実際に読み込んで実行し、
 * シミュレータが同じ build から組むパーティと 1 体ずつ突き合わせる。
 *
 * 実行:
 *   node scripts/balance/verifyStrategistBuilds.js
 *   node scripts/balance/verifyStrategistBuilds.js --levels 3,50,120
 */

const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')

require('./headless/runtime')

const ROOT = path.resolve(__dirname, '../..')
const SRC_ROOT = path.join(ROOT, 'src')
const STUDIO_SRC = path.resolve(ROOT, '../tools/studio/src')
const BUILDS_PATH = path.join(ROOT, 'scripts/balance/out/strategist-builds.json')

// studio の TS は `@app/*` エイリアスを使う。runtime.js は `@/*` しか見ないため、
// 検証用にここで `@app/*` -> src/* も解決できるようにする。
const originalResolveFilename = Module._resolveFilename
Module._resolveFilename = function patched(request, parent, isMain, options) {
  if (request.startsWith('@app/')) {
    return originalResolveFilename.call(this, path.join(SRC_ROOT, request.slice('@app/'.length)), parent, isMain, options)
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

const { buildStrategistParty } = require('./headless/strategistLayer')
const { calculateSlotCount } = require('@/shared/data/equipmentConfig')
// studio 側の実装（検証対象）
const studio = require(path.join(STUDIO_SRC, 'lib/strategistParty.ts'))

const DEFAULT_LEVELS = [3, 20, 50, 80, 120, 180]

function parseLevels(argv) {
  const idx = argv.indexOf('--levels')
  if (idx === -1) return DEFAULT_LEVELS
  return argv[idx + 1].split(',').map(Number).filter(n => Number.isInteger(n) && n > 0)
}

/**
 * シミュレータ側の comp 復元。
 * personas.js buildStrategistCompAtLevel と同じ規則で loadout を組み立てる。
 */
function compFromBuild(build, level) {
  const slotCount = calculateSlotCount(level)
  const os = build.optimizedSlots
  const tail = build.equipmentTail.slice(0, Math.max(0, slotCount - os))
  const members = build.members.map(m => {
    const full = [...m.loadout.slice(0, os), ...tail].slice(0, slotCount)
    if (m.kind === 'variant') {
      return { raceId: m.raceId, variant: m.variant, factors: [m.variant], loadout: full }
    }
    return { jobId: m.jobId ?? null, loadout: full }
  })
  return { frontCount: build.frontCount, members }
}

const COMPARED_STATS = [
  'hp', 'atk', 'magicAtk', 'def', 'magicDef',
  'attackCount', 'accuracy', 'evasion', 'magicHeal', 'criticalRate',
]

function diffGoblin(a, b, where) {
  const diffs = []
  if (a.raceId !== b.raceId) diffs.push(`${where} raceId: sim=${a.raceId} studio=${b.raceId}`)
  if ((a.job ?? null) !== (b.job ?? null)) diffs.push(`${where} job: sim=${a.job ?? null} studio=${b.job ?? null}`)
  if (a.level !== b.level) diffs.push(`${where} level: sim=${a.level} studio=${b.level}`)
  if (a.skills.length !== b.skills.length) {
    diffs.push(`${where} skills数: sim=${a.skills.length} studio=${b.skills.length}`)
  } else {
    const sa = a.skills.map(s => s.id).join(',')
    const sb = b.skills.map(s => s.id).join(',')
    if (sa !== sb) diffs.push(`${where} skills順序/内容が不一致`)
  }
  for (const key of COMPARED_STATS) {
    const va = a.effectiveStats?.[key]
    const vb = b.effectiveStats?.[key]
    if (va !== vb) diffs.push(`${where} effectiveStats.${key}: sim=${va} studio=${vb}`)
  }
  return diffs
}

function main() {
  if (!fs.existsSync(BUILDS_PATH)) {
    console.error(`${path.relative(ROOT, BUILDS_PATH)} がありません。先に exportStrategistBuilds.js を実行してください。`)
    process.exit(1)
  }
  const levels = parseLevels(process.argv.slice(2))
  const file = JSON.parse(fs.readFileSync(BUILDS_PATH, 'utf8'))
  const builds = file.builds ?? []
  if (builds.length === 0) {
    console.error('builds が空です。')
    process.exit(1)
  }

  const allDiffs = []
  let checked = 0

  for (const build of builds) {
    for (const level of levels) {
      const simParty = buildStrategistParty({
        level,
        size: file.partySize ?? 6,
        comp: compFromBuild(build, level),
      })
      const studioParty = studio.buildPartyFromStrategistBuild(build, level)

      if (simParty.length !== studioParty.length) {
        allDiffs.push(`${build.areaId} T${build.tier} Lv${level}: PT人数 sim=${simParty.length} studio=${studioParty.length}`)
        continue
      }
      for (let i = 0; i < simParty.length; i++) {
        allDiffs.push(...diffGoblin(simParty[i], studioParty[i], `${build.areaId} T${build.tier} Lv${level} #${i + 1}`))
      }
      checked++
    }
  }

  if (allDiffs.length > 0) {
    console.error(`[NG] ${allDiffs.length}件の不一致:\n`)
    for (const d of allDiffs.slice(0, 40)) console.error(`  ${d}`)
    if (allDiffs.length > 40) console.error(`  ... 他 ${allDiffs.length - 40} 件`)
    console.error('\nstrategistLayer.js と tools/studio/src/lib/strategistParty.ts の手順を突き合わせてください。')
    process.exit(1)
  }

  console.log(`[OK] ${builds.length}ビルド × ${levels.length}レベル = ${checked}組を検証。`)
  console.log('     シミュレータと studio のパーティは effectiveStats / skills まで一致しています。')
}

main()
