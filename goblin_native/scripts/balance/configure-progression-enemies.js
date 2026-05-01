#!/usr/bin/env node

/**
 * ウルフ草原以降の進行（lizardman_swamp 1/2/3 → orc_fortress_1 → subjugation_force 1/2/3）
 * の敵を「アーキタイプ × ターゲットLv」で一貫して再生成する。
 *
 * 既存の異常値（lizardman_swamp_1 LIZ001 atk1000 等、_2/_3 は逆に Lv17-20）を完全に置き換える。
 * 各 area の patterns 配列は touch しない（敵IDの参照を維持）。
 */

const fs = require('node:fs')
const path = require('node:path')

// アーキタイプ別の Lv30 ベース能力 (boss は Lv40 ベース)
const ARCHETYPES = {
  warrior: {
    baseLevel: 30,
    hp: 760, atk: 200, def: 40, magicDef: 27,
    attackCount: 4, accuracy: 560, evasion: 46,
    exp: 32, gold: 26,
    skills: [{ id: 'physical_reduction_10', physicalDamageReductionPercent: 10 }],
    baseAttributes: { power: 18, wisdom: 18, spirit: 7, vitality: 22, agility: 10, luck: 5 },
  },
  archer: {
    baseLevel: 30,
    hp: 630, atk: 150, def: 10, magicDef: 15,
    attackCount: 4, accuracy: 560, evasion: 46,
    exp: 34, gold: 28,
    skills: [{ id: 'physical_reduction_10', physicalDamageReductionPercent: 10 }],
    baseAttributes: { power: 18, wisdom: 18, spirit: 4, vitality: 18, agility: 12, luck: 6 },
  },
  mage: {
    baseLevel: 30,
    hp: 590, atk: 110, def: 8, magicDef: 20,
    attackCount: 1, accuracy: 560, evasion: 46,
    exp: 38, gold: 32,
    skills: [
      { id: 'grant_fireball', name: 'ファイヤーボール', grantsSpellId: 'fireball' },
      { id: 'grant_magic_arrow', name: 'マジックアロー', grantsSpellId: 'magic_arrow' },
      { id: 'physical_reduction_10', physicalDamageReductionPercent: 10 },
    ],
    baseAttributes: { power: 18, wisdom: 18, spirit: 5, vitality: 17, agility: 10, luck: 5 },
  },
  healer: {
    baseLevel: 30,
    hp: 630, atk: 70, def: 16, magicDef: 24, magicHeal: 100,
    attackCount: 1, accuracy: 560, evasion: 46,
    exp: 36, gold: 30,
    skills: [
      { id: 'recovery_magic_lv7', recoveryMagicLevel: 7 },
      { id: 'physical_reduction_10', physicalDamageReductionPercent: 10 },
    ],
    baseAttributes: { power: 18, wisdom: 18, spirit: 6, vitality: 18, agility: 8, luck: 5 },
  },
  heavy: {
    baseLevel: 30,
    hp: 760, atk: 210, def: 50, magicDef: 36,
    attackCount: 5, accuracy: 560, evasion: 46,
    exp: 42, gold: 36,
    skills: [{ id: 'physical_reduction_10', physicalDamageReductionPercent: 10 }],
    baseAttributes: { power: 18, wisdom: 18, spirit: 9, vitality: 22, agility: 8, luck: 5 },
  },
  boss: {
    baseLevel: 40,
    hp: 1370, atk: 350, def: 100, magicDef: 45,
    attackCount: 7, accuracy: 640, evasion: 52,
    exp: 200, gold: 160,
    skills: [{ id: 'physical_reduction_10', physicalDamageReductionPercent: 10 }],
    baseAttributes: { power: 23, wisdom: 23, spirit: 11, vitality: 27, agility: 9, luck: 5 },
  },
}

