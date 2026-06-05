#!/usr/bin/env node

/**
 * wolf_grassland_1.json をテンプレートに、統合版 lizardman_swamp_1 と orc_fortress_1 のシナリオを生成。
 * areaId / description / levelRange だけ変える。装備フィルタとPT構成は同じ。
 */

const fs = require('node:fs')
const path = require('node:path')

const SCENARIO_DIR = path.resolve(__dirname, 'scenarios')
const TEMPLATE = JSON.parse(fs.readFileSync(path.join(SCENARIO_DIR, 'wolf_grassland_1.json'), 'utf8'))

const TARGETS = [
  {
    areaId: 'lizardman_swamp_1',
    description: 'リザードマンの沼砦。旧1〜3を統合した6階構成。areaLevel=44。敵: リザードマン Lv44 / アサシンリザード Lv44 / キングリザードマン Lv55 ボス。装備プールはウルフ草原と同じ rank≤3。',
    levelRange: { min: 20, max: 90, step: 2 },
  },
  {
    areaId: 'orc_fortress_1',
    description: 'オークの砦。8階構成。areaLevel=45。敵: オーク重装兵 Lv45 / オーク弓兵 Lv45 / トロル Lv47 / オークチャンピオン Lv65 ボス。装備プール rank≤3。',
    levelRange: { min: 25, max: 100, step: 2 },
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
