import { useEffect, useMemo, useState } from 'react'

import {
  DROP_RANK_TABLE,
  findStartStepIndex,
} from '@app/core/services/DropRankRoller'
import {
  DUNGEON_TIER_LIST,
  DUNGEON_TIER_META,
  DUNGEON_TIER_SCALING,
  type DungeonTier,
} from '@app/shared/types/DungeonTier'

import {
  EquipmentPoolSchema,
  isEquipmentTemplate,
  type EnemyDatabase,
  type EquipmentTemplate,
} from '../lib/schema'

let cachedPool: EquipmentTemplate[] | null = null
let cachedPoolPromise: Promise<EquipmentTemplate[]> | null = null

async function loadEquipmentTemplates(): Promise<EquipmentTemplate[]> {
  if (cachedPool) return cachedPool
  if (cachedPoolPromise) return cachedPoolPromise
  cachedPoolPromise = (async () => {
    const res = await fetch('/api/equipment-pool')
    if (!res.ok) throw new Error(`equipment-pool 取得失敗: HTTP ${res.status}`)
    const raw = await res.json()
    const parsed = EquipmentPoolSchema.parse(raw)
    const templates = parsed.templates.filter(isEquipmentTemplate)
    cachedPool = templates
    return templates
  })()
  try {
    return await cachedPoolPromise
  } finally {
    cachedPoolPromise = null
  }
}

function getMaxRankForLevel(level: number): number {
  const idx = findStartStepIndex(level)
  return DROP_RANK_TABLE[idx]?.rank ?? 0
}

function getEffectiveEnemyLevel(baseLevel: number, tier: DungeonTier): number {
  const scaling = DUNGEON_TIER_SCALING[tier]
  return Math.floor(baseLevel * scaling.statScale) + scaling.levelBonus
}

interface TierDropInfo {
  tier: DungeonTier
  maxEffectiveLevel: number
  maxRank: number
  newRanks: number[]
}

export function DungeonDropsView({ enemy }: { enemy: EnemyDatabase | null }) {
  const [templates, setTemplates] = useState<EquipmentTemplate[] | null>(cachedPool)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (templates) return
    loadEquipmentTemplates()
      .then((list) => {
        if (cancelled) return
        setTemplates(list)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [templates])

  const enemies = enemy?.enemies ?? []

  const tierInfos = useMemo<TierDropInfo[]>(() => {
    if (enemies.length === 0) return []
    const baseMaxLevel = Math.max(...enemies.map((e) => e.level))
    let prevMaxRank = -1
    return DUNGEON_TIER_LIST.map((tier) => {
      const maxEffectiveLevel = getEffectiveEnemyLevel(baseMaxLevel, tier)
      const maxRank = getMaxRankForLevel(maxEffectiveLevel)
      const newRanks: number[] = []
      for (let r = prevMaxRank + 1; r <= maxRank; r++) newRanks.push(r)
      prevMaxRank = Math.max(prevMaxRank, maxRank)
      return { tier, maxEffectiveLevel, maxRank, newRanks }
    })
  }, [enemies])

  const templatesByRank = useMemo(() => {
    const map = new Map<number, EquipmentTemplate[]>()
    for (const t of templates ?? []) {
      if (t.rank === undefined) continue
      const list = map.get(t.rank) ?? []
      list.push(t)
      map.set(t.rank, list)
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.id.localeCompare(b.id))
    }
    return map
  }, [templates])

  const templateMap = useMemo(() => {
    const map = new Map<string, EquipmentTemplate>()
    for (const t of templates ?? []) map.set(t.id, t)
    return map
  }, [templates])

  const rareDropEntries = useMemo(() => {
    const entries: Array<{
      enemyId: string
      enemyName: string
      baseTemplateIds: string[]
      tierTemplateIds: Array<{ tier: DungeonTier; templateIds: string[] }>
    }> = []
    for (const e of enemies) {
      const drops = (e as { rareEquipmentDrops?: Array<{ templateId: string }> }).rareEquipmentDrops
      const tierDrops =
        (e as { tierRareEquipmentDrops?: Array<{ tier: DungeonTier; drops: Array<{ templateId: string }> }> })
          .tierRareEquipmentDrops ?? []
      if ((!drops || drops.length === 0) && tierDrops.length === 0) continue
      entries.push({
        enemyId: e.id,
        enemyName: e.name,
        baseTemplateIds: (drops ?? []).map((d) => d.templateId),
        tierTemplateIds: tierDrops.map((entry) => ({
          tier: entry.tier,
          templateIds: entry.drops.map((drop) => drop.templateId),
        })),
      })
    }
    return entries
  }, [enemies])

  if (!enemy) {
    return <p className="subtle">敵データが登録されていないためドロップ予測は表示できません。</p>
  }

  if (loadError) return <p className="save-error">{loadError}</p>
  if (!templates) return <p className="subtle">アイテム一覧を読み込み中…</p>

  const baseMaxLevel = enemies.length > 0 ? Math.max(...enemies.map((e) => e.level)) : 0

  return (
    <div className="dungeon-drops">
      <section className="card">
        <h3>ノーマルドロップ予測</h3>
        <p className="subtle">
          ベース最大敵Lv {baseMaxLevel} を基準に、各ティアの実効敵Lvから到達可能なドロップ階層と、その階層に属する装備テンプレート (rank 一致) を表示します。
          上位ティアでは、それより低いティアで既に表示されたランクは省略します。
        </p>
        {tierInfos.map((info) => (
          <TierBlock
            key={info.tier}
            info={info}
            templatesByRank={templatesByRank}
          />
        ))}
      </section>

      <section className="card">
        <h3>レアドロップ</h3>
        <p className="subtle">
          各敵に登録された <code>rareEquipmentDrops</code> と、Tierで追加される <code>tierRareEquipmentDrops</code> の一覧です。
        </p>
        {rareDropEntries.length === 0 && <p className="subtle">レアドロップは登録されていません。</p>}
        {rareDropEntries.map((entry) => (
          <div key={entry.enemyId} className="drop-rare-block">
            <h4>
              {entry.enemyName} <span className="subtle">/ <code>{entry.enemyId}</code></span>
            </h4>
            <RareDropList label="通常" templateIds={entry.baseTemplateIds} templateMap={templateMap} />
            {entry.tierTemplateIds.map((tierEntry) => {
              const meta = DUNGEON_TIER_META[tierEntry.tier]
              const label = meta.prefix ? `${meta.prefix} 追加` : '通常追加'
              return (
                <RareDropList
                  key={tierEntry.tier}
                  label={label}
                  templateIds={tierEntry.templateIds}
                  templateMap={templateMap}
                />
              )
            })}
          </div>
        ))}
      </section>
    </div>
  )
}

