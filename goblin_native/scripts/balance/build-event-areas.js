#!/usr/bin/env node

/**
 * ストーリーイベント型ダンジョン(本筋3+約束の履行4)の生成と、
 * 蜘蛛影の森以降の難易度カーブ是正(古城/王都1/王都2/火山)を行う。
 *
 * 敵ステータスは docs/balance_simulation.md 5.5 の「算出式×標準倍率×statBoost」。
 * 実行後は scripts/balance/measureArea.js で戦略ペルソナの単調増加を確認する。
 *
 * 実行:
 *   node scripts/balance/build-event-areas.js
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

const NORMAL_MULTIPLIER = { hp: 1, atk: 1.6, def: 1.25, eva: 1 }
const BOSS_MULTIPLIER = { hp: 1.6, atk: 1, def: 1, eva: 1 }
const round10 = value => Math.round(value / 10) * 10
const round = value => Math.round(value)

/** 役割テンプレ: baseAttributes と攻撃回数・命中/魔法回復の型 */
const ROLES = {
  infantry: { attrs: { power: 12, wisdom: 10, spirit: 8, vitality: 14, agility: 8, luck: 6 }, attackCount: 2 },
  archer: { attrs: { power: 13, wisdom: 11, spirit: 5, vitality: 10, agility: 12, luck: 7 }, attackCount: 3, attackType: 'range' },
  cleric: { attrs: { power: 8, wisdom: 14, spirit: 14, vitality: 11, agility: 7, luck: 6 }, attackCount: 1, cleric: true },
  mage: { attrs: { power: 13, wisdom: 15, spirit: 6, vitality: 8, agility: 9, luck: 7 }, attackCount: 1, mage: true },
  cavalry: { attrs: { power: 14, wisdom: 10, spirit: 8, vitality: 12, agility: 14, luck: 8 }, attackCount: 3 },
  heavy: { attrs: { power: 13, wisdom: 11, spirit: 12, vitality: 17, agility: 5, luck: 7 }, attackCount: 2 },
  scout: { attrs: { power: 12, wisdom: 12, spirit: 6, vitality: 10, agility: 16, luck: 9 }, attackCount: 3 },
  boss: { attrs: { power: 18, wisdom: 16, spirit: 14, vitality: 20, agility: 10, luck: 8 }, attackCount: 3 },
  vermin: { attrs: { power: 11, wisdom: 8, spirit: 4, vitality: 12, agility: 12, luck: 6 }, attackCount: 2 },
  verminFast: { attrs: { power: 10, wisdom: 8, spirit: 4, vitality: 9, agility: 18, luck: 8 }, attackCount: 3 },
  verminBoss: { attrs: { power: 16, wisdom: 10, spirit: 8, vitality: 18, agility: 12, luck: 8 }, attackCount: 3 },
}

const HUMAN_GUARD_SKILL = { id: 'physical_reduction_10', physicalDamageReductionPercent: 10 }
const MAGE_SKILLS = [
  { id: 'grant_fireball', name: 'ファイヤーボール', grantsSpellId: 'fireball' },
  { id: 'grant_magic_arrow', name: 'マジックアロー', grantsSpellId: 'magic_arrow' },
]
const CLERIC_SKILL = { id: 'recovery_magic_lv7', recoveryMagicLevel: 7 }

/**
 * SPEC:
 *  - enemies: id -> { name, role, level, raceTags?, gold?, human? }
 *  - existing エリアは retune: { levels, statBoost, bossStatBoost } のみ
 */
