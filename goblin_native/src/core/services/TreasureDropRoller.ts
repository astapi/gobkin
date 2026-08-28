import type { Enemy, TreasureDrop, PartyRewardMultipliers, DungeonTier } from '../../shared/types'
import { normalizePartyRewardMultipliers } from '../../shared/types'
import { getEquipmentTemplate, getEquipmentByRank } from '../../shared/data/equipmentPoolLoader'
import { EquipmentTitleService } from './EquipmentTitleService'
import { EquipmentModService } from './EquipmentModService'
import { rollDropRank } from './DropRankRoller'
import { rollLuckValue } from './LuckRoller'

/**
 * 戦闘勝利時の宝箱ドロップ抽選（ノーマル + レア + 称号付与）を行う。
 * ExpeditionEngine から切り出し、rng を引数として受け取ることで
 * ExpeditionEngine のprivate実装に依存せずテスト可能にしている。
 *
 * @param enemies 抽選対象の敵一覧（1戦闘分）
 * @param droppedIds 遠征を通じて既にドロップ済みのテンプレートID（呼び出し後、当選分が追加される）
 * @param partyLuckAverage パーティの平均運値
 * @param rewardMultipliers パーティスキル等による報酬倍率
 * @param rareDropMultiplierBoost レアドロップ率のブースト倍率
 * @param titleMultiplierBoost 称号付与率のブースト倍率
 * @param tier ダンジョンTier
 * @param rng 乱数生成関数
 */
export function rollTreasureDrops(
  enemies: Enemy[],
  droppedIds: Set<string>,
  partyLuckAverage: number,
  rewardMultipliers: PartyRewardMultipliers | undefined,
  rareDropMultiplierBoost: number = 1,
  titleMultiplierBoost: number = 1,
  tier: DungeonTier = 0,
  rng: () => number
): TreasureDrop[] {
  const { title: titleMultiplier, rare: rareMultiplier } = normalizePartyRewardMultipliers(rewardMultipliers)
  const effectiveTitleMultiplier = titleMultiplier * (titleMultiplierBoost > 0 ? titleMultiplierBoost : 1)
  const drops: TreasureDrop[] = []
  const expeditionDroppedIds = new Set(droppedIds)
  const pendingDroppedIds = new Set<string>()

  const normalThreshold = 100 - rareMultiplier * 10
  const effectiveRareMultiplier = rareMultiplier * (rareDropMultiplierBoost > 0 ? rareDropMultiplierBoost : 1)
  const rareThreshold = 100 - effectiveRareMultiplier * 0.1

  // ノーマルドロップ判定（敵1体ごと）
  for (const enemy of enemies) {
    const luckRoll = rollLuckValue(partyLuckAverage, rng)
    if (!(normalThreshold < luckRoll)) continue

    const rank = rollDropRank(enemy.level, rng)
    const candidates = getEquipmentByRank(rank).filter(
      (t) => !expeditionDroppedIds.has(t.id) && !pendingDroppedIds.has(t.id)
    )
    if (candidates.length === 0) continue

    const index = Math.floor(rng() * candidates.length)
    const selected = candidates[index]

    const titleLuckRoll = rollLuckValue(partyLuckAverage, rng)
    const title = EquipmentTitleService.rollTitle(effectiveTitleMultiplier, titleLuckRoll, tier, rng)
    const titleId = title.titleId !== 'none' ? title.titleId : undefined
    drops.push({
      templateId: selected.id,
      titleId,
      ...EquipmentModService.rollMods(enemy.level, tier, rng),
    })
    pendingDroppedIds.add(selected.id)
  }

  // レアドロップ判定（通常候補 + Tier 追加候補のアイテム1つごとに当落判定）
  for (const enemy of enemies) {
    const rareEquipmentDrops = [
      ...(enemy.rareEquipmentDrops ?? []),
      ...(enemy.tierRareEquipmentDrops ?? [])
        .filter(tierDrops => tierDrops.tier <= tier)
        .flatMap(tierDrops => tierDrops.drops),
    ]
    if (rareEquipmentDrops.length === 0) continue

    for (const drop of rareEquipmentDrops) {
      if (
        expeditionDroppedIds.has(drop.templateId) ||
        pendingDroppedIds.has(drop.templateId) ||
        getEquipmentTemplate(drop.templateId) === undefined
      ) continue

      const luckRoll = rollLuckValue(partyLuckAverage, rng)
      if (!(rareThreshold < luckRoll)) continue

      const titleLuckRoll = rollLuckValue(partyLuckAverage, rng)
      const title = EquipmentTitleService.rollTitle(effectiveTitleMultiplier, titleLuckRoll, tier, rng)
      const titleId = title.titleId !== 'none' ? title.titleId : undefined
      drops.push({
        templateId: drop.templateId,
        titleId,
        ...EquipmentModService.rollMods(enemy.level, tier, rng),
      })
      pendingDroppedIds.add(drop.templateId)
    }
  }

  for (const templateId of pendingDroppedIds) {
    droppedIds.add(templateId)
  }

  return drops
}
