#!/usr/bin/env node

/**
 * 既存シナリオに F_with_cleric, G_jobs_only, H_no_mage の3つの新パターンを追加。
 * 各シナリオの装備ランクに応じて装備プールを切り替える。
 */

const fs = require('node:fs')
const path = require('node:path')

const SCENARIOS = [
  { id: 'orc_camp_1', rank: 2 },
  { id: 'wolf_grassland_1', rank: 3 },
  { id: 'subjugation_force_1', rank: 4 },
]

// rank tier ごとの装備リスト（role別・優先順）。
// Lv25-30 で 8-9 slots を埋める前提で 8-10 個ずつ並べる。
const EQ = {
  // ============ guard (1列, melee tank) ============
  guard: {
    2: [
      'armor_armor',          // physical_reduction_6
      'armor_fur_vest',       // physical_reduction_3
      'armor_leather_vest',   // physical_reduction_2
      'armor_tattered_cloth', // physical_reduction_1
      'shield_shield',        // evasion_up_20, breath_reduction_6
      'sword_long',           // def_to_hp_3
      'gauntlet_gauntlet',    // attack_count_up_4
      'shield_wooden',
    ],
    3: [
      'armor_mithril',        // physical_reduction_7
      'armor_armor',
      'armor_fur_vest',
      'armor_leather_vest',
      'armor_tattered_cloth',
      'shield_mithril',       // evasion_up_30, breath_reduction_7
      'sword_mithril',        // def_to_hp_4
      'gauntlet_mithril',     // attack_count_up_5
      'shield_shield',
    ],
    4: [
      'armor_royal',          // physical_reduction_8
      'armor_mithril',
      'armor_armor',
      'armor_fur_vest',
      'armor_leather_vest',
      'armor_tattered_cloth',
      'shield_royal',         // evasion_up_40, breath_reduction_8
      'sword_royal',          // def_to_hp_5
      'gauntlet_royal',       // attack_count_up_6
      'shield_mithril',
    ],
  },
  // ============ warrior (2列, melee 前衛, inspire後列+50%) ============
  warrior: {
    2: [
      'sword_long',
      'armor_armor',
      'armor_fur_vest',
      'shield_shield',
      'armor_leather_vest',
      'sword_broad',
      'gauntlet_gauntlet',
      'armor_tattered_cloth',
    ],
    3: [
      'sword_mithril',
      'armor_mithril',
      'armor_armor',
      'shield_mithril',
      'armor_fur_vest',
      'armor_leather_vest',
      'sword_long',
      'gauntlet_mithril',
      'armor_tattered_cloth',
    ],
    4: [
      'sword_royal',
      'armor_royal',
      'armor_mithril',
      'shield_royal',
      'armor_armor',
      'armor_fur_vest',
      'sword_mithril',
      'gauntlet_royal',
      'armor_leather_vest',
      'armor_tattered_cloth',
    ],
  },
  // ============ thief (range, bow + gauntlet + armor) ============
  thief: {
    2: [
      'bow_long',             // critical_damage_bonus_6
      'gauntlet_gauntlet',
      'gauntlet_copper',
      'gauntlet_leather',
      'gauntlet_cloth_gloves',
      'armor_armor',
      'armor_fur_vest',
      'armor_leather_vest',
    ],
    3: [
      'bow_mithril',          // critical_damage_bonus_7
      'gauntlet_mithril',
      'gauntlet_gauntlet',
      'gauntlet_copper',
      'gauntlet_leather',
      'armor_mithril',
      'armor_armor',
      'armor_fur_vest',
      'armor_leather_vest',
    ],
    4: [
      'bow_royal',            // critical_damage_bonus_8
      'gauntlet_royal',
      'gauntlet_mithril',
      'gauntlet_gauntlet',
      'gauntlet_copper',
      'armor_royal',
      'armor_mithril',
      'armor_armor',
      'armor_fur_vest',
      'armor_leather_vest',
    ],
  },
  // ============ mage (range magic, wand + armor) ============
  mage: {
    2: [
      'wand_wand',            // spell_damage_10
      'armor_armor',
      'armor_fur_vest',
      'shield_shield',
      'armor_leather_vest',
      'wand_apprentice',
      'gauntlet_gauntlet',
      'armor_tattered_cloth',
    ],
    3: [
      'wand_mithril',         // spell_damage_11
      'armor_mithril',
      'armor_armor',
      'shield_mithril',
      'armor_fur_vest',
      'wand_wand',
      'armor_leather_vest',
      'gauntlet_mithril',
      'armor_tattered_cloth',
    ],
    4: [
      'wand_royal',           // spell_damage_12
      'armor_royal',
      'armor_mithril',
      'shield_royal',
      'armor_armor',
      'wand_mithril',
      'wand_wand',
      'armor_fur_vest',
      'armor_leather_vest',
      'gauntlet_royal',
    ],
  },
  // ============ cleric (rod + armor + shield) ============
  cleric: {
    2: [
      'rod_rod',              // magic_heal_to_hp_6
      'armor_armor',
      'armor_fur_vest',
      'shield_shield',
      'armor_leather_vest',
      'rod_wooden',
      'gauntlet_gauntlet',
      'armor_tattered_cloth',
    ],
    3: [
      'rod_mithril',          // magic_heal_to_hp_7
      'armor_mithril',
      'armor_armor',
      'shield_mithril',
      'armor_fur_vest',
      'rod_rod',
      'armor_leather_vest',
      'gauntlet_mithril',
      'armor_tattered_cloth',
    ],
    4: [
      'rod_royal',            // magic_heal_to_hp_8
      'rod_mithril',
      'armor_royal',
      'armor_mithril',
      'shield_royal',
      'armor_armor',
      'armor_fur_vest',
      'armor_leather_vest',
      'gauntlet_royal',
      'armor_tattered_cloth',
    ],
  },
}