const NEW_AREAS = {
  margrave_sortie_1: {
    name: 'vs辺境伯軍・平原会戦',
    areaLevel: 130,
    floors: 8,
    timeFirst: 18000,
    timeCleared: 6000,
    statBoost: 2.4,
    bossStatBoost: 2.4,
    goldScale: 0.77,
    description: '辺境の城を目前にした平原。老将グレアムが籠城を捨てて打って出た。槍衾と騎兵の波を越え、野戦で辺境伯軍を打ち破れ。',
    unlockRequires: 'harpy_cliff_1',
    unlockNext: 'human_fortress_1',
    insertAfter: 'harpy_cliff_1',
    enemies: {
      MGS001: { name: '辺境槍兵', role: 'infantry', level: 106 },
      MGS002: { name: '辺境弩兵', role: 'archer', level: 108 },
      MGS003: { name: '従軍司祭', role: 'cleric', level: 110 },
      MGS004: { name: '辺境軽騎兵', role: 'cavalry', level: 112 },
      MGS005: { name: '辺境重騎士', role: 'heavy', level: 114 },
      MGS006: { name: '斥候長ロラン', role: 'scout', level: 118, gold: 190 },
      B_MARGRAVE_FIELD: { name: '辺境伯グレアム', role: 'boss', level: 128, isBoss: true },
    },
    pattern: {
      prefix: 'MS1',
      stages: [
        [['MGS001', 'MGS001'], ['MGS002']],
        [['MGS001', 'MGS001'], ['MGS002', 'MGS003']],
        [['MGS004', 'MGS001'], ['MGS002', 'MGS002']],
        [['MGS004', 'MGS004'], ['MGS002', 'MGS003', 'MGS001']],
        [['MGS005', 'MGS001'], ['MGS002', 'MGS003', 'MGS002']],
        [['MGS005', 'MGS004'], ['MGS006', 'MGS002', 'MGS003']],
        [['MGS005', 'MGS005', 'MGS004'], ['MGS002', 'MGS003', 'MGS002']],
        [['MGS005', 'MGS005', 'MGS004'], ['MGS006', 'MGS002', 'MGS003', 'MGS001']],
      ],
      boss: 'B_MARGRAVE_FIELD',
      bossSupport: ['MGS005', 'MGS005', 'MGS006', 'MGS002', 'MGS003'],
    },
  },
  fortress_defense_1: {
    name: '辺境の城・奪還防衛戦',
    areaLevel: 152,
    floors: 8,
    timeFirst: 18000,
    timeCleared: 6000,
    statBoost: 2.4,
    bossStatBoost: 2.4,
    goldScale: 0.9,
    description: '落としたはずの辺境の城に、王国の奪還軍が迫る。初めて「守る側」として城壁に立ち、騎士ロラン率いる先鋒軍を撃退せよ。',
    unlockRequires: 'human_fortress_1',
    unlockNext: 'vampire_castle_1',
    insertAfter: 'human_fortress_1',
    enemies: {
      FDF001: { name: '奪還軍歩兵', role: 'infantry', level: 116 },
      FDF002: { name: '奪還軍長弓兵', role: 'archer', level: 118 },
      FDF003: { name: '王国司祭', role: 'cleric', level: 120 },
      FDF004: { name: '奪還軍魔術師', role: 'mage', level: 120 },
      FDF005: { name: '王国先鋒騎士', role: 'heavy', level: 124 },
      B_ROLAN_KNIGHT: { name: '騎士ロラン', role: 'boss', level: 136, isBoss: true, attackCount: 4 },
    },
    pattern: {
      prefix: 'FD1',
      stages: [
        [['FDF001', 'FDF001'], ['FDF002']],
        [['FDF001', 'FDF001'], ['FDF002', 'FDF004']],
        [['FDF005', 'FDF001'], ['FDF002', 'FDF003']],
        [['FDF005', 'FDF001'], ['FDF004', 'FDF002', 'FDF003']],
        [['FDF005', 'FDF005'], ['FDF002', 'FDF003', 'FDF004']],
        [['FDF005', 'FDF005'], ['FDF004', 'FDF002', 'FDF003', 'FDF001']],
        [['FDF005', 'FDF005', 'FDF001'], ['FDF002', 'FDF003', 'FDF004', 'FDF002']],
        [['FDF005', 'FDF005', 'FDF005'], ['FDF004', 'FDF002', 'FDF003', 'FDF002']],
      ],
      boss: 'B_ROLAN_KNIGHT',
      bossSupport: ['FDF005', 'FDF005', 'FDF004', 'FDF002', 'FDF003'],
    },
  },
  royal_field_battle_1: {
    name: '王都平原会戦',
    areaLevel: 178,
    floors: 8,
    timeFirst: 21600,
    timeCleared: 7200,
    statBoost: 2.3,
    bossStatBoost: 2.3,
    goldScale: 0.78,
    description: '王都の城壁を望む大平原。王国が動かせる全軍が、元帥ガリウスの下に戦列を敷いた。約束を交わした全種族の力を束ね、最大の会戦を制せ。',
    unlockRequires: 'vampire_castle_1',
    unlockNext: 'royal_capital_1',
    insertAfter: 'vampire_castle_1',
    enemies: {
      RFB001: { name: '王国戦列歩兵', role: 'infantry', level: 152 },
      RFB002: { name: '王国長弓兵', role: 'archer', level: 156 },
      RFB003: { name: '戦列魔導兵', role: 'mage', level: 158 },
      RFB004: { name: '軍団司祭', role: 'cleric', level: 158 },
      RFB005: { name: '王国重装騎兵', role: 'heavy', level: 162 },
      RFB006: { name: '親衛騎士', role: 'cavalry', level: 166 },
      B_MARSHAL: { name: '王国元帥ガリウス', role: 'boss', level: 180, isBoss: true, attackCount: 4 },
    },
    pattern: {
      prefix: 'RF1',
      stages: [
        [['RFB001', 'RFB001'], ['RFB002']],
        [['RFB001', 'RFB001'], ['RFB002', 'RFB003']],
        [['RFB005', 'RFB001'], ['RFB002', 'RFB004']],
        [['RFB005', 'RFB001'], ['RFB003', 'RFB002', 'RFB004']],
        [['RFB005', 'RFB006'], ['RFB002', 'RFB004', 'RFB003']],
        [['RFB005', 'RFB006'], ['RFB003', 'RFB002', 'RFB004', 'RFB001']],
        [['RFB005', 'RFB006', 'RFB005'], ['RFB002', 'RFB004', 'RFB003', 'RFB002']],
        [['RFB006', 'RFB005', 'RFB006'], ['RFB003', 'RFB002', 'RFB004', 'RFB002']],
      ],
      boss: 'B_MARSHAL',
      bossSupport: ['RFB005', 'RFB006', 'RFB003', 'RFB002', 'RFB004'],
    },
  },
  swamp_defense_1: {
    name: '沼砦防衛戦',
    areaLevel: 148,
    floors: 6,
    timeFirst: 13200,
    timeCleared: 4400,
    statBoost: 3.0,
    bossStatBoost: 3.0,
    goldScale: 0.9,
    description: '辺境の城を失った王国が、報復に沼の水を涸らしに来た。「沼を涸らさない」――沼王と交わした約束を、今度はこちらが守る番だ。',
    unlockRequires: 'human_fortress_1',
    insertAfter: 'lizardman_swamp_1',
    enemies: {
      SWD001: { name: '懲罰隊焼き討ち兵', role: 'infantry', level: 112 },
      SWD002: { name: '懲罰隊斥候', role: 'scout', level: 114 },
      SWD003: { name: '沼地傭兵', role: 'heavy', level: 116 },
      SWD004: { name: '従軍司祭', role: 'cleric', level: 114 },
      B_PUNISHER: { name: '王国懲罰隊長', role: 'boss', level: 126, isBoss: true },
    },
    pattern: {
      prefix: 'SD1',
      stages: [
        [['SWD001', 'SWD001'], ['SWD002']],
        [['SWD001', 'SWD003'], ['SWD002', 'SWD004']],
        [['SWD003', 'SWD001'], ['SWD002', 'SWD002']],
        [['SWD003', 'SWD003'], ['SWD002', 'SWD004', 'SWD001']],
        [['SWD003', 'SWD003'], ['SWD002', 'SWD004', 'SWD002']],
        [['SWD003', 'SWD003', 'SWD001'], ['SWD002', 'SWD004', 'SWD002']],
      ],
      boss: 'B_PUNISHER',
      bossSupport: ['SWD003', 'SWD003', 'SWD002', 'SWD004'],
    },
  },
  harpy_defense_1: {
    name: '断崖の鷹匠戦',
    areaLevel: 152,
    floors: 6,
    timeFirst: 13200,
    timeCleared: 4400,
    statBoost: 2.8,
    bossStatBoost: 2.8,
    goldScale: 0.85,
    description: '王国の鷹匠部隊が、火矢でハーピィの巣を焼きに来た。「空を分け合う」約束のもと、翼ある隣人とともに断崖を守り抜け。',
    unlockRequires: 'human_fortress_1',
    insertAfter: 'swamp_defense_1',
    enemies: {
      HWD001: { name: '王国鷹匠', role: 'archer', level: 118 },
      HWD002: { name: '崖登り強襲兵', role: 'scout', level: 120 },
      HWD003: { name: '火矢兵', role: 'archer', level: 122 },
      HWD004: { name: '従軍司祭', role: 'cleric', level: 120 },
      B_FALCONER: { name: '鷹匠隊長', role: 'boss', level: 132, isBoss: true },
    },
    pattern: {
      prefix: 'HD1',
      stages: [
        [['HWD002', 'HWD002'], ['HWD001']],
        [['HWD002', 'HWD002'], ['HWD001', 'HWD003']],
        [['HWD002', 'HWD002'], ['HWD003', 'HWD004', 'HWD001']],
        [['HWD002', 'HWD002', 'HWD002'], ['HWD001', 'HWD003', 'HWD004']],
        [['HWD002', 'HWD002', 'HWD002'], ['HWD003', 'HWD003', 'HWD004']],
        [['HWD002', 'HWD002', 'HWD002'], ['HWD003', 'HWD001', 'HWD004', 'HWD003']],
      ],
      boss: 'B_FALCONER',
      bossSupport: ['HWD002', 'HWD002', 'HWD003', 'HWD004'],
    },
  },
  hobbit_hills_defense_1: {
    name: '丘陵村の徴税人',
    areaLevel: 45,
    floors: 6,
    timeFirst: 13200,
    timeCleared: 4400,
    statBoost: 1.3,
    bossStatBoost: 1.3,
    goldScale: 1.36,
    description: '王国の徴税官が、雇われの剣を連れて丘陵村へやってきた。「丘を守る」――ホビットたちと交わした最初の守る約束を果たせ。',
    unlockRequires: 'hobbit_hills_1',
    insertAfter: 'hobbit_hills_1',
    enemies: {
      HHD001: { name: '取り立て人足', role: 'infantry', level: 36 },
      HHD002: { name: '雇われ山賊', role: 'scout', level: 38 },
      HHD003: { name: '徴税官の護衛兵', role: 'heavy', level: 40 },
      HHD004: { name: '従軍書記', role: 'cleric', level: 38 },
      B_TAXMAN: { name: '王国徴税官', role: 'boss', level: 48, isBoss: true },
    },
    pattern: {
      prefix: 'HH1',
      stages: [
        [['HHD001', 'HHD001'], ['HHD002']],
        [['HHD001', 'HHD002'], ['HHD002', 'HHD004']],
        [['HHD003', 'HHD001'], ['HHD002', 'HHD002']],
        [['HHD003', 'HHD001'], ['HHD002', 'HHD004', 'HHD001']],
        [['HHD003', 'HHD003'], ['HHD002', 'HHD004', 'HHD002']],
        [['HHD003', 'HHD003', 'HHD001'], ['HHD002', 'HHD004', 'HHD002']],
      ],
      boss: 'B_TAXMAN',
      bossSupport: ['HHD003', 'HHD003', 'HHD002', 'HHD004'],
    },
  },
  dwarf_mine_purge_1: {
    name: '坑道の魔物払い',
    areaLevel: 52,
    floors: 6,
    timeFirst: 13200,
    timeCleared: 4400,
    statBoost: 1.3,
    bossStatBoost: 1.3,
    goldScale: 1.3,
    description: '坑道の深部に巣食う蟲どもが、炉の火を脅かしている。「火を絶やさない」――鍛冶王との取引を、刃で果たす時が来た。',
    unlockRequires: 'dwarf_mine_1',
    insertAfter: 'dwarf_mine_1',
    enemies: {
      DMP001: { name: '岩喰い虫', role: 'vermin', level: 40, raceTags: ['insect'] },
      DMP002: { name: '坑道大蜘蛛', role: 'verminFast', level: 42, raceTags: ['insect'] },
      DMP003: { name: '洞穴大コウモリ', role: 'verminFast', level: 41, raceTags: ['beast'] },
      DMP004: { name: '坑道百足', role: 'vermin', level: 44, raceTags: ['insect'] },
      B_DEEP_CRAWLER: { name: '深部の大百足', role: 'verminBoss', level: 54, isBoss: true, raceTags: ['insect'] },
    },
    pattern: {
      prefix: 'DP1',
      stages: [
        [['DMP001', 'DMP001'], ['DMP003']],
        [['DMP001', 'DMP002'], ['DMP003', 'DMP001']],
        [['DMP002', 'DMP002'], ['DMP003', 'DMP003']],
        [['DMP004', 'DMP001'], ['DMP002', 'DMP003', 'DMP001']],
        [['DMP004', 'DMP004'], ['DMP002', 'DMP003', 'DMP003']],
        [['DMP004', 'DMP004', 'DMP002'], ['DMP003', 'DMP002', 'DMP001']],
      ],
      boss: 'B_DEEP_CRAWLER',
      bossSupport: ['DMP004', 'DMP004', 'DMP002', 'DMP003'],
    },
  },
}