function RareDropList({
  label,
  templateIds,
  templateMap,
}: {
  label: string
  templateIds: string[]
  templateMap: Map<string, EquipmentTemplate>
}) {
  if (templateIds.length === 0) return null
  return (
    <>
      <p className="subtle">{label}</p>
      <ul className="drop-list">
        {templateIds.map((templateId) => {
          const t = templateMap.get(templateId)
          return (
            <li key={templateId} className={t ? '' : 'invalid-cell'}>
              {t ? (
                <>
                  <strong>{t.name}</strong>{' '}
                  <span className="subtle">
                    <code>{t.id}</code> · {t.category}
                    {t.subCategory ? ` / ${t.subCategory}` : ''}
                    {t.rank !== undefined ? ` · rank ${t.rank}` : ''}
                  </span>
                </>
              ) : (
                <span>未登録の templateId: {templateId}</span>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}

function TierBlock({
  info,
  templatesByRank,
}: {
  info: TierDropInfo
  templatesByRank: Map<number, EquipmentTemplate[]>
}) {
  const meta = DUNGEON_TIER_META[info.tier]
  const tierLabel = meta.prefix ? `Tier ${info.tier} (${meta.prefix})` : `Tier ${info.tier} (通常)`
  const hasNew = info.newRanks.length > 0

  return (
    <details className="drop-tier-block" open={info.tier <= 1}>
      <summary>
        <strong>{tierLabel}</strong>
        <span className="subtle">
          {' '}実効敵Lv {info.maxEffectiveLevel} / 最大ランク {info.maxRank}
          {hasNew ? ` / 追加ランク [${info.newRanks.join(', ')}]` : ' / 追加なし'}
        </span>
      </summary>
      {!hasNew && (
        <p className="subtle">このティアで新たに追加されるドロップはありません。</p>
      )}
      {info.newRanks.map((rank) => {
        const list = templatesByRank.get(rank) ?? []
        return (
          <div key={rank} className="drop-rank-group">
            <h5>rank {rank} ({list.length}件)</h5>
            {list.length === 0 && <p className="subtle">この rank に属するアイテムがありません。</p>}
            <ul className="drop-list">
              {list.map((t) => (
                <li key={t.id}>
                  <strong>{t.name}</strong>{' '}
                  <span className="subtle">
                    <code>{t.id}</code> · {t.category}
                    {t.subCategory ? ` / ${t.subCategory}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </details>
  )
}
