#!/usr/bin/env node

/**
 * wolf_grassland_1.json をテンプレートに、lizardman_swamp_{1,2,3} と orc_fortress_1 のシナリオを生成。
 * areaId / description / levelRange だけ変える。装備フィルタとPT構成は同じ。
 */

const fs = require('node:fs')
const path = require('node:path')

const SCENARIO_DIR = path.resolve(__dirname, 'scenarios')
const TEMPLATE = JSON.parse(fs.readFileSync(path.join(SCENARIO_DIR, 'wolf_grassland_1.json'), 'utf8'))

const TARGETS = [
  {
    areaId: 'lizardman_swamp_1',
    description: 'リザードマンの沼砦・浅瀬。リザードマン(warrior Lv33)とアサシンリザード(archer Lv33)のみ。装備プールはウルフ草原と同じ rank≤3。',
    levelRange: { min: 25, max: 60, step: 2 },
  },
  {
    areaId: 'lizardman_swamp_2',
    description: 'リザードマンの沼砦・本砦。Lv36 化。装備プール rank≤3。',
    levelRange: { min: 25, max: 60, step: 2 },
  },
  {
    areaId: 'lizardman_swamp_3',
    description: 'リザードマンの沼砦・最深部。Lv40 + キングリザードマン Lv50 ボス。装備プール rank≤3。',
    levelRange: { min: 30, max: 65, step: 2 },
  },
  {
    areaId: 'orc_fortress_1',
    description: 'オーク砦・本陣。オーク重装兵 Lv44/オーク砦弓兵 Lv42/雇われトロル Lv45/オーク砦守将 Lv55。装備プール rank≤3。',
    levelRange: { min: 30, max: 65, step: 2 },
  },
]

for (const t of TARGETS) {
  const newScenario = {
    ...TEMPLATE,
    areaId: t.areaId,
    description: t.description,
    levelRange: t.levelRange,
  }
  const outPath = path.join(SCENARIO_DIR, `${t.areaId}.json`)
  fs.writeFileSync(outPath, JSON.stringify(newScenario, null, 2) + '\n', 'utf8')
  console.log(`[created] ${outPath}`)
}
