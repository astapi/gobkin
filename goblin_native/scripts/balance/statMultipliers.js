// 既存データの「実値 / 算出式出力」比を測り、各ステータスの実効倍率(中央値)を出す。
// この倍率を「算出式×倍率」の標準係数として採用する。
// 実行: node scripts/balance/statMultipliers.js road_1 bandit_hideout undead_ruins_1 old_well_waterway
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

const median = arr => { const s = [...arr].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

function ratios(e) {
  const sp = detectEnemyHpSpecies(e.raceTags)
  const a = e.baseAttributes
  const c = {
    hp: calculateEnemyBaseHpFromInputs(e.level, a.vitality, sp),
    atk: calculateEnemyBaseAtkFromInputs(e.level, a.power, sp),
    def: calculateEnemyBaseDefFromInputs(e.level, a.vitality, sp),
    eva: calculateEnemyBaseEvasionFromInputs(e.level, a.agility, a.luck, sp),
    acc: calculateEnemyBaseAccuracyFromInputs(e.level, a.power, a.agility, sp),
  }
  return {
    hp: e.hp / c.hp, atk: e.atk / c.atk, def: e.def / c.def,
    eva: e.evasion / c.eva, acc: e.accuracy / c.acc, isBoss: !!e.isBoss,
  }
}

const norm = { hp: [], atk: [], def: [], eva: [], acc: [] }
const boss = { hp: [], atk: [], def: [], eva: [], acc: [] }
for (const area of process.argv.slice(2)) {
  const d = require(`${base}/${area}.json`)
  for (const e of d.enemies) {
    const r = ratios(e)
    const bucket = r.isBoss ? boss : norm
    for (const k of ['hp', 'atk', 'def', 'eva', 'acc']) if (isFinite(r[k]) && r[k] > 0) bucket[k].push(r[k])
  }
}
const show = (label, b) => {
  console.log(`\n[${label}] (n=${b.hp.length})`)
  for (const k of ['hp', 'atk', 'def', 'eva', 'acc'])
    console.log(`  ${k}: median x${median(b[k]).toFixed(2)}  (min ${Math.min(...b[k]).toFixed(2)} / max ${Math.max(...b[k]).toFixed(2)})`)
}
show('通常敵', norm)
show('ボス', boss)
