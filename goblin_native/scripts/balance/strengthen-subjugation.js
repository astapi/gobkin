#!/usr/bin/env node

/**
 * vs討伐軍の敵を強化する。
 * - power/wisdom を 18 に正規化（boss B_CAPTAIN のみ 23）
 * - accuracy/evasion をウルフ草原と同水準に（regular: 560/46, boss: 640/52）
 * - attackCount は役割に応じて維持（caster=1, others=4, boss=7）
 * - physical_reduction_10 を全員に追加（人間軍は装備が良いので 10% 軽減）
 * - HP/vit の比率をウルフ草原参考に再計算（hp ≈ 34*vit for Lv30 regulars, ≈ 50*vit for Lv40 boss）
 */

const fs = require('node:fs')
const path = require('node:path')

const FILES = [
  'src/shared/data/enemy/subjugation_force_1.json',
  'src/shared/data/enemy/subjugation_force_2.json',
  'src/shared/data/enemy/subjugation_force_3.json',
]

// ID -> { 役割定義, 新ステータス }
const HUMAN_OVERRIDES = {
  HUM001: {
    name: '辺境城正規兵',
    hp: 760,
    atk: 200,
    def: 40,
    magicDef: 27,
    attackCount: 4,
    accuracy: 560,
    evasion: 46,
    exp: 32,
    gold: 26,
    skills: [
      { id: 'physical_reduction_10', physicalDamageReductionPercent: 10 },
    ],
    baseAttributes: {
      power: 18,
      wisdom: 18,
      spirit: 7,
      vitality: 22,
      agility: 10,
      luck: 5,
    },
  },
  HUM002: {
    name: '辺境城魔術師',
    hp: 590,
    atk: 110,
    def: 8,
    magicDef: 20,
    attackCount: 1,
    accuracy: 560,
    evasion: 46,
    exp: 38,
    gold: 32,
    skills: [
      { id: 'grant_fireball', name: 'ファイヤーボール', grantsSpellId: 'fireball' },
      { id: 'grant_magic_arrow', name: 'マジックアロー', grantsSpellId: 'magic_arrow' },
      { id: 'physical_reduction_10', physicalDamageReductionPercent: 10 },
    ],
    baseAttributes: {
      power: 18,
      wisdom: 18,
      spirit: 5,
      vitality: 17,
      agility: 10,
      luck: 5,
    },
  },
  HUM003: {
    name: '辺境城弓兵',
    hp: 630,
    atk: 150,
    def: 10,
    magicDef: 15,
    attackCount: 4,
    accuracy: 560,
    evasion: 46,
    exp: 34,
    gold: 28,
    skills: [
      { id: 'physical_reduction_10', physicalDamageReductionPercent: 10 },
    ],
    baseAttributes: {
      power: 18,
      wisdom: 18,
      spirit: 4,
      vitality: 18,
      agility: 12,
      luck: 6,
    },
  },
  HUM004: {
    name: '辺境城クレリック',
    hp: 630,
    atk: 70,
    def: 16,
    magicDef: 24,
    magicHeal: 100,
    attackCount: 1,
    accuracy: 560,
    evasion: 46,
    exp: 36,
    gold: 30,
    skills: [
      { id: 'recovery_magic_lv7', recoveryMagicLevel: 7 },
      { id: 'physical_reduction_10', physicalDamageReductionPercent: 10 },
    ],
    baseAttributes: {
      power: 18,
      wisdom: 18,
      spirit: 6,
      vitality: 18,
      agility: 8,
      luck: 5,
    },
  },
  HUM005: {
    name: '辺境城騎士',
    hp: 760,
    atk: 210,
    def: 50,
    magicDef: 36,
    attackCount: 5,
    accuracy: 560,
    evasion: 46,
    exp: 42,
    gold: 36,
    skills: [
      { id: 'physical_reduction_10', physicalDamageReductionPercent: 10 },
    ],
    baseAttributes: {
      power: 18,
      wisdom: 18,
      spirit: 9,
      vitality: 22,
      agility: 8,
      luck: 5,
    },
  },
  // 辺境城騎士団長（boss）: subjugation_force_3 のみ
  B_CAPTAIN: {
    name: '辺境城騎士団長',
    hp: 1370,
    atk: 350,
    def: 100,
    magicDef: 45,
    attackCount: 7,
    accuracy: 640,
    evasion: 52,
    exp: 200,
    gold: 160,
    factorDrops: [],
    skills: [
      { id: 'physical_reduction_10', physicalDamageReductionPercent: 10 },
    ],
    baseAttributes: {
      power: 23,
      wisdom: 23,
      spirit: 11,
      vitality: 27,
      agility: 9,
      luck: 5,
    },
  },
}

function applyOverride(enemy) {
  const o = HUMAN_OVERRIDES[enemy.id]
  if (!o) return enemy
  // level / id / raceTags はそのまま、それ以外を上書き
  return {
    ...enemy,
    name: o.name,
    hp: o.hp,
    atk: o.atk,
    def: o.def,
    magicDef: o.magicDef,
    magicHeal: o.magicHeal ?? enemy.magicHeal,
    attackCount: o.attackCount,
    accuracy: o.accuracy,
    evasion: o.evasion,
    exp: o.exp,
    gold: o.gold,
    factorDrops: o.factorDrops ?? enemy.factorDrops,
    skills: o.skills,
    baseAttributes: o.baseAttributes,
  }
}

function main() {
  const projectRoot = path.resolve(__dirname, '..', '..')
  for (const rel of FILES) {
    const full = path.join(projectRoot, rel)
    const data = JSON.parse(fs.readFileSync(full, 'utf8'))
    const beforeIds = data.enemies.map((e) => e.id).join(',')
    data.enemies = data.enemies.map(applyOverride)
    fs.writeFileSync(full, JSON.stringify(data, null, 2) + '\n', 'utf8')
    console.log(`[updated] ${rel} (${beforeIds})`)
  }
}

main()