// 各エリアの敵ロスター。raceTags / 名前は保持しつつ、stats は archetype + level で上書き。
// 進行: ウルフ草原(推奨Lv35) → リザードマン1(Lv37) → 2(Lv40) → 3(Lv43+ボス) → オーク砦(Lv46+ボス) → vs討伐軍(Lv45+)
const ROSTERS = {
  // lizardman_swamp: LIZ001 リザードマン(warrior), LIZ002 アサシンリザード(archer)。Lv上げ + aC/acc up
  // アサシンリザードは evasion も大幅up（暗殺者らしさ）
  // _3 はボス B_SWAMPKING キングリザードマン
  'lizardman_swamp_1.json': [
    { id: 'LIZ001', name: 'リザードマン', archetype: 'warrior', level: 36, raceTags: ['lizardman'],
      overrides: { attackCount: 5, accuracy: 600 } },
    { id: 'LIZ002', name: 'アサシンリザード', archetype: 'archer', level: 36, raceTags: ['lizardman'],
      overrides: { attackCount: 5, accuracy: 620, evasion: 60 } },
  ],
  'lizardman_swamp_2.json': [
    { id: 'LIZ001', name: 'リザードマン', archetype: 'warrior', level: 42, raceTags: ['lizardman'],
      overrides: { attackCount: 5, accuracy: 630 } },
    { id: 'LIZ002', name: 'アサシンリザード', archetype: 'archer', level: 42, raceTags: ['lizardman'],
      overrides: { attackCount: 5, accuracy: 650, evasion: 68 } },
  ],
  'lizardman_swamp_3.json': [
    { id: 'LIZ001', name: 'リザードマン', archetype: 'warrior', level: 44, raceTags: ['lizardman'],
      overrides: { attackCount: 6, accuracy: 640 } },
    { id: 'LIZ002', name: 'アサシンリザード', archetype: 'archer', level: 44, raceTags: ['lizardman'],
      overrides: { attackCount: 6, accuracy: 660, evasion: 70 } },
    { id: 'B_SWAMPKING', name: 'キングリザードマン', archetype: 'boss', level: 55, raceTags: ['lizardman'],
      overrides: { attackCount: 8, accuracy: 680, evasion: 60 } },
  ],
  'orc_fortress_1.json': [
    { id: 'ORF001', name: 'オーク重装兵', archetype: 'heavy', level: 48, raceTags: ['orc'] },
    { id: 'ORF002', name: 'オーク砦弓兵', archetype: 'archer', level: 46, raceTags: ['orc'] },
    { id: 'ORF003', name: '雇われトロル', archetype: 'heavy', level: 50, raceTags: ['troll'] },
    { id: 'B_ORC_FORTRESS', name: 'オーク砦守将', archetype: 'boss', level: 60, raceTags: ['orc'] },
  ],
  'subjugation_force_1.json': [
    // orc_fortress(推奨Lv54) より上を目指す。Lv66+, HUM005 aC6
    { id: 'HUM001', name: '辺境城正規兵', archetype: 'warrior', level: 66, raceTags: ['human'] },
    { id: 'HUM002', name: '辺境城魔術師', archetype: 'mage', level: 66, raceTags: ['human'] },
    { id: 'HUM003', name: '辺境城弓兵', archetype: 'archer', level: 66, raceTags: ['human'] },
    { id: 'HUM004', name: '辺境城クレリック', archetype: 'healer', level: 66, raceTags: ['human'] },
    { id: 'HUM005', name: '辺境城騎士', archetype: 'heavy', level: 68, raceTags: ['human'],
      overrides: { attackCount: 6 } },
  ],
  'subjugation_force_2.json': [
    { id: 'HUM001', name: '辺境城正規兵', archetype: 'warrior', level: 64, raceTags: ['human'] },
    { id: 'HUM002', name: '辺境城魔術師', archetype: 'mage', level: 64, raceTags: ['human'] },
    { id: 'HUM003', name: '辺境城弓兵', archetype: 'archer', level: 64, raceTags: ['human'] },
    { id: 'HUM004', name: '辺境城クレリック', archetype: 'healer', level: 64, raceTags: ['human'] },
    { id: 'HUM005', name: '辺境城騎士', archetype: 'heavy', level: 66, raceTags: ['human'] },
  ],
  'subjugation_force_3.json': [
    { id: 'HUM001', name: '辺境城正規兵', archetype: 'warrior', level: 68, raceTags: ['human'] },
    { id: 'HUM002', name: '辺境城魔術師', archetype: 'mage', level: 68, raceTags: ['human'] },
    { id: 'HUM003', name: '辺境城弓兵', archetype: 'archer', level: 68, raceTags: ['human'] },
    { id: 'HUM004', name: '辺境城クレリック', archetype: 'healer', level: 68, raceTags: ['human'] },
    { id: 'HUM005', name: '辺境城騎士', archetype: 'heavy', level: 70, raceTags: ['human'] },
    { id: 'B_CAPTAIN', name: '辺境城騎士団長', archetype: 'boss', level: 80, raceTags: ['human'] },
  ],
}

