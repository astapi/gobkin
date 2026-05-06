#!/usr/bin/env node

/**
 * バランスシナリオのPTを構築して、各キャラの実効ステータスを表示する。
 * デバッグ用: なぜLv2で勝てるのかを調べるためのインスペクタ。
 *
 * 使い方:
 *   node scripts/inspect-balance-party.js --scenario goblin_village_3 --loadout A_optimal --level 2
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
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === '@react-native-async-storage/async-storage') {
    return { getItem: async () => null, setItem: async () => undefined }
  }
  if (request === 'expo-localization') return { getLocales: () => [{ languageCode: 'ja' }] }
  return originalLoad.call(this, request, parent, isMain)
}

const originalResolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    return originalResolveFilename.call(this, path.join(srcRoot, request.slice(2)), parent, isMain, options)
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

require.extensions['.ts'] = function (module, filename) {
  const source = fs.readFileSync(filename, 'utf8')
  const out = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
    fileName: filename,
  }).outputText
  module._compile(out, filename)
}

const orig = console.log
console.log = () => undefined
console.warn = () => undefined
console.info = () => undefined

const { GoblinBirthService } = require('../src/core/services/GoblinBirthService')
const { EquipmentService } = require('../src/core/services/EquipmentService')
const { GoblinStatCalculator } = require('../src/core/services/GoblinStatCalculator')
const { applyGoblinJob } = require('../src/shared/data/goblinJobs')
const { applySkillBonusesToEquipmentBonuses } = require('../src/shared/data/characterSkills')
const { getGoblinVariantByFactorId } = require('../src/shared/data/goblinVariants')
const { getCharacterSkill } = require('../src/shared/data/skillCatalog')
const { getLegacyRaceName } = require('../src/shared/types/Race')

console.log = orig
console.warn = orig
console.info = orig

function applyVariant(goblin, variantFactorId) {
  if (!variantFactorId) return goblin
  const def = getGoblinVariantByFactorId(variantFactorId)
  if (!def) return goblin
  const extraSkills = (def.defaultSkillIds || []).map((id) => getCharacterSkill(id))
  return {
    ...goblin,
    raceId: def.raceId,
    race: getLegacyRaceName(def.raceId),
    variantFactorId: def.factorId,
    factors: [def.factorId],
    skills: [...(goblin.skills || []), ...extraSkills],
    baseAttributes: def.baseAttributes ?? goblin.baseAttributes,
    effectiveStats: undefined,
  }
}

function createGoblin(id, name, level, job, variantFactorId) {
  const birth = new GoblinBirthService(() => 0)
  const born = birth.createNewGoblin(id, 1)
  let g = { ...born, id, name, level, experience: 0, effectiveStats: undefined, factors: [], skills: born.skills ?? [] }
  g = applyVariant(g, variantFactorId)
  g = applyGoblinJob(g, job || undefined)
  return { ...g, effectiveStats: undefined }
}

function applyEquipmentFlatBonuses(stats, bonuses) {
  const next = { ...stats }
  for (const b of bonuses) {
    if (b.stat === 'hp_flat') next.hp += b.value
    else if (b.stat === 'atk_flat') next.atk += b.value
    else if (b.stat === 'def_flat') next.def += b.value
    else if (b.stat === 'magic_atk_flat') next.magicAtk += b.value
    else if (b.stat === 'magic_def_flat') next.magicDef += b.value
    else if (b.stat === 'attackCount_flat') next.attackCount += b.value
    else if (b.stat === 'accuracy_flat') next.accuracy += b.value
    else if (b.stat === 'evasion_flat') next.evasion += b.value
    else if (b.stat === 'magicHeal_flat') next.magicHeal += b.value
    else if (b.stat === 'critical_rate_percent') next.criticalRate += b.value
  }
  return next
}

function applyEquipment(goblin, ids) {
  const slots = Math.min(EquipmentService.getAvailableSlots(goblin), ids.length)
  const items = Array.from({ length: slots }, (_, i) => ({
    id: `inspect_${goblin.id}_${i}`, templateId: ids[i], slotIndex: i, goblinId: goblin.id,
  }))
  const eqBonus = applySkillBonusesToEquipmentBonuses(goblin.skills, EquipmentService.calculateEquipmentBonuses(items))
  const eqSkills = EquipmentService.collectGrantedSkills(items)
  const stats = applyEquipmentFlatBonuses(goblin.stats, eqBonus)
  return { ...goblin, stats, baseAttributes: undefined, effectiveStats: undefined, skills: [...(goblin.skills || []), ...eqSkills] }
}

function summarizeSkills(skills) {
  return skills.map(s => s.id).join(', ')
}

function main() {
  const args = process.argv.slice(2)
  let scenarioId = 'goblin_village_3'
  let loadoutName = 'A_optimal'
  let level = 2
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--scenario') scenarioId = args[++i]
    else if (args[i] === '--loadout') loadoutName = args[++i]
    else if (args[i] === '--level') level = Number(args[++i])
  }

  const scenarioPath = path.join(projectRoot, 'scripts', 'balance', 'scenarios', `${scenarioId}.json`)
  const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'))
  const loadout = scenario.loadouts.find(l => l.name === loadoutName)
  if (!loadout) throw new Error(`loadout not found: ${loadoutName}`)

  console.log(`# ${scenarioId} / ${loadoutName} / Lv${level}\n`)

  for (let i = 0; i < loadout.party.length; i++) {
    const m = loadout.party[i]
    let g = createGoblin(i, m.name, level, m.job, m.variantFactorId)
    g = applyEquipment(g, m.equipmentTemplateIds || [])
    const slots = EquipmentService.getAvailableSlots(g)
    const equipped = (m.equipmentTemplateIds || []).slice(0, Math.min(slots, m.equipmentTemplateIds.length))
    const effective = GoblinStatCalculator.calculate(g)
    const skillIds = g.skills.map(s => s.id).filter(id => id)
    console.log(`列${i + 1} ${m.name} variant=${m.variantFactorId ?? '通常'} 装備枠=${slots} 装備=[${equipped.join(', ')}]`)
    console.log(`  effective: hp=${effective.hp} atk=${effective.atk} def=${effective.def} accuracy=${effective.accuracy} attackCount=${effective.attackCount} evasion=${effective.evasion}`)
    console.log(`  skills(${skillIds.length}): ${skillIds.join(', ')}`)
    console.log()
  }
}

main()
