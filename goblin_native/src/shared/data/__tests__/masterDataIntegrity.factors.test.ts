/**
 * マスターデータ整合性ラチェットテスト: 因子の入手可能性
 *
 * factorDatabase(src/shared/data/factors.ts + goblinVariants.ts) の各因子について、
 * 以下のいずれかの入手手段があるかを確認する。
 *  - いずれかの敵JSON(src/shared/data/enemy/*.json) の factorDrops に含まれる
 *  - 特別入手手段がある
 *    - ratatoskr: 金のドングリ使用時の特殊エンカウント
 *      (src/core/services/ExpeditionEngine.ts の GOLDEN_ACORN_CLEAR_FACTOR_DROPS,
 *       src/core/usecases/CompleteExpeditionUseCase.ts の ratatoskrEvent 判定)
 *    - slime: スライムの洞窟初回クリア確定入手
 *      (src/core/usecases/CompleteExpeditionUseCase.ts の
 *       `replay.meta.areaId === 'slime_cave' && drop.factorId === 'slime'` 分岐。
 *       ただし slime は通常の factorDrops(slime_cave の B_SLIME) でも入手可能なため、
 *       このテスト上は敵JSONドロップの時点で入手可能因子として扱われる)
 *
 * 入手源が存在しない因子が KNOWN_UNOBTAINABLE_FACTORS と完全一致することを確認する。
 * 新しい因子を追加してドロップ源を用意し忘れた場合や、既存の未入手因子にドロップ源が
 * 追加されたまま KNOWN_UNOBTAINABLE_FACTORS を更新し忘れた場合に検知する。
 */
import { areasData } from '..'
import { getEnemyDatabase } from '../enemy'
import { factorDatabase } from '../factors'

/** 敵JSONのfactorDropsに依らない特別な入手手段を持つ因子ID。 */
const SPECIALLY_OBTAINABLE_FACTOR_IDS = new Set<string>([
  'ratatoskr', // 金のドングリ使用時の特殊エンカウント(golden_acorn_ratatoskr)限定ドロップ
])

/**
 * 既知の「入手源なし」因子。バランス調整保留中のため、例外として許容する。
 */
const KNOWN_UNOBTAINABLE_FACTORS = ['harpy', 'hobbit', 'minotaur', 'vampire', 'dragon'].sort()

function collectFactorDropIdsFromEnemies(): Set<string> {
  const dropIds = new Set<string>()
  for (const area of areasData) {
    const database = getEnemyDatabase(area.id)
    for (const enemy of database?.enemies ?? []) {
      for (const drop of enemy.factorDrops ?? []) {
        dropIds.add(drop.factorId)
      }
    }
  }
  return dropIds
}

describe('因子入手可能性ラチェット', () => {
  it('入手源のない因子がKNOWN_UNOBTAINABLE_FACTORSと一致する', () => {
    const droppableFactorIds = collectFactorDropIdsFromEnemies()

    const unobtainable = Object.keys(factorDatabase)
      .filter(factorId => !droppableFactorIds.has(factorId) && !SPECIALLY_OBTAINABLE_FACTOR_IDS.has(factorId))
      .sort()

    const newlyUnobtainable = unobtainable.filter(id => !KNOWN_UNOBTAINABLE_FACTORS.includes(id))
    const newlyObtainable = KNOWN_UNOBTAINABLE_FACTORS.filter(id => !unobtainable.includes(id))

    expect({ newlyUnobtainable, newlyObtainable }).toEqual({
      newlyUnobtainable: [],
      newlyObtainable: [],
    })

    expect(unobtainable).toEqual(KNOWN_UNOBTAINABLE_FACTORS)
  })

  it('KNOWN_UNOBTAINABLE_FACTORSに列挙した因子IDはすべてfactorDatabaseに実在する', () => {
    for (const factorId of KNOWN_UNOBTAINABLE_FACTORS) {
      expect(factorDatabase[factorId]).toBeDefined()
    }
  })

  it('ratatoskrはfactorDatabaseに存在するが敵JSONのfactorDropsには含まれない(特別入手のみ)', () => {
    const droppableFactorIds = collectFactorDropIdsFromEnemies()
    expect(factorDatabase.ratatoskr).toBeDefined()
    expect(droppableFactorIds.has('ratatoskr')).toBe(false)
  })
})