// 既存A_optimalから variants(slime/hobgoblin/wolf) の equipment を流用する
function getVariantEquipment(scenarioData, variantFactorId) {
  const a = scenarioData.loadouts.find((l) => l.name === 'A_optimal')
  if (!a) return null
  const member = a.party.find((m) => m.variantFactorId === variantFactorId)
  return member ? member.equipmentTemplateIds : null
}

function buildLoadouts(scenarioData, rank) {
  const slimeEq = getVariantEquipment(scenarioData, 'slime')
  const hobgoblinEq = getVariantEquipment(scenarioData, 'hobgoblin')
  const wolfEq = getVariantEquipment(scenarioData, 'wolf')

  const F_with_cleric = {
    name: 'F_with_cleric',
    description:
      '亜種3体(slime/hobgoblin/wolf)+通常thief×2+通常cleric。' +
      'スライムのhp_regen_20は自分しか回復しないので、PT全体回復にcleric(recovery_magic_lv7)を入れる。',
    party: [
      { name: 'スライム盾', variantFactorId: 'slime', equipmentTemplateIds: slimeEq },
      { name: 'ホブゴブリン前衛', variantFactorId: 'hobgoblin', equipmentTemplateIds: hobgoblinEq },
      { name: 'ウルフ弓', variantFactorId: 'wolf', equipmentTemplateIds: wolfEq },
      { name: '通常シーフ1', job: 'thief', equipmentTemplateIds: EQ.thief[rank] },
      { name: '通常シーフ2', job: 'thief', equipmentTemplateIds: EQ.thief[rank] },
      { name: '通常クレリック', job: 'cleric', equipmentTemplateIds: EQ.cleric[rank] },
    ],
  }

  const G_jobs_only = {
    name: 'G_jobs_only',
    description:
      '亜種なし、ジョブのみのバランス構成: ガード/ウォリアー/シーフ×2/メイジ/クレリック。' +
      'ウォリアーは2列目で後列火力+50%(inspire)。亜種シナジー無しの「素のジョブPT」性能を測定。',
    party: [
      { name: 'ゴブリンガード', job: 'guard', equipmentTemplateIds: EQ.guard[rank] },
      { name: 'ゴブリンウォリアー', job: 'warrior', equipmentTemplateIds: EQ.warrior[rank] },
      { name: 'ゴブリンシーフ1', job: 'thief', equipmentTemplateIds: EQ.thief[rank] },
      { name: 'ゴブリンシーフ2', job: 'thief', equipmentTemplateIds: EQ.thief[rank] },
      { name: 'ゴブリンメイジ', job: 'mage', equipmentTemplateIds: EQ.mage[rank] },
      { name: 'ゴブリンクレリック', job: 'cleric', equipmentTemplateIds: EQ.cleric[rank] },
    ],
  }

  const H_no_mage = {
    name: 'H_no_mage',
    description:
      '亜種なし、メイジ無し: ガード/ウォリアー/シーフ×3/クレリック。' +
      '物理火力(range)に振り切った構成。魔法ダメージ無しで物理だけで殴る。',
    party: [
      { name: 'ゴブリンガード', job: 'guard', equipmentTemplateIds: EQ.guard[rank] },
      { name: 'ゴブリンウォリアー', job: 'warrior', equipmentTemplateIds: EQ.warrior[rank] },
      { name: 'ゴブリンシーフ1', job: 'thief', equipmentTemplateIds: EQ.thief[rank] },
      { name: 'ゴブリンシーフ2', job: 'thief', equipmentTemplateIds: EQ.thief[rank] },
      { name: 'ゴブリンシーフ3', job: 'thief', equipmentTemplateIds: EQ.thief[rank] },
      { name: 'ゴブリンクレリック', job: 'cleric', equipmentTemplateIds: EQ.cleric[rank] },
    ],
  }

  return [F_with_cleric, G_jobs_only, H_no_mage]
}

function main() {
  const scenariosDir = path.join(__dirname, 'scenarios')
  for (const { id, rank } of SCENARIOS) {
    const filePath = path.join(scenariosDir, `${id}.json`)
    const raw = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(raw)

    // 既に追加済みなら skip
    const existing = new Set(data.loadouts.map((l) => l.name))
    const newLoadouts = buildLoadouts(data, rank).filter((l) => !existing.has(l.name))
    if (newLoadouts.length === 0) {
      console.log(`[${id}] all 3 patterns already exist, skipping`)
      continue
    }

    const eIdx = data.loadouts.findIndex((l) => l.name === 'E_brute_force')
    const insertAt = eIdx >= 0 ? eIdx : data.loadouts.length
    data.loadouts.splice(insertAt, 0, ...newLoadouts)

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
    console.log(
      `[${id}] +${newLoadouts.map((l) => l.name).join(', ')} (rank=${rank})`,
    )
  }
}

main()
