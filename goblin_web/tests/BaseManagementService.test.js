import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const BaseManagementService = await loadService()

function createService(randomValues = []) {
  let index = 0
  const random = () => {
    const value = randomValues[index]
    index += 1
    return value ?? 0.5
  }
  return new BaseManagementService(random)
}

test('スライムの洞窟クリアで初回の出生が保証される', () => {
  const service = createService([0.2, 0.3, 0.4, 0.5, 0.6])
  const now = Date.now()
  const result = service.evaluateBirths({
    goblins: [],
    capacity: 3,
    rank: 1,
    now,
    lastSpawnTime: now - 1000,
    slimeCaveCleared: true,
    firstBonusGranted: false,
  })

  assert.equal(result.newborns.length, 1)
  const [newborn] = result.newborns
  assert.equal(result.firstBonusGranted, true)
  assert.equal(result.updatedLastSpawnTime, now)
  assert.ok(result.availableSlots === 2)
  assert.ok(newborn.name.startsWith('新生ゴブリン'))
  assert.ok(newborn.stats.hp >= 55 && newborn.stats.hp <= 80)
})

test('経過時間に応じて出生が追加される', () => {
  const service = createService([0.1, 0.2])
  const start = 0
  const now = start + 2 * 30 * 60 * 1000
  const result = service.evaluateBirths({
    goblins: [],
    capacity: 5,
    rank: 1,
    now,
    lastSpawnTime: start,
    slimeCaveCleared: false,
    firstBonusGranted: true,
  })

  assert.equal(result.newborns.length, 2)
  assert.equal(result.updatedLastSpawnTime, start + 2 * 30 * 60 * 1000)
})

test('ランクで出生数が増える', () => {
  const service = createService([0.1, 0.2, 0.3])
  const start = 0
  const now = start + 30 * 60 * 1000
  const result = service.evaluateBirths({
    goblins: [],
    capacity: 5,
    rank: 3,
    now,
    lastSpawnTime: start,
    slimeCaveCleared: false,
    firstBonusGranted: true,
  })

  assert.equal(result.newborns.length, 2)
  assert.ok(result.availableSlots === 3)
})

test('収容数が上限の場合は出生しない', () => {
  const service = createService([0.1])
  const now = Date.now()
  const goblins = [{
    id: 1,
    name: '既存ゴブリン',
    race: 'ゴブリン',
    level: 2,
    avatar: '/avatars/goblin.png',
    stats: { hp: 60, atk: 12, sp: 10, spd: 9, def: 10 },
    equipment: [{ slotIndex: 0, itemId: null }],
  }]
  const result = service.evaluateBirths({
    goblins,
    capacity: 1,
    rank: 1,
    now,
    lastSpawnTime: now - 30 * 60 * 1000,
    slimeCaveCleared: false,
    firstBonusGranted: true,
  })

  assert.equal(result.newborns.length, 0)
  assert.equal(result.availableSlots, 0)
})

test('ゴブリンを追放できる', () => {
  const service = createService()
  const goblins = [
    { id: 1, name: 'A', race: 'ゴブリン', level: 1, avatar: '', stats: { hp: 60, atk: 12, sp: 10, spd: 9, def: 10 }, equipment: [] },
    { id: 2, name: 'B', race: 'ゴブリン', level: 1, avatar: '', stats: { hp: 60, atk: 12, sp: 10, spd: 9, def: 10 }, equipment: [] },
  ]

  const remaining = service.expelGoblin(goblins, 1)
  assert.deepEqual(remaining, [goblins[1]])
})

async function loadService() {
  const servicePath = path.resolve('src/core/services/BaseManagementService.ts')
  const tsSource = await fs.readFile(servicePath, 'utf8')
  const transpiled = ts.transpileModule(tsSource, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2022,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      esModuleInterop: true,
    },
  })
  const moduleUrl = new URL(`data:text/javascript,${encodeURIComponent(transpiled.outputText)}`)
  return (await import(moduleUrl.href)).BaseManagementService
}
