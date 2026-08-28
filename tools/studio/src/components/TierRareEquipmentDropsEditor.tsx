import {
  DUNGEON_TIER_META,
  type DungeonTier,
} from '@app/shared/types/DungeonTier'

import {
  RareEquipmentDropsEditor,
  type RareDropEntry,
} from './RareEquipmentDropsEditor'

export interface TierRareDropEntry {
  tier: DungeonTier
  drops: RareDropEntry[]
}

const EDITABLE_EXTRA_TIERS: DungeonTier[] = [1, 3]

function normalizeTierDrops(entries: TierRareDropEntry[] | undefined): Map<DungeonTier, RareDropEntry[]> {
  const map = new Map<DungeonTier, RareDropEntry[]>()
  for (const entry of entries ?? []) {
    map.set(entry.tier, entry.drops ?? [])
  }
  return map
}

function buildTierDrops(map: Map<DungeonTier, RareDropEntry[]>): TierRareDropEntry[] | undefined {
  const next = EDITABLE_EXTRA_TIERS.flatMap((tier) => {
    const drops = map.get(tier)?.filter((drop) => drop.templateId.trim() !== '') ?? []
    return drops.length > 0 ? [{ tier, drops }] : []
  })
  return next.length > 0 ? next : undefined
}

export function TierRareEquipmentDropsEditor({
  tierRareEquipmentDrops,
  onChange,
}: {
  tierRareEquipmentDrops: TierRareDropEntry[] | undefined
  onChange: (next: TierRareDropEntry[] | undefined) => void
}) {
  const tierDropMap = normalizeTierDrops(tierRareEquipmentDrops)

  const updateTier = (tier: DungeonTier, drops: RareDropEntry[] | undefined) => {
    const nextMap = new Map(tierDropMap)
    if (!drops || drops.length === 0) {
      nextMap.delete(tier)
    } else {
      nextMap.set(tier, drops)
    }
    onChange(buildTierDrops(nextMap))
  }

  return (
    <section className="tier-rare-editor">
      <h4>Tier追加レアドロップ</h4>
      <p className="subtle">
        通常Tierの候補に、指定Tier以上で追加される候補です。宿った(Tier 2)は追加なしの仕様です。
      </p>
      <div className="tier-rare-grid">
        {EDITABLE_EXTRA_TIERS.map((tier) => {
          const meta = DUNGEON_TIER_META[tier]
          return (
            <RareEquipmentDropsEditor
              key={tier}
              rareEquipmentDrops={tierDropMap.get(tier)}
              onChange={(drops) => updateTier(tier, drops)}
              title={`${meta.prefix} 追加 (Tier ${tier})`}
              maxEntries={1}
            />
          )
        })}
      </div>
    </section>
  )
}