/**
 * 既存エリアの難易度是正。
 * - 古城/王都1/王都2: 戦略Lvが70で平坦 → 単調増加へ
 * - 火山: 王都2→火山の +110 断崖を緩和
 * - 丘陵/坑道/隠れ里: 旧仕様(Lv12-20)のまま宙に浮いていたのを、
 *   辺境の村クリア後の寄り道チェーンに合うLv帯へ引き上げ
 * oldBoost は現行JSONの生成時 statBoost(magicDef等の二重適用を防ぐための除算基準)。
 */
const RETUNE_AREAS = {
  spider_forest_1: {
    statBoost: 1.8,
    oldBoost: 1,
    levels: { SPF001: 100, SPF002: 103, SPF003: 106, B_ARACHNE: 126 },
  },
  dead_grave_1: {
    // 物理攻撃のみのロスターだと物理障壁レア束ねで完封されるため、
    // 魔法攻撃する亡霊(DGR006)を追加してエンカウント表も再構成する。
    statBoost: 2.8,
    oldBoost: 1.55,
    areaLevel: 145,
    levels: { DGR001: 140, DGR002: 141, DGR003: 143, DGR004: 145, DGR005: 148, B_GRAVE_WARDEN: 170 },
    extraEnemies: {
      DGR006: { name: '怨嗟の亡霊', role: 'mage', level: 144, raceTags: ['undead'] },
    },
    pattern: {
      prefix: 'DG1',
      stages: [
        [['DGR001', 'DGR001'], ['DGR002']],
        [['DGR001', 'DGR002'], ['DGR006', 'DGR001']],
        [['DGR003', 'DGR004'], ['DGR006', 'DGR002']],
        [['DGR005', 'DGR004'], ['DGR003', 'DGR006', 'DGR004']],
        [['DGR005', 'DGR004'], ['DGR006', 'DGR004', 'DGR006']],
        [['DGR005', 'DGR005'], ['DGR004', 'DGR006', 'DGR003']],
      ],
      boss: 'B_GRAVE_WARDEN',
      bossSupport: ['DGR005', 'DGR006', 'DGR004', 'DGR006'],
    },
  },
  harpy_cliff_1: {
    statBoost: 3.8,
    oldBoost: 1.45,
    bossStatBoost: 2.8,
    bossOldBoost: 1,
    levels: { HRP001: 112, HRP002: 116, B_HARPY_MATRIARCH: 140 },
  },
  human_fortress_1: {
    statBoost: 2.45,
    oldBoost: 1.6,
    levels: { FRT001: 104, FRT002: 106, FRT003: 110, FRT004: 108, FRT005: 114, B_COMMANDER: 132 },
  },
  vampire_castle_1: {
    statBoost: 5.2,
    oldBoost: 3.5,
    levels: { VMP001: 148, VMP002: 154, B_VAMPIRE_LORD: 178 },
  },
  royal_capital_1: {
    statBoost: 3.0,
    oldBoost: 2.5,
    levels: { ROY001: 168, ROY002: 174, ROY003: 180, ROY004: 184, ROY005: 190, B_GATE_COMMANDER: 212 },
  },
  royal_capital_2: {
    statBoost: 3.6,
    oldBoost: 2.8,
    levels: { ROY001: 188, ROY002: 194, ROY003: 200, ROY004: 204, ROY005: 210, ROY006: 202, B_PALACE_GUARDIAN: 232 },
  },
  dragon_volcano_1: {
    statBoost: 1.55,
    oldBoost: 1.8,
    levels: { DRG001: 214, DRG002: 222, DRG003: 230, B_FLAME_DRAGON: 264 },
  },
  hobbit_hills_1: {
    statBoost: 2.3,
    oldBoost: 1,
    goldScale: 1.2,
    rederiveMagicDef: true,
    areaLevel: 35,
    levels: { HBT001: 30, HBT002: 32, HBT003: 40 },
  },
  dwarf_mine_1: {
    statBoost: 2.6,
    oldBoost: 1,
    goldScale: 1.85,
    rederiveMagicDef: true,
    areaLevel: 40,
    levels: { DWF001: 34, DWF002: 35, DWF003: 36, DWF004: 38, DWF005: 36, B_FORGEKING: 46 },
  },
  elf_forest_1: {
    statBoost: 2.8,
    oldBoost: 1,
    goldScale: 1.5,
    rederiveMagicDef: true,
    areaLevel: 45,
    levels: { ELF001: 38, ELF002: 39, ELF003: 40, ELF004: 41, ELF005: 42, B_FORESTGUARD: 50 },
  },
  troll_canyon_1: {
    statBoost: 3.2,
    oldBoost: 4,
    goldScale: 1.45,
    levels: { TRL001: 96, TRL002: 100, TRL003: 102, TRL004: 106, TRL005: 104, B_TYRANT: 124 },
  },
}

