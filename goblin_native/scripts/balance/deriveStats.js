// 各敵の Lv・baseAttributes から HP/ATK/DEF/EVA を「算出式×標準倍率」で導出して表示。
// 標準倍率は road_1(街道)通常敵の実効中央値。ボスは別倍率。
// accuracy/magicDef/magicAtk/magicHeal/attackCount は式外なので現状維持。
// 実行: node scripts/balance/deriveStats.js orc_camp_1 human_village
require('./headless/runtime')
const {
  calculateEnemyBaseHpFromInputs,
  calculateEnemyBaseAtkFromInputs,
  calculateEnemyBaseDefFromInputs,
  calculateEnemyBaseEvasionFromInputs,
  detectEnemyHpSpecies,
} = require('@/shared/utils/enemyStats')
const base = require('path').resolve(__dirname, '../../src/shared/data/enemy')

const MULT = {
  normal: { hp: 1.6, atk: 1.6, def: 1.25, eva: 0.57 },
  boss: { hp: 1.3, atk: 1.0, def: 1.0, eva: 0.4 },
}
const r10 = v => Math.round(v / 10) * 10 // HPは10刻み
const r = v => Math.round(v)

for (const area of process.argv.slice(2)) {
  const d = require(`${base}/${area}.json`)
  console.log(`\n■ ${area}`)
  for (const e of d.enemies) {
    const sp = detectEnemyHpSpecies(e.raceTags)
    const a = e.baseAttributes
    const m = e.isBoss ? MULT.boss : MULT.normal
    const hp = r10(calculateEnemyBaseHpFromInputs(e.level, a.vitality, sp) * m.hp)
    const atk = r(calculateEnemyBaseAtkFromInputs(e.level, a.power, sp) * m.atk)
    const def = r(calculateEnemyBaseDefFromInputs(e.level, a.vitality, sp) * m.def)
    const eva = r(calculateEnemyBaseEvasionFromInputs(e.level, a.agility, a.luck, sp) * m.eva)
    console.log(`  ${e.id.padEnd(12)}${e.isBoss ? 'B' : ' '} Lv${e.level} vit${a.vitality} pow${a.power} agi${a.agility}/luck${a.luck}`)
    console.log(`      hp ${String(e.hp).padStart(4)}->${String(hp).padStart(4)}  atk ${String(e.atk).padStart(3)}->${String(atk).padStart(3)}  def ${String(e.def).padStart(3)}->${String(def).padStart(3)}  eva ${String(e.evasion).padStart(2)}->${String(eva).padStart(2)}`)
  }
}
