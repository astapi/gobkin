#!/usr/bin/env node

/**
 * 全敵の回避を味方と共通の算出式へ統一し、忘れられた廃墟以降の一部エリアへ
 * HP/ATK下限を適用する。再実行しても二重強化されない。
 *
 * 実行:
 *   node scripts/balance/retune-post-ruins-combat.js          # 差分確認
 *   node scripts/balance/retune-post-ruins-combat.js --write  # JSON更新
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
const AREA_LIST_PATH = path.join(ROOT, 'src/shared/data/expeditionArea/allArea.json')
const ENEMY_DIR = path.join(ROOT, 'src/shared/data/enemy')
const WRITE = process.argv.includes('--write')
const POST_RUINS_START_AREA_ID = 'undead_ruins_1'
const STANDARD_HP_MULTIPLIER = 1
const POST_RUINS_BOSS_HP_MULTIPLIER = 1.6

// 算出式に対する最低倍率。既存値が上なら維持する。
const COMBAT_FLOORS = {
  orc_camp_1: { atk: 1.7, bossAtk: 1.1 },
  human_village: { atk: 1.7, bossAtk: 1.1 },
  wolf_grassland_1: {},
  // 適正戦力(Lv65)で最終ボス戦8〜20ターンを狙う耐久倍率。
  orc_fortress_1: { bossHp: 6.0 },
  // 適正戦力(Lv80)で最終ボス戦8〜20ターンを狙う耐久倍率。
  subjugation_force_1: { bossHp: 5.0, atk: 3.0, bossAtk: 3.0 },
}

const round10 = value => Math.round(value / 10) * 10

function applyFloors(enemy, floors, isPostRuins) {
  const species = detectEnemyHpSpecies(enemy.raceTags ?? [])
  const attrs = enemy.baseAttributes
  const isBoss = enemy.isBoss === true
  const baseHp = calculateEnemyBaseHpFromInputs(enemy.level, attrs.vitality, species)
  const baseAtk = calculateEnemyBaseAtkFromInputs(enemy.level, attrs.power, species)
  const baseDef = calculateEnemyBaseDefFromInputs(enemy.level, attrs.vitality, species)
  const baseEvasion = calculateEnemyBaseEvasionFromInputs(
    enemy.level,
    attrs.agility,
    attrs.luck,
    species,
  )
  const standardHpMultiplier = isPostRuins
    ? (isBoss ? POST_RUINS_BOSS_HP_MULTIPLIER : STANDARD_HP_MULTIPLIER)
    : undefined
  const configuredHpMultiplier = isBoss ? floors?.bossHp : floors?.hp
  const hpMultiplier = Math.max(standardHpMultiplier ?? 0, configuredHpMultiplier ?? 0)
  const atkMultiplier = isBoss ? floors?.bossAtk : floors?.atk
  const defMultiplier = isBoss ? floors?.bossDef : floors?.def
  const nextHp = hpMultiplier ? Math.max(enemy.hp, round10(baseHp * hpMultiplier)) : enemy.hp
  const nextAtk = atkMultiplier ? Math.max(enemy.atk, Math.round(baseAtk * atkMultiplier)) : enemy.atk
  const nextDef = defMultiplier ? Math.max(enemy.def, Math.round(baseDef * defMultiplier)) : enemy.def
  const attackScale = enemy.atk > 0 ? nextAtk / enemy.atk : 1

  return {
    ...enemy,
    hp: nextHp,
    atk: nextAtk,
    ...(enemy.magicAtk !== undefined
      ? { magicAtk: Math.max(enemy.magicAtk, Math.round(enemy.magicAtk * attackScale)) }
      : {}),
    def: nextDef,
    evasion: baseEvasion,
  }
}

const areaList = JSON.parse(fs.readFileSync(AREA_LIST_PATH, 'utf8'))
const areaIds = areaList.areas.map(area => area.id)
const postRuinsStartIndex = areaIds.indexOf(POST_RUINS_START_AREA_ID)

if (postRuinsStartIndex < 0) {
  throw new Error(`${POST_RUINS_START_AREA_ID} was not found in allArea.json`)
}

let changedEnemies = 0
for (const [areaIndex, areaId] of areaIds.entries()) {
  const filePath = path.join(ENEMY_DIR, `${areaId}.json`)
  if (!fs.existsSync(filePath)) continue
  const database = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const floors = COMBAT_FLOORS[areaId]
  const isPostRuins = areaIndex >= postRuinsStartIndex
  const nextEnemies = database.enemies.map(enemy => applyFloors(enemy, floors, isPostRuins))
  const changed = nextEnemies.filter((enemy, index) =>
    JSON.stringify(enemy) !== JSON.stringify(database.enemies[index]),
  ).length
  if (changed === 0) continue
  changedEnemies += changed
  console.log(`${areaId}: ${changed} enemies`)
  if (WRITE) {
    fs.writeFileSync(filePath, `${JSON.stringify({ ...database, enemies: nextEnemies }, null, 2)}\n`)
  }
}

console.log(`${WRITE ? 'updated' : 'would update'}: ${changedEnemies} enemies`)