/** 解放グラフの繋ぎ替え(既存エリア側) */
const REWIRE = {
  harpy_cliff_1: { unlockNext: 'margrave_sortie_1', unlockNexts: ['troll_canyon_1'] },
  human_fortress_1: { unlockRequires: 'margrave_sortie_1', unlockNext: 'fortress_defense_1', unlockNexts: ['swamp_defense_1', 'harpy_defense_1'] },
  vampire_castle_1: { unlockRequires: 'fortress_defense_1', unlockNext: 'royal_field_battle_1' },
  royal_capital_1: { unlockRequires: 'royal_field_battle_1' },
  human_village: { unlockNext: 'wolf_grassland_1', unlockNexts: ['hobbit_hills_1'] },
  hobbit_hills_1: { unlockRequires: 'human_village', unlockNext: 'dwarf_mine_1', unlockNexts: ['hobbit_hills_defense_1'] },
  dwarf_mine_1: { unlockRequires: 'hobbit_hills_1', unlockNext: 'elf_forest_1', unlockNexts: ['dwarf_mine_purge_1'] },
  elf_forest_1: { unlockRequires: 'dwarf_mine_1' },
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function saveJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function buildStatsFromRole(id, spec, statBoost, bossStatBoost, goldScale) {
  const role = ROLES[spec.role]
  if (!role) throw new Error(`未知のrole: ${spec.role} (${id})`)
  const raceTags = spec.raceTags ?? ['human']
  const species = detectEnemyHpSpecies(raceTags)
  const isBoss = spec.isBoss === true
  const multiplier = isBoss ? BOSS_MULTIPLIER : NORMAL_MULTIPLIER
  const boost = isBoss ? bossStatBoost : statBoost
  const attrs = role.attrs
  const level = spec.level

  const enemy = {
    id,
    name: spec.name,
    attackType: spec.attackType ?? role.attackType ?? 'melee',
    raceTags,
    level,
    hp: round10(calculateEnemyBaseHpFromInputs(level, attrs.vitality, species) * multiplier.hp * boost),
    atk: round(calculateEnemyBaseAtkFromInputs(level, attrs.power, species) * multiplier.atk * boost),
    def: round(calculateEnemyBaseDefFromInputs(level, attrs.vitality, species) * multiplier.def * boost),
    attackCount: spec.attackCount ?? role.attackCount,
    accuracy: Math.min(isBoss ? 1050 : 990, round((isBoss ? 650 : 540) + level * (isBoss ? 1.5 : 2))),
    evasion: calculateEnemyBaseEvasionFromInputs(level, attrs.agility, attrs.luck, species),
    gold: round((spec.gold ?? level * (isBoss ? 5.5 : 1.35)) * (goldScale ?? 1)),
    magicDef: round(calculateEnemyBaseDefFromInputs(level, attrs.spirit, species) * multiplier.def * boost * 1.4),
    baseAttributes: { ...attrs },
  }
  if (isBoss) enemy.isBoss = true

  const skills = []
  if (raceTags.includes('human')) skills.push({ ...HUMAN_GUARD_SKILL })
  if (role.mage) skills.push(...MAGE_SKILLS.map(skill => ({ ...skill })))
  if (role.cleric) {
    skills.push({ ...CLERIC_SKILL })
    enemy.magicHeal = round(227 * Math.pow(level / 68, 0.85) * statBoost)
  }
  if (skills.length > 0) enemy.skills = skills
  return enemy
}

function makePattern(id, floor, enemies, flags = {}) {
  return { id, floors: [floor], enemies, ...flags }
}

function buildPatterns(config) {
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

function buildRetuneStats(enemy, level, config) {
  const statBoost = enemy.isBoss ? (config.bossStatBoost ?? config.statBoost) : config.statBoost
  const oldBoost = enemy.isBoss
    ? (config.bossOldBoost ?? config.oldBoost ?? statBoost)
    : (config.oldBoost ?? statBoost)
  const species = detectEnemyHpSpecies(enemy.raceTags || [])
  const multiplier = enemy.isBoss ? BOSS_MULTIPLIER : NORMAL_MULTIPLIER
  const attrs = enemy.baseAttributes
  const next = { ...enemy, level }
  next.hp = round10(calculateEnemyBaseHpFromInputs(level, attrs.vitality, species) * multiplier.hp * statBoost)
  next.atk = round(calculateEnemyBaseAtkFromInputs(level, attrs.power, species) * multiplier.atk * statBoost)
  next.def = round(calculateEnemyBaseDefFromInputs(level, attrs.vitality, species) * multiplier.def * statBoost)
  next.evasion = calculateEnemyBaseEvasionFromInputs(level, attrs.agility, attrs.luck, species)
  next.accuracy = Math.min(enemy.isBoss ? 1050 : 990,
    round((enemy.isBoss ? 650 : 540) + level * (enemy.isBoss ? 1.5 : 2)))

  const levelRatio = Math.pow(level / Math.max(enemy.level, 1), 0.85)
  const boostRatio = statBoost / oldBoost
  if (config.rederiveMagicDef) {
    next.magicDef = round(calculateEnemyBaseDefFromInputs(level, attrs.spirit ?? attrs.vitality, species) * multiplier.def * statBoost * 1.4)
  } else if (enemy.magicDef !== undefined) {
    next.magicDef = round(enemy.magicDef * levelRatio * boostRatio)
  }
  if (enemy.magicAtk !== undefined) next.magicAtk = round(enemy.magicAtk * levelRatio * boostRatio)
  if (enemy.magicHeal !== undefined) next.magicHeal = round(enemy.magicHeal * levelRatio * boostRatio)
  if (enemy.gold !== undefined) next.gold = round(enemy.gold * Math.pow(levelRatio, 0.5) * (config.goldScale ?? 1))
  return next
}

function upsertAllAreaEntry(areaList, entry, insertAfter) {
  const existingIndex = areaList.areas.findIndex(area => area.id === entry.id)
  if (existingIndex >= 0) {
    areaList.areas[existingIndex] = { ...areaList.areas[existingIndex], ...entry }
    return
  }
  const anchorIndex = areaList.areas.findIndex(area => area.id === insertAfter)
  if (anchorIndex < 0) throw new Error(`insertAfter が見つかりません: ${insertAfter}`)
  areaList.areas.splice(anchorIndex + 1, 0, entry)
}

function main() {
  const areaList = loadJson(ALL_AREA_PATH)

  // 1. 新イベントエリアの生成
  for (const [areaId, config] of Object.entries(NEW_AREAS)) {
    const enemies = Object.entries(config.enemies).map(([id, spec]) =>
      buildStatsFromRole(id, spec, config.statBoost, config.bossStatBoost ?? config.statBoost, config.goldScale))
    const database = { enemies, patterns: buildPatterns(config) }
    saveJson(path.join(ENEMY_DIR, `${areaId}.json`), database)

    const areaConfig = {
      id: areaId,
      name: config.name,
      areaLevel: config.areaLevel,
      floors: config.floors,
      baseDurationSec: config.timeFirst,
      description: config.description,
      encounter: {
        eventIntervalSec: Math.round(config.timeCleared / 10),
        eventWeights: { exploring: 60, goldTreasure: 10, battle: 30 },
      },
      ...(config.unlockNext ? { unlockNext: config.unlockNext } : {}),
    }
    saveJson(path.join(AREA_DIR, `${areaId}.json`), areaConfig)

    const entry = {
      id: areaId,
      name: config.name,
      areaLevel: config.areaLevel,
      floors: config.floors,
      exploration_time_sec_first: config.timeFirst,
      exploration_time_sec: config.timeCleared,
      description: config.description,
      unlockRequires: config.unlockRequires,
      ...(config.unlockNext ? { unlockNext: config.unlockNext } : {}),
    }
    upsertAllAreaEntry(areaList, entry, config.insertAfter)
    console.log(`[new] ${areaId} (${config.name}) enemies=${enemies.length} patterns=${database.patterns.length}`)
  }

  // 2. 既存エリアの難易度是正
  for (const [areaId, config] of Object.entries(RETUNE_AREAS)) {
    const enemyPath = path.join(ENEMY_DIR, `${areaId}.json`)
    const database = loadJson(enemyPath)
    database.enemies = database.enemies.map(enemy => {
      const level = config.levels[enemy.id]
      return level ? buildRetuneStats(enemy, level, config) : enemy
    })
    if (config.extraEnemies) {
      for (const [id, spec] of Object.entries(config.extraEnemies)) {
        if (database.enemies.some(enemy => enemy.id === id)) continue
        database.enemies.push(buildStatsFromRole(id, spec, config.statBoost, config.bossStatBoost ?? config.statBoost, config.goldScale))
      }
    }
    if (config.pattern) {
      database.patterns = buildPatterns({ pattern: config.pattern })
    }
    saveJson(enemyPath, database)

    if (config.areaLevel !== undefined) {
      const listed = areaList.areas.find(entry => entry.id === areaId)
      if (listed) listed.areaLevel = config.areaLevel
      const areaPath = path.join(AREA_DIR, `${areaId}.json`)
      if (fs.existsSync(areaPath)) {
        const areaConfig = loadJson(areaPath)
        areaConfig.areaLevel = config.areaLevel
        saveJson(areaPath, areaConfig)
      }
    }
    console.log(`[retune] ${areaId} statBoost=${config.statBoost}`)
  }

  // 3. 解放グラフの繋ぎ替え
  for (const [areaId, wiring] of Object.entries(REWIRE)) {
    const entry = areaList.areas.find(area => area.id === areaId)
    if (!entry) throw new Error(`エリアが見つかりません: ${areaId}`)
    Object.assign(entry, wiring)
    const areaPath = path.join(AREA_DIR, `${areaId}.json`)
    if (fs.existsSync(areaPath)) {
      const areaConfig = loadJson(areaPath)
      if (wiring.unlockNext) areaConfig.unlockNext = wiring.unlockNext
      if (wiring.unlockNexts) areaConfig.unlockNexts = wiring.unlockNexts
      saveJson(areaPath, areaConfig)
    }
    console.log(`[rewire] ${areaId} -> ${JSON.stringify(wiring)}`)
  }

  saveJson(ALL_AREA_PATH, areaList)
  console.log('done')
}

main()
