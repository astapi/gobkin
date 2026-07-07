/**
 * マスターデータ整合性ラチェットテスト: 遠征エリア解放グラフの到達可能性
 *
 * `src/shared/data/expeditionArea/allArea.json` の `unlockNext` / `unlockNexts` /
 * `unlocked` を、実際の解放処理と同じルールでシミュレートし、
 * 到達不能なエリアが KNOWN_UNREACHABLE_AREAS と完全一致することを確認する。
 *
 * ここでは以下の理由により、実際の解放処理コード（RN依存の可能性がある）を
 * import せず、同じロジックをテスト内に再実装している。
 * 参照元:
 *  - src/presentation/stores/useDungeonStore.ts
 *    - buildDefaultProgress: `unlocked: dungeon.unlocked ?? index === 0`
 *      （JSON先頭要素 = slime_cave のみ初期解放。他は `unlocked: true` の明示が必要）
 *    - markDungeonCleared: クリア時に `dungeon.unlockNext` と `dungeon.unlockNexts`
 *      の解放先をまとめて `unlocked: true` にする（== 解放グラフの辺）
 *  - src/presentation/stores/usePurchaseStore.ts
 *    - syncPurchasedStoryEntitlements: 課金 entitlement 保有時に
 *      `PURCHASE_PRODUCTS[].unlockDungeonIds` を dungeonProgressRepository.unlock() で直接解放
 *  - src/shared/constants/purchases.ts（`react-native` に依存するため import 不可。
 *    値だけを PURCHASE_UNLOCKED_AREA_IDS として複製）
 *    - SHADOW_CAT_DUNGEON_ID = 'cat_fortress_1'（猫獣人の影遺跡）
 *    - NECROMANCER_DUNGEON_ID = 'necromancer_crypt_1'（死霊術師の地下霊廟）
 *
 * このテストが壊れたら:
 *  - 新規に到達不能なエリアが増えた場合 → データ側のバグ（unlockNext/unlockRequires
 *    の設定漏れ）の可能性が高いので確認する。
 *  - KNOWN_UNREACHABLE_AREAS に載っている既知のエリアが到達可能になった場合 →
 *    保留中だった問題が解消されたということなので、このリストからエントリを削除する。
 */
import { areasData } from '..'

/** 課金（サイドストーリー）で直接解放されるエリアID一覧。 */
const PURCHASE_UNLOCKED_AREA_IDS = ['cat_fortress_1', 'necromancer_crypt_1']

/**
 * 既知の「到達不能」エリア。理由付きで一件ずつ列挙する。
 * ここに載っているエリアだけが到達不能であることを本テストで保証する。
 */
const KNOWN_UNREACHABLE_AREAS: Record<string, string> = {
  troll_canyon_1:
    'unlockRequires: harpy_cliff_1 だが、harpy_cliff_1 の unlockNext/unlockNexts は human_fortress_1 のみで troll_canyon_1 を含まない（データのみ・未実装として確認済み）',
  minotaur_labyrinth_1:
    'unlockRequires: troll_canyon_1 だが troll_canyon_1 自体が到達不能なため連鎖的に到達不能（データのみ・未実装として確認済み）',
  hobbit_hills_1:
    'unlockRequires が設定されておらず、他のどのエリアの unlockNext/unlockNexts からも参照されていない独立エリア（docs/expedition_unlock_routes.md に「宙に置かれた」と明記）',
  dwarf_mine_1:
    'unlockRequires が設定されておらず、他のどのエリアの unlockNext/unlockNexts からも参照されていない独立エリア（docs/expedition_unlock_routes.md に「宙に置かれた」と明記）',
  elf_forest_1:
    'unlockRequires が設定されておらず、他のどのエリアの unlockNext/unlockNexts からも参照されていない独立エリア（docs/expedition_unlock_routes.md に「宙に置かれた」と明記）',
}

function computeReachableAreaIds(): Set<string> {
  const areaById = new Map(areasData.map(area => [area.id, area]))

  const roots = areasData
    .filter((area, index) => area.unlocked === true || index === 0)
    .map(area => area.id)

  const queue = [...roots, ...PURCHASE_UNLOCKED_AREA_IDS]
  const reachable = new Set<string>(queue)

  while (queue.length > 0) {
    const currentId = queue.shift() as string
    const current = areaById.get(currentId)
    if (!current) continue

    const targets = [
      ...(current.unlockNext ? [current.unlockNext] : []),
      ...(current.unlockNexts ?? []),
    ]

    for (const targetId of targets) {
      if (!reachable.has(targetId)) {
        reachable.add(targetId)
        queue.push(targetId)
      }
    }
  }

  return reachable
}

describe('遠征エリア解放グラフの到達可能性ラチェット', () => {
  it('初期解放 + 課金解放エリアを起点に、すべてのエリアの到達可能性がKNOWN_UNREACHABLE_AREASと一致する', () => {
    const reachable = computeReachableAreaIds()
    const allAreaIds = areasData.map(area => area.id)

    const actualUnreachable = allAreaIds.filter(id => !reachable.has(id)).sort()
    const knownUnreachable = Object.keys(KNOWN_UNREACHABLE_AREAS).sort()

    const newlyUnreachable = actualUnreachable.filter(id => !knownUnreachable.includes(id))
    const noLongerUnreachable = knownUnreachable.filter(id => !actualUnreachable.includes(id))

    expect({
      newlyUnreachable,
      noLongerUnreachable,
    }).toEqual({
      newlyUnreachable: [],
      noLongerUnreachable: [],
    })

    expect(actualUnreachable).toEqual(knownUnreachable)
  })

  it('KNOWN_UNREACHABLE_AREAS に列挙したエリアIDはすべて実在する', () => {
    const allAreaIds = new Set(areasData.map(area => area.id))
    for (const id of Object.keys(KNOWN_UNREACHABLE_AREAS)) {
      expect(allAreaIds.has(id)).toBe(true)
    }
  })

  it('課金解放エリアIDはallArea.json上に存在し、かつunlockRequiresを持たない（課金以外の到達経路がない）ことを確認', () => {
    const areaById = new Map(areasData.map(area => [area.id, area]))
    for (const id of PURCHASE_UNLOCKED_AREA_IDS) {
      const area = areaById.get(id)
      expect(area).toBeDefined()
      expect(area?.unlockRequires).toBeUndefined()
    }
  })
})
