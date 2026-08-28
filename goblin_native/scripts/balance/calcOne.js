// 単体の (Lv,vit,pow,agi,luck,species,boss?) から算出式×標準倍率で HP/ATK/DEF/EVA を出す。
// 標準倍率: 通常 HP1.6/ATK1.6/DEF1.25/EVA0.57、ボス HP1.3/ATK1.0/DEF1.0/EVA0.4
// 実行: node scripts/balance/calcOne.js "name Lv vit pow agi luck species boss?" ...
//   例: node scripts/balance/calcOne.js "wolf 30 13 30 26 12 beast" "alpha 40 20 50 32 13 beast boss"
require('./headless/runtime')
const S = require('@/shared/utils/enemyStats')
const M = { normal: { hp: 1.0, atk: 1.6, def: 1.25, eva: 1.0 }, boss: { hp: 1.6, atk: 1.0, def: 1.0, eva: 1.0 } }
const r10 = v => Math.round(v / 10) * 10, r = v => Math.round(v)
console.log('name          Lv  sp     | HP   ATK  DEF  EVA')
for (const spec of process.argv.slice(2)) {
  const [name, lv, vit, pow, agi, luck, sp, boss] = spec.split(/\s+/)
  const L = +lv, m = boss === 'boss' ? M.boss : M.normal
  const hp = r10(S.calculateEnemyBaseHpFromInputs(L, +vit, sp) * m.hp)
  const atk = r(S.calculateEnemyBaseAtkFromInputs(L, +pow, sp) * m.atk)
  const def = r(S.calculateEnemyBaseDefFromInputs(L, +vit, sp) * m.def)
  const eva = r(S.calculateEnemyBaseEvasionFromInputs(L, +agi, +luck, sp) * m.eva)
  console.log(`${name.padEnd(13)} ${String(L).padStart(2)}  ${sp.padEnd(6)}${boss === 'boss' ? 'B' : ' '}| ${String(hp).padStart(4)} ${String(atk).padStart(4)} ${String(def).padStart(4)} ${String(eva).padStart(4)}`)
}
