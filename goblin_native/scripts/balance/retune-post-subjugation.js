#!/usr/bin/env node

/**
 * 討伐隊防衛戦の後続本編エリアを、敵Lv・標準算出ステータス・フロア構成ごと
 * 再調整する。既存の敵IDと名前は極力維持し、王都1/2だけ山場用ボスを追加する。
 *
 * 実行:
 *   node scripts/balance/retune-post-subjugation.js
 */

const fs = require('node:fs')
const path = require('node:path')

require('./headless/runtime')
const {
  calculateEnemyBaseHpFromInputs,
  calculateEnemyBaseAtkFromInputs,
  calculateEnemyBaseDefFromInputs,
  calculateEnemyBaseEvasionFromInputs,
  detectEnemyHpSpecies,
} = require('@/shared/utils/enemyStats')

const ROOT = path.resolve(__dirname, '../..')
const AREA_DIR = path.join(ROOT, 'src/shared/data/expeditionArea')
const ENEMY_DIR = path.join(ROOT, 'src/shared/data/enemy')
const ALL_AREA_PATH = path.join(AREA_DIR, 'allArea.json')

const NORMAL_MULTIPLIER = { hp: 1.6, atk: 1.6, def: 1.25, eva: 0.57 }
const BOSS_MULTIPLIER = { hp: 1.3, atk: 1, def: 1, eva: 0.4 }
const round10 = value => Math.round(value / 10) * 10
const round = value => Math.round(value)