function buildEnemy(spec) {
  const arch = ARCHETYPES[spec.archetype]
  if (!arch) throw new Error(`Unknown archetype: ${spec.archetype}`)
  const ratio = spec.level / arch.baseLevel
  const out = {
    id: spec.id,
    name: spec.name,
    raceTags: spec.raceTags,
    level: spec.level,
    hp: Math.round(arch.hp * ratio),
    atk: Math.round(arch.atk * ratio),
    def: Math.round(arch.def * ratio),
    magicDef: Math.round(arch.magicDef * ratio),
    attackCount: arch.attackCount,
    accuracy: arch.accuracy,
    evasion: arch.evasion,
    exp: Math.round(arch.exp * ratio),
    gold: Math.round(arch.gold * ratio),
    skills: arch.skills,
    baseAttributes: arch.baseAttributes,
  }
  if (arch.magicAtk !== undefined) out.magicAtk = Math.round(arch.magicAtk * ratio)
  if (arch.magicHeal !== undefined) out.magicHeal = Math.round(arch.magicHeal * ratio)
  if (arch.factorDrops) out.factorDrops = arch.factorDrops
  // 個別 override を最後に適用
  if (spec.overrides) {
    Object.assign(out, spec.overrides)
  }
  return out
}

// パターンを完全置換するためのマップ（オーク砦の敵密度大幅up 等）
const PATTERN_OVERRIDES = {
  // lizardman_swamp_2: liz_1 を超える密度に（avg 5.0 → ~6.5）
  'lizardman_swamp_2.json': [
    { id: 'LS2_001', floors: [1], enemies: [['LIZ001', 'LIZ001'], ['LIZ002', 'LIZ002', 'LIZ002'], ['LIZ002']] },
    { id: 'LS2_002', floors: [1], enemies: [['LIZ001', 'LIZ001'], ['LIZ002', 'LIZ002'], ['LIZ002', 'LIZ002']] },
    { id: 'LS2_003', floors: [1], enemies: [['LIZ001', 'LIZ001', 'LIZ001'], ['LIZ002', 'LIZ002'], ['LIZ002', 'LIZ002']] },
    { id: 'LS2_004', floors: [2], enemies: [['LIZ001', 'LIZ001'], ['LIZ002', 'LIZ002'], ['LIZ002', 'LIZ002', 'LIZ002']] },
    { id: 'LS2_005', floors: [2], enemies: [['LIZ001', 'LIZ001'], ['LIZ002', 'LIZ002'], ['LIZ002', 'LIZ002']] },
    { id: 'LS2_006', floors: [2], enemies: [['LIZ001', 'LIZ001', 'LIZ001'], ['LIZ002', 'LIZ002'], ['LIZ002', 'LIZ002', 'LIZ002']] },
    { id: 'LS2_007', floors: [2], enemies: [['LIZ001', 'LIZ001', 'LIZ001'], ['LIZ002', 'LIZ002'], ['LIZ002', 'LIZ002']] },
    { id: 'LS2_008', floors: [3], enemies: [['LIZ001', 'LIZ001', 'LIZ001'], ['LIZ002', 'LIZ002', 'LIZ002'], ['LIZ002', 'LIZ002']] },
    { id: 'LS2_009', floors: [3], enemies: [['LIZ001', 'LIZ001'], ['LIZ001'], ['LIZ002', 'LIZ002', 'LIZ002'], ['LIZ002', 'LIZ002']] },
    { id: 'LS2_010', floors: [3], enemies: [['LIZ001', 'LIZ001', 'LIZ001'], ['LIZ002', 'LIZ002', 'LIZ002'], ['LIZ002', 'LIZ002', 'LIZ002']] },
  ],
  // subjugation_force_1: orc_fortress(avg 7.6)を超える密度に（現在 4.9 → ~7-8）
  'subjugation_force_1.json': [
    // floor 1
    { id: 'SF1_001', floors: [1], enemies: [['HUM005'], ['HUM001', 'HUM001'], ['HUM003', 'HUM002'], ['HUM003']] },
    { id: 'SF1_002', floors: [1], enemies: [['HUM005'], ['HUM001', 'HUM001'], ['HUM003', 'HUM003'], ['HUM002']] },
    { id: 'SF1_003', floors: [1], enemies: [['HUM005'], ['HUM001', 'HUM001'], ['HUM001'], ['HUM003', 'HUM003'], ['HUM002']] },
    // floor 2
    { id: 'SF1_004', floors: [2], enemies: [['HUM005'], ['HUM001', 'HUM001'], ['HUM003', 'HUM003'], ['HUM002', 'HUM004']] },
    { id: 'SF1_005', floors: [2], enemies: [['HUM005'], ['HUM001', 'HUM001'], ['HUM001'], ['HUM003', 'HUM002'], ['HUM004']] },
    { id: 'SF1_006', floors: [2], enemies: [['HUM005'], ['HUM001', 'HUM001'], ['HUM003', 'HUM003'], ['HUM003', 'HUM002'], ['HUM004']] },
    // floor 3
    { id: 'SF1_007', floors: [3], enemies: [['HUM005', 'HUM005'], ['HUM001', 'HUM001'], ['HUM003', 'HUM003'], ['HUM002', 'HUM004']] },
    { id: 'SF1_008', floors: [3], enemies: [['HUM005'], ['HUM001', 'HUM001'], ['HUM001', 'HUM001'], ['HUM003', 'HUM003'], ['HUM002', 'HUM004']] },
    { id: 'SF1_009', floors: [3], enemies: [['HUM005', 'HUM005'], ['HUM001', 'HUM001'], ['HUM001'], ['HUM003', 'HUM003'], ['HUM002', 'HUM004']] },
    { id: 'SF1_010', floors: [3], enemies: [['HUM005', 'HUM005'], ['HUM001', 'HUM001'], ['HUM001', 'HUM001'], ['HUM003', 'HUM003'], ['HUM002', 'HUM004']] },
  ],
  'orc_fortress_1.json': [
    // floor 1: 6-7 enemies, 重装+弓 mix
    { id: 'OF1_001', floors: [1], enemies: [
      ['ORF001', 'ORF001'],
      ['ORF002', 'ORF002'],
      ['ORF002', 'ORF002'],
    ] },
    { id: 'OF1_002', floors: [1], enemies: [
      ['ORF001', 'ORF001'],
      ['ORF001'],
      ['ORF002', 'ORF002'],
      ['ORF002', 'ORF002'],
    ] },
    { id: 'OF1_003', floors: [1], enemies: [
      ['ORF001', 'ORF001'],
      ['ORF002', 'ORF002', 'ORF002'],
      ['ORF002', 'ORF002'],
    ] },
    // floor 2: 7-8 enemies, トロルが入る
    { id: 'OF1_004', floors: [2], enemies: [
      ['ORF003'],
      ['ORF001', 'ORF001'],
      ['ORF002', 'ORF002'],
      ['ORF002', 'ORF002'],
    ] },
    { id: 'OF1_005', floors: [2], enemies: [
      ['ORF003', 'ORF001'],
      ['ORF001', 'ORF001'],
      ['ORF002', 'ORF002'],
      ['ORF002', 'ORF002'],
    ] },
    { id: 'OF1_006', floors: [2], enemies: [
      ['ORF003'],
      ['ORF001', 'ORF001', 'ORF001'],
      ['ORF002', 'ORF002'],
      ['ORF002', 'ORF002'],
    ] },
    // floor 3: 8 enemies non-boss + boss pattern
    { id: 'OF1_007', floors: [3], enemies: [
      ['ORF003', 'ORF003'],
      ['ORF001', 'ORF001'],
      ['ORF002', 'ORF002'],
      ['ORF002', 'ORF002'],
    ] },
    { id: 'OF1_008', floors: [3], enemies: [
      ['ORF003'],
      ['ORF001', 'ORF001'],
      ['ORF001'],
      ['ORF002', 'ORF002'],
      ['ORF002', 'ORF002'],
    ] },
    { id: 'BOSS', floors: [3], isBoss: true, enemies: [
      ['B_ORC_FORTRESS'],
      ['ORF003', 'ORF003'],
      ['ORF001', 'ORF001'],
      ['ORF002', 'ORF002'],
      ['ORF002', 'ORF002'],
    ] },
  ],
}

