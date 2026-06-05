#!/usr/bin/env node

/**
 * 序盤ダンジョンの敵・パターン・報酬を一覧化する。
 *
 * 周辺の森からオーク野営地までの段階差を見て、難易度調整の材料にする。
 */

const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const areaDir = path.join(projectRoot, 'src', 'shared', 'data', 'expeditionArea')
const enemyDir = path.join(projectRoot, 'src', 'shared', 'data', 'enemy')

const DEFAULT_AREAS = [
  'forest_outskirts',
  'goblin_village_1',
  'forest_edge_village',
  'old_well_waterway',
  'undead_ruins_1',
  'bandit_hideout',
  'road_1',
  'orc_camp_1',
]

const RACE_IMPLIES = {
  bat: ['beast'],
  construct: ['demon_race'],
  dwarf: ['human'],
  elf: ['human'],
  harpy: ['beast'],
  hobbit: ['human'],
  hobgoblin: ['beast'],
  goblin: ['beast'],
  founder: ['goblin'],
  insect: ['beast'],
  lizardman: ['beast', 'dragon'],
  minotaur: ['beast'],
  orc: ['beast'],
  slime: ['beast'],
  wolf: ['beast'],
}

const RACE_EXP_COEFFICIENTS = {
  human: 1.15,
  beast: 1.0,
  construct: 1.2,
}

const LEVEL_EXP_BASE = 1.8
const BOSS_EXP_BASE = 9.6

function parseArgs(argv) {
  const options = {
    areas: DEFAULT_AREAS,
    out: 'reports/early-dungeon-balance.md',
    jsonOut: 'reports/early-dungeon-balance.json',
  }
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    const readValue = () => {
      const value = argv[index + 1]
      if (value === undefined) throw new Error(`${arg} の値がありません`)
      index++
      return value
    }
    if (arg === '--areas') options.areas = readValue().split(',').map((value) => value.trim()).filter(Boolean)
    else if (arg === '--out') options.out = readValue()
    else if (arg === '--json-out') options.jsonOut = readValue()
    else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`不明な引数です: ${arg}`)
  }
  return options
}