const SPEC = {
  spider_forest_1: {
    areaLevel: 100,
    levels: { SPF001: 100, SPF002: 103, SPF003: 106, B_ARACHNE: 126 },
    pattern: {
      prefix: 'SF1',
      stages: [
        [['SPF001', 'SPF001'], ['SPF002']],
        [['SPF002', 'SPF001'], ['SPF001', 'SPF001']],
        [['SPF002', 'SPF002'], ['SPF003']],
        [['SPF003', 'SPF001'], ['SPF002', 'SPF001']],
        [['SPF003', 'SPF002'], ['SPF002', 'SPF001', 'SPF001']],
        [['SPF003', 'SPF003'], ['SPF002', 'SPF002', 'SPF001']],
      ],
      boss: 'B_ARACHNE',
      bossSupport: ['SPF003', 'SPF002', 'SPF001'],
    },
  },
  dead_grave_1: {
    areaLevel: 114,
    statBoost: 1.55,
    levels: { DGR001: 112, DGR002: 113, DGR003: 115, DGR004: 117, DGR005: 120, B_GRAVE_WARDEN: 142 },
    pattern: {
      prefix: 'DG1',
      stages: [
        [['DGR001', 'DGR001'], ['DGR002']],
        [['DGR001', 'DGR002'], ['DGR003', 'DGR001']],
        [['DGR003', 'DGR004'], ['DGR001', 'DGR002']],
        [['DGR005', 'DGR004'], ['DGR003', 'DGR001', 'DGR004']],
        [['DGR005', 'DGR004'], ['DGR003', 'DGR004', 'DGR002']],
        [['DGR005', 'DGR005'], ['DGR004', 'DGR003', 'DGR001']],
      ],
      boss: 'B_GRAVE_WARDEN',
      bossSupport: ['DGR005', 'DGR004', 'DGR003'],
    },
  },
  harpy_cliff_1: {
    areaLevel: 118,
    statBoost: 1.45,
    bossStatBoost: 1,
    levels: { HRP001: 112, HRP002: 116, B_HARPY_MATRIARCH: 140 },
    pattern: {
      prefix: 'HC1',
      stages: [
        [['HRP001', 'HRP001'], ['HRP002']],
        [['HRP002', 'HRP001'], ['HRP001', 'HRP002']],
        [['HRP002', 'HRP002'], ['HRP001', 'HRP001']],
        [['HRP002', 'HRP001'], ['HRP002', 'HRP001', 'HRP001']],
        [['HRP002', 'HRP002'], ['HRP002', 'HRP001', 'HRP001']],
        [['HRP002', 'HRP002'], ['HRP002', 'HRP002', 'HRP001']],
      ],
      boss: 'B_HARPY_MATRIARCH',
      bossSupport: ['HRP002', 'HRP002', 'HRP001'],
    },
  },
  human_fortress_1: {
    areaLevel: 140,
    statBoost: 1.6,
    levels: { FRT001: 104, FRT002: 106, FRT003: 110, FRT004: 108, FRT005: 114, B_COMMANDER: 132 },
    pattern: {
      prefix: 'HF1',
      stages: [
        [['FRT001', 'FRT001'], ['FRT002']],
        [['FRT001', 'FRT003'], ['FRT002', 'FRT004']],
        [['FRT003', 'FRT001'], ['FRT004', 'FRT002', 'FRT001']],
        [['FRT003', 'FRT003'], ['FRT004', 'FRT002', 'FRT001']],
        [['FRT005', 'FRT003'], ['FRT004', 'FRT002', 'FRT001', 'FRT003']],
        [['FRT005', 'FRT005'], ['FRT003', 'FRT004', 'FRT002', 'FRT001']],
        [['FRT005', 'FRT003', 'FRT005'], ['FRT004', 'FRT002', 'FRT001', 'FRT003']],
        [['FRT005', 'FRT005', 'FRT003'], ['FRT004', 'FRT002', 'FRT001', 'FRT003', 'FRT005']],
      ],
      boss: 'B_COMMANDER',
      bossSupport: ['FRT005', 'FRT003', 'FRT004', 'FRT002', 'FRT001'],
    },
  },
  troll_canyon_1: {
    areaLevel: 130,
    statBoost: 4,
    levels: { TRL001: 96, TRL002: 100, TRL003: 102, TRL004: 106, TRL005: 104, B_TYRANT: 124 },
    pattern: {
      prefix: 'TC1',
      stages: [
        [['TRL001'], ['TRL005']],
        [['TRL002'], ['TRL001', 'TRL005']],
        [['TRL002', 'TRL003'], ['TRL005', 'TRL001']],
        [['TRL004', 'TRL003'], ['TRL005', 'TRL002', 'TRL001']],
        [['TRL004', 'TRL003'], ['TRL005', 'TRL004', 'TRL002']],
        [['TRL004', 'TRL004'], ['TRL005', 'TRL003', 'TRL002']],
      ],
      boss: 'B_TYRANT',
      bossSupport: ['TRL004', 'TRL005', 'TRL003'],
    },
  },
  minotaur_labyrinth_1: {
    areaLevel: 145,
    statBoost: 3,
    levels: { MNT001: 112, MNT002: 118, B_LABYRINTH_KEEPER: 140 },
    pattern: {
      prefix: 'ML1',
      stages: [
        [['MNT001'], ['MNT002']],
        [['MNT002'], ['MNT001', 'MNT001']],
        [['MNT002', 'MNT001'], ['MNT002', 'MNT001']],
        [['MNT002', 'MNT002'], ['MNT001', 'MNT001', 'MNT002']],
        [['MNT002', 'MNT002'], ['MNT002', 'MNT001', 'MNT001']],
        [['MNT002', 'MNT002'], ['MNT002', 'MNT002', 'MNT001']],
      ],
      boss: 'B_LABYRINTH_KEEPER',
      bossSupport: ['MNT002', 'MNT002', 'MNT001'],
    },
  },
  vampire_castle_1: {
    areaLevel: 165,
    statBoost: 3.5,
    levels: { VMP001: 134, VMP002: 140, B_VAMPIRE_LORD: 164 },
    pattern: {
      prefix: 'VC1',
      stages: [
        [['VMP001', 'VMP001'], ['VMP002']],
        [['VMP002', 'VMP001'], ['VMP001', 'VMP002']],
        [['VMP002', 'VMP002'], ['VMP001', 'VMP001']],
        [['VMP002', 'VMP001'], ['VMP002', 'VMP001', 'VMP001']],
        [['VMP002', 'VMP002'], ['VMP001', 'VMP002', 'VMP001']],
        [['VMP002', 'VMP002'], ['VMP002', 'VMP001', 'VMP001']],
      ],
      boss: 'B_VAMPIRE_LORD',
      bossSupport: ['VMP002', 'VMP001', 'VMP001'],
    },
  },
  royal_capital_1: {
    areaLevel: 190,
    statBoost: 2.5,
    levels: { ROY001: 168, ROY002: 174, ROY003: 180, ROY004: 184, ROY005: 190, B_GATE_COMMANDER: 212 },
    extraBoss: {
      source: 'ROY005',
      id: 'B_GATE_COMMANDER',
      name: '王都城門将軍',
    },
    pattern: {
      prefix: 'RC1',
      stages: [
        [['ROY001'], ['ROY002']],
        [['ROY001', 'ROY002'], ['ROY001', 'ROY003']],
        [['ROY003', 'ROY001'], ['ROY002', 'ROY004']],
        [['ROY003', 'ROY003'], ['ROY004', 'ROY002', 'ROY001']],
        [['ROY004', 'ROY003'], ['ROY002', 'ROY001', 'ROY003']],
        [['ROY005', 'ROY003'], ['ROY004', 'ROY002', 'ROY001', 'ROY003']],
        [['ROY005', 'ROY004', 'ROY003'], ['ROY002', 'ROY001', 'ROY005']],
        [['ROY005', 'ROY005', 'ROY003'], ['ROY004', 'ROY002', 'ROY001', 'ROY003', 'ROY005']],
      ],
      boss: 'B_GATE_COMMANDER',
      bossSupport: ['ROY005', 'ROY004', 'ROY003', 'ROY002', 'ROY001'],
    },
  },
  royal_capital_2: {
    areaLevel: 215,
    statBoost: 2.8,
    levels: { ROY001: 188, ROY002: 194, ROY003: 200, ROY004: 204, ROY005: 210, ROY006: 202, B_PALACE_GUARDIAN: 232 },
    extraBoss: {
      source: 'ROY006',
      id: 'B_PALACE_GUARDIAN',
      name: '王城禁衛総長',
    },
    pattern: {
      prefix: 'RC2',
      stages: [
        [['ROY003', 'ROY001'], ['ROY002', 'ROY001']],
        [['ROY004', 'ROY001'], ['ROY003', 'ROY002', 'ROY001']],
        [['ROY003', 'ROY004'], ['ROY001', 'ROY002', 'ROY003']],
        [['ROY004', 'ROY003'], ['ROY006', 'ROY002', 'ROY001', 'ROY003']],
        [['ROY004', 'ROY004'], ['ROY003', 'ROY002', 'ROY001', 'ROY006']],
        [['ROY005', 'ROY004'], ['ROY003', 'ROY002', 'ROY001', 'ROY006']],
        [['ROY005', 'ROY003', 'ROY004'], ['ROY006', 'ROY002', 'ROY001', 'ROY003']],
        [['ROY005', 'ROY005', 'ROY004'], ['ROY006', 'ROY003', 'ROY002', 'ROY001', 'ROY004']],
      ],
      boss: 'B_PALACE_GUARDIAN',
      bossSupport: ['ROY005', 'ROY004', 'ROY003', 'ROY006', 'ROY002'],
    },
  },
  dragon_volcano_1: {
    areaLevel: 235,
    statBoost: 1.8,
    levels: { DRG001: 214, DRG002: 222, DRG003: 230, B_FLAME_DRAGON: 264 },
    pattern: {
      prefix: 'DV1',
      stages: [
        [['DRG001', 'DRG001'], ['DRG002']],
        [['DRG002', 'DRG001'], ['DRG001', 'DRG002']],
        [['DRG002', 'DRG002'], ['DRG003', 'DRG001']],
        [['DRG003', 'DRG001'], ['DRG002', 'DRG002', 'DRG001']],
        [['DRG003', 'DRG002'], ['DRG003', 'DRG002', 'DRG001']],
        [['DRG003', 'DRG003'], ['DRG002', 'DRG002', 'DRG001']],
      ],
      boss: 'B_FLAME_DRAGON',
      bossSupport: ['DRG003', 'DRG002', 'DRG001', 'DRG001'],
    },
  },
  royal_capital_3: {
    areaLevel: 270,
    statBoost: 4,
    levels: { ROY001: 242, ROY002: 248, ROY003: 254, ROY004: 258, ROY005: 264, B_KING: 300 },
    pattern: {
      prefix: 'RC3',
      stages: [
        [['ROY005', 'ROY003'], ['ROY004', 'ROY003']],
        [['ROY004', 'ROY005'], ['ROY003', 'ROY004', 'ROY003']],
        [['ROY005', 'ROY003'], ['ROY004', 'ROY005', 'ROY003']],
        [['ROY004', 'ROY005'], ['ROY003', 'ROY004', 'ROY005', 'ROY003']],
        [['ROY005', 'ROY005'], ['ROY003', 'ROY004', 'ROY003', 'ROY005']],
        [['ROY005', 'ROY004'], ['ROY005', 'ROY003', 'ROY004', 'ROY003']],
        [['ROY005', 'ROY005', 'ROY003'], ['ROY004', 'ROY003', 'ROY005', 'ROY004']],
        [['ROY005', 'ROY005', 'ROY004'], ['ROY003', 'ROY003', 'ROY005', 'ROY004', 'ROY003']],
      ],
      boss: 'B_KING',
      bossSupport: ['ROY005', 'ROY005', 'ROY004', 'ROY003', 'ROY003'],
    },
  },
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function saveJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function buildStats(enemy, level, statBoost = 1) {
  const species = detectEnemyHpSpecies(enemy.raceTags || [])
  const multiplier = enemy.isBoss ? BOSS_MULTIPLIER : NORMAL_MULTIPLIER
  const attrs = enemy.baseAttributes
  const next = { ...enemy, level }
  next.hp = round10(calculateEnemyBaseHpFromInputs(level, attrs.vitality, species) * multiplier.hp * statBoost)
  next.atk = round(calculateEnemyBaseAtkFromInputs(level, attrs.power, species) * multiplier.atk * statBoost)
  next.def = round(calculateEnemyBaseDefFromInputs(level, attrs.vitality, species) * multiplier.def * statBoost)
  next.evasion = Math.min(enemy.isBoss ? 85 : 75,
    round(calculateEnemyBaseEvasionFromInputs(level, attrs.agility, attrs.luck, species) * multiplier.eva * statBoost))
  next.accuracy = Math.min(enemy.isBoss ? 1050 : 990,
    round((enemy.isBoss ? 650 : 540) + level * (enemy.isBoss ? 1.5 : 2)))

  const levelRatio = Math.pow(level / Math.max(enemy.level, 1), 0.85)
  if (enemy.magicDef !== undefined) next.magicDef = round(enemy.magicDef * levelRatio * statBoost)
  if (enemy.magicAtk !== undefined) next.magicAtk = round(enemy.magicAtk * levelRatio * statBoost)
  if (enemy.magicHeal !== undefined) next.magicHeal = round(enemy.magicHeal * levelRatio * statBoost)
  if (enemy.gold !== undefined) next.gold = round(enemy.gold * Math.pow(levelRatio, 0.5))
  if (enemy.exp !== undefined) next.exp = round(enemy.exp * Math.pow(levelRatio, 0.5))
  return next
}

function makePattern(id, floor, enemies, flags = {}) {
  return { id, floors: [floor], enemies, ...flags }
}

function buildPatterns(areaId, config) {
  const { prefix, stages, boss, bossSupport } = config.pattern
  const patterns = []
  for (let floor = 1; floor <= stages.length; floor++) {
    const [front, rear] = stages[floor - 1]
    const regularA = [front, rear]
    const regularB = [
      [...front, ...(front.length > 1 ? [front[0]] : [])],
      rear,
    ]
    const regularC = [
      front,
      [...rear, ...(rear.length > 0 ? [rear[0]] : [])],
    ]
    patterns.push(makePattern(`${prefix}_F${floor}_A`, floor, regularA))
    patterns.push(makePattern(`${prefix}_F${floor}_B`, floor, regularB))
    patterns.push(makePattern(`${prefix}_F${floor}_C`, floor, regularC))
    patterns.push(makePattern(`${prefix}_F${floor}_BOSS`, floor, regularB, { isFloorBoss: true }))
  }
  const finalFloor = stages.length
  patterns.push(makePattern(`${prefix}_FINAL_BOSS`, finalFloor, [[boss], bossSupport], { isBoss: true }))
  return patterns
}

function addExtraBoss(enemies, extraBoss) {
  if (!extraBoss || enemies.some(enemy => enemy.id === extraBoss.id)) return enemies
  const source = enemies.find(enemy => enemy.id === extraBoss.source)
  if (!source) throw new Error(`${extraBoss.source} が見つかりません`)
  enemies.push({
    ...source,
    id: extraBoss.id,
    name: extraBoss.name,
    isBoss: true,
  })
  return enemies
}

function main() {
  const areaList = loadJson(ALL_AREA_PATH)
  for (const [areaId, config] of Object.entries(SPEC)) {
    const areaPath = path.join(AREA_DIR, `${areaId}.json`)
    const enemyPath = path.join(ENEMY_DIR, `${areaId}.json`)
    const area = loadJson(areaPath)
    const database = loadJson(enemyPath)

    area.areaLevel = config.areaLevel
    database.enemies = addExtraBoss(database.enemies, config.extraBoss)
    database.enemies = database.enemies.map(enemy => {
      const level = config.levels[enemy.id]
      const boost = enemy.isBoss ? (config.bossStatBoost ?? config.statBoost ?? 1) : (config.statBoost ?? 1)
      return level ? buildStats(enemy, level, boost) : enemy
    })
    database.patterns = buildPatterns(areaId, config)

    saveJson(areaPath, area)
    saveJson(enemyPath, database)

    const listed = areaList.areas.find(entry => entry.id === areaId)
    if (listed) listed.areaLevel = config.areaLevel
    console.log(`[updated] ${areaId} areaLevel=${config.areaLevel} patterns=${database.patterns.length}`)
  }
  saveJson(ALL_AREA_PATH, areaList)
}

main()