// 削除した敵IDを残った敵IDで置換するためのマッピング（ファイル別）
// パターン中に削除済み敵が残っているとパターンが壊れるので必須
const PATTERN_ID_REMAP = {
  'lizardman_swamp_1.json': {
    LIZ003: 'LIZ002', // 呪術師 → アサシンリザード（後衛 archer）
    LIZ004: 'LIZ001', // 重装 → リザードマン（前衛 warrior）
    LIZ005: 'LIZ002', // 暗殺者 → アサシンリザード
  },
  'lizardman_swamp_2.json': {
    LIZ003: 'LIZ002',
    LIZ004: 'LIZ001',
    LIZ005: 'LIZ002',
  },
  'lizardman_swamp_3.json': {
    LIZ003: 'LIZ002',
    LIZ004: 'LIZ001',
    LIZ005: 'LIZ002',
  },
}

function remapPatterns(patterns, remap) {
  if (!remap) return patterns
  return patterns.map((pattern) => ({
    ...pattern,
    enemies: (pattern.enemies || []).map((row) =>
      row.map((id) => remap[id] ?? id),
    ),
  }))
}

function main() {
  const enemyDir = path.resolve(__dirname, '..', '..', 'src', 'shared', 'data', 'enemy')
  for (const [file, roster] of Object.entries(ROSTERS)) {
    const full = path.join(enemyDir, file)
    const data = JSON.parse(fs.readFileSync(full, 'utf8'))
    data.enemies = roster.map(buildEnemy)
    if (PATTERN_OVERRIDES[file]) {
      data.patterns = PATTERN_OVERRIDES[file]
    } else if (PATTERN_ID_REMAP[file] && Array.isArray(data.patterns)) {
      data.patterns = remapPatterns(data.patterns, PATTERN_ID_REMAP[file])
    }
    fs.writeFileSync(full, JSON.stringify(data, null, 2) + '\n', 'utf8')
    const summary = data.enemies
      .map((e) => `${e.id}=Lv${e.level}(hp${e.hp},atk${e.atk})`)
      .join(', ')
    console.log(`[${file}] ${summary}`)
  }
}

main()
