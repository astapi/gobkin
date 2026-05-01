#!/usr/bin/env node

/**
 * vs討伐軍の敵レベルを上げて、HP/atk/def/magicDef/exp/gold をレベル比で線形スケール。
 * accuracy/evasion/attackCount/skills/baseAttributes は変更しない（既に強化済み）。
 */

const fs = require('node:fs')
const path = require('node:path')

// 各エリアのターゲットレベル
// ウルフ草原(推奨Lv35)より一段階上を狙う：subjugation_force_1 推奨Lv38-42
const TARGETS = {
  'subjugation_force_1.json': { default: 40, HUM005: 42, B_CAPTAIN: null },
  'subjugation_force_2.json': { default: 44, HUM005: 46, B_CAPTAIN: null },
  'subjugation_force_3.json': { default: 48, HUM005: 50, B_CAPTAIN: 55 },
}

function scaleEnemy(enemy, newLevel) {
  if (!newLevel || newLevel === enemy.level) return enemy
  const ratio = newLevel / enemy.level
  const scaled = {
    ...enemy,
    level: newLevel,
    hp: Math.round(enemy.hp * ratio),
    atk: Math.round(enemy.atk * ratio),
    def: Math.round(enemy.def * ratio),
    magicDef: Math.round(enemy.magicDef * ratio),
    exp: Math.round(enemy.exp * ratio),
    gold: Math.round(enemy.gold * ratio),
  }
  if (enemy.magicAtk !== undefined) scaled.magicAtk = Math.round(enemy.magicAtk * ratio)
  if (enemy.magicHeal !== undefined) scaled.magicHeal = Math.round(enemy.magicHeal * ratio)
  return scaled
}

function main() {
  const enemyDir = path.resolve(__dirname, '..', '..', 'src', 'shared', 'data', 'enemy')
  for (const [file, targets] of Object.entries(TARGETS)) {
    const full = path.join(enemyDir, file)
    const data = JSON.parse(fs.readFileSync(full, 'utf8'))
    data.enemies = data.enemies.map((enemy) => {
      const target = targets[enemy.id] !== undefined ? targets[enemy.id] : targets.default
      return scaleEnemy(enemy, target)
    })
    fs.writeFileSync(full, JSON.stringify(data, null, 2) + '\n', 'utf8')
    const summary = data.enemies
      .map((e) => `${e.id}=Lv${e.level}(hp${e.hp},atk${e.atk})`)
      .join(', ')
    console.log(`[${file}] ${summary}`)
  }
}

main()
