#!/usr/bin/env node

/**
 * vs討伐軍の敵を「ベース能力 → スケール → 強化」を一度に適用するユニファイド版。
 *
 * 1. 各敵のベース能力 (Lv30 想定の HP/atk/def 等) を BASE で定義
 * 2. ターゲットレベル newLevel を指定し、ratio = newLevel/30 でステータスをスケール
 * 3. accuracy/evasion/attackCount/skills/baseAttributes は強化版を適用
 *
 * これにより順序依存のバグなく確定的に状態が決まる。
 */

const fs = require('node:fs')
const path = require('node:path')

const BASE_LEVEL = 30 // 全 HUM のベースレベル
const BOSS_BASE_LEVEL = 40 // B_CAPTAIN のベース

// 各敵の Lv30 (B_CAPTAIN は Lv40) ベース能力＋強化属性
const BASE = {
  HUM001: {
    name: '辺境城正規兵',
    raceTags: ['human'],
    baseLevel: BASE_LEVEL,
    hp: 760, atk: 200, def: 40, magicDef: 27,
    attackCount: 4, accuracy: 560, evasion: 46,
    exp: 32, gold: 26,
    skills: [
      { id: 'physical_reduction_10', physicalDamageReductionPercent: 10 },
    ],
    baseAttributes: { power: 18, wisdom: 18, spirit: 7, vitality: 22, agility: 10, luck: 5 },
  },
  HUM002: {
    name: '辺境城魔術師',
    raceTags: ['human'],
    baseLevel: BASE_LEVEL,
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
  HUM003: {
    name: '辺境城弓兵',
    raceTags: ['human'],
    baseLevel: BASE_LEVEL,
    hp: 630, atk: 150, def: 10, magicDef: 15,
    attackCount: 4, accuracy: 560, evasion: 46,
    exp: 34, gold: 28,
    skills: [
      { id: 'physical_reduction_10', physicalDamageReductionPercent: 10 },
    ],
    baseAttributes: { power: 18, wisdom: 18, spirit: 4, vitality: 18, agility: 12, luck: 6 },
  },
  HUM004: {
    name: '辺境城クレリック',
    raceTags: ['human'],
    baseLevel: BASE_LEVEL,
    hp: 630, atk: 70, def: 16, magicDef: 24, magicHeal: 100,
    attackCount: 1, accuracy: 560, evasion: 46,
    exp: 36, gold: 30,
    skills: [
      { id: 'recovery_magic_lv7', recoveryMagicLevel: 7 },
      { id: 'physical_reduction_10', physicalDamageReductionPercent: 10 },
    ],
    baseAttributes: { power: 18, wisdom: 18, spirit: 6, vitality: 18, agility: 8, luck: 5 },
  },
  HUM005: {
    name: '辺境城騎士',
    raceTags: ['human'],
    baseLevel: BASE_LEVEL,
    hp: 760, atk: 210, def: 50, magicDef: 36,
    attackCount: 5, accuracy: 560, evasion: 46,
    exp: 42, gold: 36,
    skills: [
      { id: 'physical_reduction_10', physicalDamageReductionPercent: 10 },
    ],
    baseAttributes: { power: 18, wisdom: 18, spirit: 9, vitality: 22, agility: 8, luck: 5 },
  },
  B_CAPTAIN: {
    name: '辺境城騎士団長',
    raceTags: ['human'],
    baseLevel: BOSS_BASE_LEVEL,
    hp: 1370, atk: 350, def: 100, magicDef: 45,
    attackCount: 7, accuracy: 640, evasion: 52,
    exp: 200, gold: 160,
    factorDrops: [],
    skills: [
      { id: 'physical_reduction_10', physicalDamageReductionPercent: 10 },
    ],
    baseAttributes: { power: 23, wisdom: 23, spirit: 11, vitality: 27, agility: 9, luck: 5 },
  },
}

// 各エリアのターゲットレベル：ウルフ草原（A 推奨Lv35）より明確に上に。
// Lv44 では A 推奨Lv35 でウルフと同水準だったため、Lv48 まで引き上げて A 推奨Lv ~38 を目指す。
const TARGETS = {
  'subjugation_force_1.json': {
    HUM001: 48, HUM002: 48, HUM003: 48, HUM004: 48, HUM005: 50,
  },
}

function buildEnemy(id, newLevel) {
  const base = BASE[id]
  if (!base) throw new Error(`Unknown enemy id: ${id}`)
  const ratio = newLevel / base.baseLevel
  const out = {
    id,
    name: base.name,
    raceTags: base.raceTags,
    level: newLevel,
    hp: Math.round(base.hp * ratio),
    atk: Math.round(base.atk * ratio),
    def: Math.round(base.def * ratio),
    magicDef: Math.round(base.magicDef * ratio),
    attackCount: base.attackCount,
    accuracy: base.accuracy,
    evasion: base.evasion,
    exp: Math.round(base.exp * ratio),
    gold: Math.round(base.gold * ratio),
    skills: base.skills,
    baseAttributes: base.baseAttributes,
  }
  if (base.magicAtk !== undefined) out.magicAtk = Math.round(base.magicAtk * ratio)
  if (base.magicHeal !== undefined) out.magicHeal = Math.round(base.magicHeal * ratio)
  if (base.factorDrops !== undefined) out.factorDrops = base.factorDrops
  return out
}

function main() {
  const enemyDir = path.resolve(__dirname, '..', '..', 'src', 'shared', 'data', 'enemy')
  for (const [file, levelMap] of Object.entries(TARGETS)) {
    const full = path.join(enemyDir, file)
    const data = JSON.parse(fs.readFileSync(full, 'utf8'))
    data.enemies = data.enemies.map((existing) => {
      const target = levelMap[existing.id]
      if (target === undefined) return existing
      return buildEnemy(existing.id, target)
    })
    fs.writeFileSync(full, JSON.stringify(data, null, 2) + '\n', 'utf8')
    const summary = data.enemies
      .map((e) => `${e.id}=Lv${e.level}(hp${e.hp},atk${e.atk},aC${e.attackCount})`)
      .join(', ')
    console.log(`[${file}] ${summary}`)
  }
}

main()