function printHelp() {
  console.log(`Usage: npm run sim:early-balance-report -- [options]

Options:
  --areas <a,b,...>     対象 areaId。未指定時は周辺の森〜オーク野営地。
  --out <path>          Markdown 出力。デフォルト: reports/early-dungeon-balance.md
  --json-out <path>     JSON 出力。デフォルト: reports/early-dungeon-balance.json
`)
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeText(relativePath, text) {
  const resolved = path.resolve(projectRoot, relativePath)
  fs.mkdirSync(path.dirname(resolved), { recursive: true })
  fs.writeFileSync(resolved, text, 'utf8')
  return resolved
}

function writeJson(relativePath, value) {
  return writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`)
}

function expandRaceTags(tags) {
  const expanded = new Set()
  const visit = (tag) => {
    if (expanded.has(tag)) return
    expanded.add(tag)
    for (const implied of RACE_IMPLIES[tag] ?? []) visit(implied)
  }
  for (const tag of tags ?? []) visit(tag)
  return expanded
}

function getRaceExpCoefficient(tags) {
  const expanded = expandRaceTags(tags)
  let coefficient = 1
  for (const tag of expanded) {
    coefficient = Math.max(coefficient, RACE_EXP_COEFFICIENTS[tag] ?? 1)
  }
  return coefficient
}

function calculateRuntimeExp(enemy) {
  const base = (enemy.isBoss ? BOSS_EXP_BASE : LEVEL_EXP_BASE) * (enemy.level ?? 1)
  return Math.round(base * getRaceExpCoefficient(enemy.raceTags ?? []))
}

function flattenEnemyIds(value) {
  if (typeof value === 'string') return [value]
  if (!Array.isArray(value)) return []
  return value.flatMap(flattenEnemyIds)
}

function summarizeEnemy(enemy) {
  const attackCount = Number(enemy.attackCount ?? 1)
  const atk = Number(enemy.atk ?? 0)
  return {
    id: enemy.id,
    name: enemy.name,
    level: Number(enemy.level ?? 0),
    hp: Number(enemy.hp ?? 0),
    atk,
    attackCount,
    attackPressure: atk * attackCount,
    def: Number(enemy.def ?? 0),
    magicDef: Number(enemy.magicDef ?? 0),
    accuracy: Number(enemy.accuracy ?? 0),
    evasion: Number(enemy.evasion ?? 0),
    jsonExp: Number(enemy.exp ?? 0),
    runtimeExp: calculateRuntimeExp(enemy),
    gold: Number(enemy.gold ?? 0),
    isBoss: enemy.isBoss === true,
    tags: enemy.raceTags ?? [],
    skillIds: (enemy.skills ?? []).map((skill) => skill.id).filter(Boolean),
  }
}

function summarizePattern(pattern, enemyById) {
  const ids = flattenEnemyIds(pattern.enemies)
  const enemies = ids.map((id) => {
    const enemy = enemyById.get(id)
    if (!enemy) throw new Error(`Enemy not found in pattern ${pattern.id}: ${id}`)
    return enemy
  })
  const rows = pattern.enemies.length
  return {
    id: pattern.id,
    floors: pattern.floors ?? [],
    rows,
    count: enemies.length,
    enemyIds: ids,
    isBoss: pattern.isBoss === true,
    isFloorBoss: pattern.isFloorBoss === true,
    totalHp: sum(enemies, 'hp'),
    totalAttackPressure: sum(enemies, 'attackPressure'),
    maxDef: Math.max(...enemies.map((enemy) => enemy.def), 0),
    maxMagicDef: Math.max(...enemies.map((enemy) => enemy.magicDef), 0),
    maxAccuracy: Math.max(...enemies.map((enemy) => enemy.accuracy), 0),
    maxEvasion: Math.max(...enemies.map((enemy) => enemy.evasion), 0),
    runtimeExp: sum(enemies, 'runtimeExp'),
    jsonExp: sum(enemies, 'jsonExp'),
    gold: sum(enemies, 'gold'),
  }
}

function sum(values, key) {
  return values.reduce((total, value) => total + Number(value[key] ?? 0), 0)
}

function avg(values, key) {
  if (values.length === 0) return 0
  return sum(values, key) / values.length
}

function median(values) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function round(value, digits = 1) {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function analyzeArea(areaId) {
  const area = readJson(path.join(areaDir, `${areaId}.json`))
  const enemyDb = readJson(path.join(enemyDir, `${areaId}.json`))
  const enemies = (enemyDb.enemies ?? []).map(summarizeEnemy)
  const enemyById = new Map(enemies.map((enemy) => [enemy.id, enemy]))
  const patterns = (enemyDb.patterns ?? []).map((pattern) => summarizePattern(pattern, enemyById))
  const regularPatterns = patterns.filter((pattern) => !pattern.isBoss && !pattern.isFloorBoss)
  const floorBossPatterns = patterns.filter((pattern) => pattern.isFloorBoss)
  const bossPatterns = patterns.filter((pattern) => pattern.isBoss)
  const eventIntervalSec = Number(area.encounter?.eventIntervalSec ?? 0)
  const eventCount = eventIntervalSec > 0 ? Number(area.baseDurationSec ?? 0) / eventIntervalSec : 0
  const battleWeight = Number(area.encounter?.eventWeights?.battle ?? 0)
  const totalWeight = Object.values(area.encounter?.eventWeights ?? {}).reduce((total, value) => total + Number(value), 0)
  const expectedRandomBattles = totalWeight > 0 ? eventCount * battleWeight / totalWeight : 0
  const avgRuntimeExp = avg(regularPatterns, 'runtimeExp')
  return {
    areaId,
    name: area.name,
    areaLevel: Number(area.areaLevel ?? 0),
    floors: Number(area.floors ?? 0),
    baseDurationSec: Number(area.baseDurationSec ?? 0),
    eventIntervalSec,
    expectedRandomBattles: round(expectedRandomBattles, 2),
    enemyCount: enemies.length,
    patternCount: patterns.length,
    regularPatternCount: regularPatterns.length,
    floorBossPatternCount: floorBossPatterns.length,
    bossPatternCount: bossPatterns.length,
    enemies,
    patterns,
    summary: {
      avgEnemyLevel: round(avg(enemies, 'level')),
      maxEnemyLevel: Math.max(...enemies.map((enemy) => enemy.level), 0),
      avgEnemyHp: round(avg(enemies, 'hp')),
      avgRegularPatternHp: round(avg(regularPatterns, 'totalHp')),
      medRegularPatternHp: round(median(regularPatterns.map((pattern) => pattern.totalHp))),
      maxRegularPatternHp: Math.max(...regularPatterns.map((pattern) => pattern.totalHp), 0),
      avgRegularAttackPressure: round(avg(regularPatterns, 'totalAttackPressure')),
      medRegularAttackPressure: round(median(regularPatterns.map((pattern) => pattern.totalAttackPressure))),
      maxRegularAttackPressure: Math.max(...regularPatterns.map((pattern) => pattern.totalAttackPressure), 0),
      avgRegularRuntimeExp: round(avgRuntimeExp),
      estimatedRandomExpPerClear: round(avgRuntimeExp * expectedRandomBattles),
      bossRuntimeExp: sum(bossPatterns, 'runtimeExp'),
      bossHp: sum(bossPatterns, 'totalHp'),
      bossAttackPressure: sum(bossPatterns, 'totalAttackPressure'),
    },
  }
}

function addDiffs(areas) {
  return areas.map((area, index) => {
    const prev = areas[index - 1]
    if (!prev) return { ...area, diffFromPrevious: null }
    const ratio = (key) => {
      const before = prev.summary[key]
      const after = area.summary[key]
      return before > 0 ? round(after / before, 2) : null
    }
    return {
      ...area,
      diffFromPrevious: {
        areaLevelDelta: area.areaLevel - prev.areaLevel,
        avgPatternHpRatio: ratio('avgRegularPatternHp'),
        avgAttackPressureRatio: ratio('avgRegularAttackPressure'),
        avgRuntimeExpRatio: ratio('avgRegularRuntimeExp'),
        estimatedRandomExpRatio: ratio('estimatedRandomExpPerClear'),
        bossHpRatio: ratio('bossHp'),
        bossExpRatio: ratio('bossRuntimeExp'),
      },
    }
  })
}

function renderMarkdown(areas) {
  const lines = [
    '# Early Dungeon Balance Snapshot',
    '',
    '対象: 周辺の森〜オークの野営地。',
    '経験値は `ExpeditionEngine` 実行時の `calculateEnemyExp(level, raceTags, isBoss)` を基準に併記。',
    '',
    '## Dungeon Summary',
    '',
    '| Area | Lv | Floors | Enemy | Pattern | AvgPatHP | AvgPress | AvgXP | EstRandomXP | BossHP | BossXP | Diff |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|',
  ]

  for (const area of areas) {
    const diff = area.diffFromPrevious
      ? `HPx${area.diffFromPrevious.avgPatternHpRatio} / Pressx${area.diffFromPrevious.avgAttackPressureRatio} / XPx${area.diffFromPrevious.avgRuntimeExpRatio}`
      : '-'
    lines.push([
      `| ${area.areaId}`,
      area.areaLevel,
      area.floors,
      area.enemyCount,
      `${area.regularPatternCount}+${area.floorBossPatternCount}+${area.bossPatternCount}`,
      area.summary.avgRegularPatternHp,
      area.summary.avgRegularAttackPressure,
      area.summary.avgRegularRuntimeExp,
      area.summary.estimatedRandomExpPerClear,
      area.summary.bossHp,
      area.summary.bossRuntimeExp,
      `${diff} |`,
    ].join(' | '))
  }

  lines.push('', '## Enemy Summary', '')
  for (const area of areas) {
    lines.push(`### ${area.areaId} / ${area.name}`)
    lines.push('')
    lines.push('| Enemy | Lv | HP | ATKxCount | DEF/MDEF | ACC/EVA | JSON Exp | Runtime Exp | Tags |')
    lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---|')
    for (const enemy of area.enemies) {
      lines.push(`| ${enemy.id}${enemy.isBoss ? ' (Boss)' : ''} ${enemy.name} | ${enemy.level} | ${enemy.hp} | ${enemy.atk}x${enemy.attackCount}=${enemy.attackPressure} | ${enemy.def}/${enemy.magicDef} | ${enemy.accuracy}/${enemy.evasion} | ${enemy.jsonExp} | ${enemy.runtimeExp} | ${enemy.tags.join(',')} |`)
    }
    lines.push('')
  }

  lines.push('## Pattern Summary', '')
  for (const area of areas) {
    lines.push(`### ${area.areaId}`)
    lines.push('')
    lines.push('| Pattern | Floors | Type | Count | Rows | HP | Press | MaxDEF | XP | Enemies |')
    lines.push('|---|---|---|---:|---:|---:|---:|---:|---:|---|')
    for (const pattern of area.patterns) {
      const type = pattern.isBoss ? 'boss' : pattern.isFloorBoss ? 'floorBoss' : 'regular'
      lines.push(`| ${pattern.id} | ${pattern.floors.join(',')} | ${type} | ${pattern.count} | ${pattern.rows} | ${pattern.totalHp} | ${pattern.totalAttackPressure} | ${pattern.maxDef} | ${pattern.runtimeExp} | ${pattern.enemyIds.join(',')} |`)
    }
    lines.push('')
  }

  lines.push('## Notes', '')
  lines.push('- `Pattern` の `regular+floorBoss+boss` は通常抽選パターン数 + フロアボス数 + 最終ボス数。')
  lines.push('- `EstRandomXP` は `baseDurationSec / eventIntervalSec * battleWeight / totalWeight * AvgXP` の概算。実際の踏破ではボス戦・途中帰還・乱数で変動する。')
  lines.push('- `Diff` は直前ダンジョン比。1.0 に近い場合、段階差が弱い。')

  return `${lines.join('\n')}\n`
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }
  const areas = addDiffs(options.areas.map(analyzeArea))
  const jsonPath = writeJson(options.jsonOut, { version: 1, createdAt: new Date().toISOString(), areas })
  const markdownPath = writeText(options.out, renderMarkdown(areas))
  console.log(`json=${jsonPath}`)
  console.log(`markdown=${markdownPath}`)
}

main()
