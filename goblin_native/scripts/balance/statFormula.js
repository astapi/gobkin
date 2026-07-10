// 敵JSONの各敵について、算出式(enemyStats.ts)の出力 vs 現在の手打ち値を比較表示。
// HP/ATK/DEF/EVA/ACC は Lv+能力値から算出可能。magicDef/magicAtk/magicHeal/attackCount は式外(手動)。
// 実行: node scripts/balance/statFormula.js orc_camp_1 human_village
require('./headless/runtime')
const {
  calculateEnemyBaseHpFromInputs,
  calculateEnemyBaseAtkFromInputs,
  calculateEnemyBaseDefFromInputs,
  calculateEnemyBaseEvasionFromInputs,
  calculateEnemyBaseAccuracyFromInputs,
  detectEnemyHpSpecies,
} = require('@/shared/utils/enemyStats')

const base = require('path').resolve(__dirname, '../../src/shared/data/enemy')

function calc(e) {
  const sp = detectEnemyHpSpecies(e.raceTags)
  const a = e.baseAttributes
  return {
    species: sp,
    hp: calculateEnemyBaseHpFromInputs(e.level, a.vitality, sp),
    atk: calculateEnemyBaseAtkFromInputs(e.level, a.power, sp),
    def: calculateEnemyBaseDefFromInputs(e.level, a.vitality, sp),
    eva: calculateEnemyBaseEvasionFromInputs(e.level, a.agility, a.luck, sp),
    acc: calculateEnemyBaseAccuracyFromInputs(e.level, a.power, a.agility, sp),
  }
}

for (const area of process.argv.slice(2)) {
  const d = require(`${base}/${area}.json`)
  console.log(`\n■ ${area}`)
  console.log('  id           sp     Lv  vit pow agi luck | HP now/calc    ATK now/calc  DEF now/calc  EVA now/calc  ACC now/calc')
  for (const e of d.enemies) {
    const c = calc(e)
    const a = e.baseAttributes
    const pair = (now, cal) => `${String(now).padStart(4)}/${String(cal).padStart(4)}`
    console.log(`  ${e.id.padEnd(12)} ${c.species.padEnd(6)} ${String(e.level).padStart(2)}  ${String(a.vitality).padStart(3)} ${String(a.power).padStart(3)} ${String(a.agility).padStart(3)} ${String(a.luck).padStart(4)} | ${pair(e.hp,c.hp)}  ${pair(e.atk,c.atk)}  ${pair(e.def,c.def)}  ${pair(e.evasion,c.eva)}  ${pair(e.accuracy,c.acc)}`)
  }
}
