#!/usr/bin/env node

/**
 * シナリオの各 loadout でN回戦闘を実行し、戦闘ごとの被ダメージ詳細を表示する。
 *
 * 使い方:
 *   node scripts/inspect-battle-damage.js --scenario subjugation_force_1 --level 25 --iterations 50
 */

const fs = require('fs')
const path = require('path')
const Module = require('module')
const ts = require('typescript')

const projectRoot = path.resolve(__dirname, '..')
const srcRoot = path.join(projectRoot, 'src')

global.__DEV__ = false
process.env.NODE_ENV = process.env.NODE_ENV || 'test'

const originalLoad = Module._load
Module._load = function(req, p, m) {
  if (req === '@react-native-async-storage/async-storage') return { getItem: async()=>null, setItem: async()=>undefined }
  if (req === 'expo-localization') return { getLocales: ()=>[{languageCode:'ja'}] }
  return originalLoad.call(this, req, p, m)
}

const orig_resolve = Module._resolveFilename
Module._resolveFilename = function(req, p, m, o) {
  if (req.startsWith('@/')) return orig_resolve.call(this, path.join(srcRoot, req.slice(2)), p, m, o)
  return orig_resolve.call(this, req, p, m, o)
}

require.extensions['.ts'] = function(m, f) {
  m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, resolveJsonModule: true },
    fileName: f,
  }).outputText, f)
}

const c = console.log; console.log = ()=>{}; console.warn = ()=>{}; console.info = ()=>{}
const { ExpeditionEngine } = require('../src/core/services/ExpeditionEngine')
const { GoblinBirthService } = require('../src/core/services/GoblinBirthService')
const { EquipmentService } = require('../src/core/services/EquipmentService')
const { applyGoblinJob } = require('../src/shared/data/goblinJobs')
const { applySkillBonusesToEquipmentBonuses } = require('../src/shared/data/characterSkills')
const { getGoblinVariantByFactorId } = require('../src/shared/data/goblinVariants')
const { getCharacterSkill } = require('../src/shared/data/skillCatalog')
const { getLegacyRaceName } = require('../src/shared/types/Race')
console.log = c; console.warn = c; console.info = c

function applyVariant(g, vid) {
  if (!vid) return g
  const d = getGoblinVariantByFactorId(vid); if (!d) return g
  return { ...g, raceId: d.raceId, race: getLegacyRaceName(d.raceId), variantFactorId: d.factorId, factors: [d.factorId], skills: [...(g.skills||[]), ...(d.defaultSkillIds||[]).map(getCharacterSkill)], baseAttributes: d.baseAttributes ?? g.baseAttributes, effectiveStats: undefined }
}

function createGoblin(id, name, level, job, vid) {
  const b = new GoblinBirthService(()=>0); const born = b.createNewGoblin(id, 1)
  let g = { ...born, id, name, level, experience: 0, mods: [], factors: [], skills: born.skills??[] }
  g = applyVariant(g, vid)
  g = applyGoblinJob(g, job || undefined)
  return { ...g, effectiveStats: undefined, mods: [] }
}

function applyEquipBonuses(stats, bonuses) {
  const n = { ...stats }
  for (const b of bonuses) {
    const m = { hp_flat:'hp', atk_flat:'atk', def_flat:'def', magic_atk_flat:'magicAtk', magic_def_flat:'magicDef', attackCount_flat:'attackCount', accuracy_flat:'accuracy', evasion_flat:'evasion', magicHeal_flat:'magicHeal', critical_rate_percent:'criticalRate' }
    if (m[b.stat]) n[m[b.stat]] += b.value
  }
  return n
}

function applyEquipment(g, ids) {
  const slots = Math.min(EquipmentService.getAvailableSlots(g), ids.length)
  const items = Array.from({ length: slots }, (_, i) => ({ id: `inspect_${g.id}_${i}`, templateId: ids[i], slotIndex: i, goblinId: g.id }))
  const eqB = applySkillBonusesToEquipmentBonuses(g.skills, EquipmentService.calculateEquipmentBonuses(items))
  const eqS = EquipmentService.collectGrantedSkills(items)
  return { ...g, stats: applyEquipBonuses(g.stats, eqB), baseAttributes: undefined, effectiveStats: undefined, skills: [...(g.skills||[]), ...eqS] }
}

function buildParty(loadout, level) {
  return loadout.party.map((m, i) => applyEquipment(createGoblin(i, m.name, level, m.job, m.variantFactorId), m.equipmentTemplateIds || []))
}

async function runOnce(areaId, party, seed) {
  const engine = new ExpeditionEngine(seed)
  return engine.generateExpedition({ partyId: 'inspect', areaId, returnPolicy: 'never', clientVersion: 'inspect' }, party.map(g => ({ ...g, currentHp: undefined })))
}

function summarize(replay, partySize) {
  const dmg = Array(partySize).fill(0)
  let battles = 0; let rounds = 0
  let success = replay.summary?.success === true
  for (const e of replay.events ?? []) {
    if (e.type !== 'battle' && e.type !== 'boss') continue
    battles++
    rounds += e.combat?.rounds ?? 0
    const delta = e.combat?.allyHPDelta ?? []
    for (let i = 0; i < partySize; i++) {
      if (delta[i] < 0) dmg[i] += -delta[i]
    }
  }
  return { success, battles, rounds, dmg }
}

async function main() {
  const args = process.argv.slice(2)
  let scenarioId = 'subjugation_force_1'; let level = 25; let iterations = 30
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--scenario') scenarioId = args[++i]
    else if (args[i] === '--level') level = Number(args[++i])
    else if (args[i] === '--iterations') iterations = Number(args[++i])
  }
  const scenarioPath = path.join(projectRoot, 'scripts', 'balance', 'scenarios', `${scenarioId}.json`)
  const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'))

  console.log(`# ${scenarioId} / Lv${level} / iter=${iterations}`)
  console.log()
  console.log('  Loadout              wins  avgRounds  totalDmg/run  tank_dmg(列1)  others_dmg')

  const origLog = console.log
  for (const lo of scenario.loadouts) {
    if (lo.name === 'C_misformation') continue
    const party = buildParty(lo, level)
    const partySize = party.length
    let wins = 0, totalRounds = 0, totalBattles = 0
    const totalDmg = Array(partySize).fill(0)
    for (let i = 0; i < iterations; i++) {
      console.log = () => {}; console.warn = () => {}; console.info = () => {}
      const replay = await runOnce(scenario.areaId, party, (1 + i * 7919) | 0)
      console.log = origLog; console.warn = origLog; console.info = origLog
      const s = summarize(replay, partySize)
      if (s.success) wins++
      totalRounds += s.rounds; totalBattles += s.battles
      for (let j = 0; j < partySize; j++) totalDmg[j] += s.dmg[j]
    }
    const avgRounds = totalBattles > 0 ? (totalRounds/totalBattles).toFixed(2) : '-'
    const totalAll = totalDmg.reduce((a,b) => a+b, 0)
    const dmgPerRun = (totalAll/iterations).toFixed(0)
    const tankDmg = (totalDmg[0]/iterations).toFixed(0)
    const otherDmg = (totalDmg.slice(1).reduce((a,b)=>a+b, 0)/iterations).toFixed(0)
    console.log(`  ${lo.name.padEnd(20)} ${wins}/${iterations}    ${avgRounds.padStart(5)}    ${dmgPerRun.padStart(6)}        ${tankDmg.padStart(6)}        ${otherDmg.padStart(6)}`)
  }
}

main().catch(e => { console.error(e); process.exitCode = 1 })
