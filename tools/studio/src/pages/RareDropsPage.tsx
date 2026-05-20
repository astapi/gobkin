import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getCharacterSkillEffectDescriptions } from '@app/shared/data/characterSkills'
import { getCharacterSkillDefinition, isCharacterSkillId } from '@app/shared/data/skillCatalog'
import { getSkillLabel } from '@app/shared/i18n/entityLocalization'
import type { CharacterSkill } from '@app/shared/types/CharacterSkill'
import type { DungeonTier } from '@app/shared/types/DungeonTier'

import {
  AreaConfigSchema,
  EnemyDatabaseSchema,
  type DungeonDetailDto,
  type DungeonSummary,
  type EquipmentStat,
  type EquipmentTemplate,
  type EnemyDatabase,
} from '../lib/schema'
import {
  loadEquipmentTemplates,
  TemplateSelect,
  type RareDropEntry,
} from '../components/RareEquipmentDropsEditor'

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }
  | { kind: 'success' }

type DetailState = {
  summary: DungeonSummary
  detail: DungeonDetailDto
}

type TierRareDropEntry = {
  tier: DungeonTier
  drops: RareDropEntry[]
}

const EDITABLE_EXTRA_TIERS: DungeonTier[] = [1, 3]

export function RareDropsPage() {
  const [details, setDetails] = useState<DetailState[]>([])
  const [selectedAreaId, setSelectedAreaId] = useState<string>('')
  const [query, setQuery] = useState('')
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })
  const originalRef = useRef<string>('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoadState('loading')
        const listRes = await fetch('/api/dungeons')
        if (!listRes.ok) throw new Error(`dungeons 取得失敗: HTTP ${listRes.status}`)
        const summaries = (await listRes.json()) as DungeonSummary[]
        const loaded = await Promise.all(
          summaries.map(async (summary) => {
            const res = await fetch(`/api/dungeons/${summary.areaId}`)
            if (!res.ok) throw new Error(`${summary.areaId} 取得失敗: HTTP ${res.status}`)
            return { summary, detail: (await res.json()) as DungeonDetailDto }
          }),
        )
        if (cancelled) return
        setDetails(loaded)
        setSelectedAreaId(loaded[0]?.summary.areaId ?? '')
        originalRef.current = stableStringify(loaded)
        setLoadState('ready')
      } catch (err) {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : String(err))
        setLoadState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const isDirty = useMemo(
    () => loadState === 'ready' && stableStringify(details) !== originalRef.current,
    [details, loadState],
  )

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const selected = details.find((entry) => entry.summary.areaId === selectedAreaId) ?? null

  const filteredEnemies = useMemo(() => {
    const enemies = selected?.detail.enemy?.enemies ?? []
    const q = query.trim().toLowerCase()
    if (q === '') return enemies
    return enemies.filter(
      (enemy) =>
        enemy.id.toLowerCase().includes(q) ||
        enemy.name.toLowerCase().includes(q) ||
        enemy.raceTags.some((tag) => tag.toLowerCase().includes(q)),
    )
  }, [selected, query])

  const updateEnemy = useCallback(
    (
      areaId: string,
      enemyId: string,
      updater: (enemy: EnemyDatabase['enemies'][number]) => EnemyDatabase['enemies'][number],
    ) => {
      setDetails((prev) =>
        prev.map((entry) => {
          if (entry.summary.areaId !== areaId || !entry.detail.enemy) return entry
          return {
            ...entry,
            detail: {
              ...entry.detail,
              enemy: {
                ...entry.detail.enemy,
                enemies: entry.detail.enemy.enemies.map((enemy) =>
                  enemy.id === enemyId ? updater(enemy) : enemy,
                ),
              },
            },
          }
        }),
      )
      setSaveState({ kind: 'idle' })
    },
    [],
  )

  const saveAll = useCallback(async () => {
    const dirtyEntries = details.filter((entry) => {
      const original = (JSON.parse(originalRef.current || '[]') as DetailState[]).find(
        (item) => item.summary.areaId === entry.summary.areaId,
      )
      return stableStringify(original) !== stableStringify(entry)
    })
    if (dirtyEntries.length === 0) return

    for (const entry of dirtyEntries) {
      const areaResult = AreaConfigSchema.safeParse(entry.detail.area)
      const enemyResult = entry.detail.enemy ? EnemyDatabaseSchema.safeParse(entry.detail.enemy) : null
      if (!areaResult.success) {
        setSaveState({ kind: 'error', message: `${entry.summary.areaId}: area 検証失敗` })
        return
      }
      if (enemyResult && !enemyResult.success) {
        setSaveState({
          kind: 'error',
          message: `${entry.summary.areaId}: enemy 検証失敗 ${enemyResult.error.issues.map((i) => i.path.join('.')).join(' / ')}`,
        })
        return
      }
    }

    setSaveState({ kind: 'saving' })
    try {
      await Promise.all(
        dirtyEntries.map(async (entry) => {
          const res = await fetch(`/api/dungeons/${entry.summary.areaId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              area: entry.detail.area,
              enemy: entry.detail.enemy,
            }),
          })
          if (!res.ok) {
            const body = await res.json().catch(() => null)
            throw new Error(`${entry.summary.areaId}: ${body?.error ?? `HTTP ${res.status}`}`)
          }
        }),
      )
      originalRef.current = stableStringify(details)
      setSaveState({ kind: 'success' })
    } catch (err) {
      setSaveState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }, [details])

  const revert = useCallback(() => {
    setDetails(JSON.parse(originalRef.current || '[]') as DetailState[])
    setSaveState({ kind: 'idle' })
  }, [])

  if (loadState === 'loading') return <p className="state-msg">読み込み中…</p>
  if (loadState === 'error') return <p className="state-msg error">読み込みに失敗しました: {loadError}</p>

  return (
    <div className="rare-drops-page">
      <div className="detail-head">
        <div>
          <h2>レアアイテム管理</h2>
          <p className="subtle">
            通常は0〜1個、魔性と伝説は追加候補を設定できます。
          </p>
        </div>
        <div className="save-bar">
          {saveState.kind === 'saving' && <span className="subtle">保存中…</span>}
          {saveState.kind === 'success' && !isDirty && <span className="saved">保存しました</span>}
          {saveState.kind === 'error' && <span className="save-error">{saveState.message}</span>}
          <button className="btn ghost" disabled={!isDirty || saveState.kind === 'saving'} onClick={revert}>
            取り消し
          </button>
          <button className="btn primary" disabled={!isDirty || saveState.kind === 'saving'} onClick={saveAll}>
            まとめて保存
          </button>
        </div>
      </div>

      <div className="rare-drops-layout">
        <aside className="card rare-drops-sidebar">
          <h3>ダンジョン</h3>
          <div className="rare-drops-area-list">
            {details.map((entry) => {
              const enemyCount = entry.detail.enemy?.enemies.length ?? 0
              return (
                <button
                  key={entry.summary.areaId}
                  type="button"
                  className={selectedAreaId === entry.summary.areaId ? 'area-list-button active' : 'area-list-button'}
                  onClick={() => setSelectedAreaId(entry.summary.areaId)}
                >
                  <span>{entry.summary.name}</span>
                  <small>
                    Lv {entry.summary.areaLevel} / 敵 {enemyCount}
                  </small>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="card rare-drops-main">
          <div className="rare-drops-toolbar">
            <div>
              <h3>{selected?.summary.name ?? '未選択'}</h3>
              {selected && (
                <p className="subtle">
                  <code>{selected.summary.areaId}</code> · Lv {selected.summary.areaLevel}
                </p>
              )}
            </div>
            <input
              className="search-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="敵 id / name / raceTag で絞り込み"
            />
          </div>

          {!selected?.detail.enemy && <p className="subtle">敵データがありません。</p>}
          {selected?.detail.enemy && (
            <table className="enemy-table rare-drops-table">
              <thead>
                <tr>
                  <th>敵</th>
                  <th>通常</th>
                  <th>魔性 追加</th>
                  <th>伝説 追加</th>
                </tr>
              </thead>
              <tbody>
                {filteredEnemies.map((enemy) => (
                  <RareDropRow
                    key={enemy.id}
                    enemy={enemy}
                    onChange={(updater) => updateEnemy(selected.summary.areaId, enemy.id, updater)}
                  />
                ))}
                {filteredEnemies.length === 0 && (
                  <tr>
                    <td colSpan={4} className="subtle">該当する敵がいません</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  )
}

function RareDropRow({
  enemy,
  onChange,
}: {
  enemy: EnemyDatabase['enemies'][number]
  onChange: (updater: (enemy: EnemyDatabase['enemies'][number]) => EnemyDatabase['enemies'][number]) => void
}) {
  const typedEnemy = enemy as EnemyDatabase['enemies'][number] & {
    rareEquipmentDrops?: RareDropEntry[]
    tierRareEquipmentDrops?: TierRareDropEntry[]
  }
  const tierDrops = normalizeTierDrops(typedEnemy.tierRareEquipmentDrops)

  const setBaseDrop = (templateId: string) => {
    onChange((prev) => {
      const next = { ...prev } as typeof typedEnemy
      if (templateId === '') {
        delete next.rareEquipmentDrops
      } else {
        next.rareEquipmentDrops = [{ templateId }]
      }
      return next
    })
  }

  const setTierDrop = (tier: DungeonTier, templateId: string) => {
    onChange((prev) => {
      const next = { ...prev } as typeof typedEnemy
      const nextMap = normalizeTierDrops(next.tierRareEquipmentDrops)
      if (templateId === '') {
        nextMap.delete(tier)
      } else {
        nextMap.set(tier, [{ templateId }])
      }
      const tierRareEquipmentDrops = buildTierDrops(nextMap)
      if (tierRareEquipmentDrops) {
        next.tierRareEquipmentDrops = tierRareEquipmentDrops
      } else {
        delete next.tierRareEquipmentDrops
      }
      return next
    })
  }

  return (
    <tr>
      <td className="rare-drops-enemy-cell">
        <strong>{enemy.name}</strong>
        <span className="subtle"><code>{enemy.id}</code> / Lv {enemy.level}</span>
      </td>
      <td>
        <RareTemplateCell
          value={typedEnemy.rareEquipmentDrops?.[0]?.templateId ?? ''}
          onChange={setBaseDrop}
        />
      </td>
      <td>
        <RareTemplateCell
          value={tierDrops.get(1)?.[0]?.templateId ?? ''}
          onChange={(value) => setTierDrop(1, value)}
        />
      </td>
      <td>
        <RareTemplateCell
          value={tierDrops.get(3)?.[0]?.templateId ?? ''}
          onChange={(value) => setTierDrop(3, value)}
        />
      </td>
    </tr>
  )
}

function RareTemplateCell({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [templates, setTemplates] = useState<Awaited<ReturnType<typeof loadEquipmentTemplates>> | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadEquipmentTemplates()
      .then((loaded) => {
        if (!cancelled) setTemplates(loaded.filter((template) => template.isRare === true))
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loadError) return <span className="save-error">{loadError}</span>
  if (!templates) return <span className="subtle">読み込み中…</span>

  const selectedTemplate = templates.find((template) => template.id === value)

  return (
    <>
      <TemplateSelect value={value} templates={templates} onChange={onChange} />
      <EquipmentEffectSummary template={selectedTemplate} templateId={value} />
    </>
  )
}

function EquipmentEffectSummary({
  template,
  templateId,
}: {
  template: EquipmentTemplate | undefined
  templateId: string
}) {
  if (!templateId) return <p className="subtle rare-drop-effect-summary">未設定</p>
  if (!template) {
    return (
      <p className="save-error rare-drop-effect-summary">
        equipmentPool に存在しない templateId です: {templateId}
      </p>
    )
  }

  const effects = getEquipmentEffectLines(template)

  return (
    <div className="rare-drop-effect-summary">
      <div className="rare-drop-effect-title">
        <strong>{template.name}</strong>
        <span className="subtle">
          <code>{template.id}</code> · {template.category}
          {template.subCategory ? ` / ${template.subCategory}` : ''}
        </span>
      </div>
      {effects.length > 0 ? (
        <ul className="rare-drop-effect-list">
          {effects.map((effect, index) => (
            <li key={`${effect}-${index}`}>{effect}</li>
          ))}
        </ul>
      ) : (
        <p className="subtle">効果なし</p>
      )}
    </div>
  )
}

function getEquipmentEffectLines(template: EquipmentTemplate): string[] {
  const effects: string[] = []

  for (const bonus of template.statBonuses) {
    const source = [
      bonus.sourceCategory ? `カテゴリ:${bonus.sourceCategory}` : null,
      bonus.sourceSubCategory ? `サブ:${bonus.sourceSubCategory}` : null,
    ].filter(Boolean)
    effects.push(
      `${getEquipmentStatLabel(bonus.stat)} ${formatSignedValue(bonus.value)}${source.length > 0 ? ` (${source.join(' / ')})` : ''}`,
    )
  }

  if (template.range) {
    effects.push(`射程: ${template.range}`)
  }

  for (const skillId of template.grantedSkillIds ?? []) {
    effects.push(...getSkillEffectLines(skillId))
  }

  for (const skill of template.grantedSkills ?? []) {
    effects.push(...getInlineSkillEffectLines(skill))
  }

  return effects
}

function getSkillEffectLines(skillId: string): string[] {
  if (!skillId) return []
  if (!isCharacterSkillId(skillId)) return [`スキル: ${skillId} (catalog未登録)`]

  const skill = getCharacterSkillDefinition(skillId)
  return getInlineSkillEffectLines(skill)
}

function getInlineSkillEffectLines(skill: CharacterSkill): string[] {
  const label = getSkillLabel(skill) || skill.id
  const descriptions = getCharacterSkillEffectDescriptions(skill)
  return descriptions.map((description) => `スキル: ${label} - ${description}`)
}

function formatSignedValue(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}

function getEquipmentStatLabel(stat: EquipmentStat): string {
  return EQUIPMENT_STAT_LABELS[stat] ?? stat
}

function normalizeTierDrops(entries: TierRareDropEntry[] | undefined): Map<DungeonTier, RareDropEntry[]> {
  const map = new Map<DungeonTier, RareDropEntry[]>()
  for (const entry of entries ?? []) map.set(entry.tier, entry.drops ?? [])
  return map
}

function buildTierDrops(map: Map<DungeonTier, RareDropEntry[]>): TierRareDropEntry[] | undefined {
  const entries = EDITABLE_EXTRA_TIERS.flatMap((tier) => {
    const drops = map.get(tier)?.filter((drop) => drop.templateId.trim() !== '') ?? []
    return drops.length > 0 ? [{ tier, drops }] : []
  })
  return entries.length > 0 ? entries : undefined
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {}
      for (const k of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[k] = (val as Record<string, unknown>)[k]
      }
      return sorted
    }
    return val
  })
}

const EQUIPMENT_STAT_LABELS: Record<EquipmentStat, string> = {
  hp_flat: 'HP',
  atk_flat: '攻撃',
  def_flat: '防御',
  magic_atk_flat: '魔力',
  magic_def_flat: '魔防',
  attackCount_flat: '攻撃回数',
  accuracy_flat: '命中',
  evasion_flat: '回避',
  magicHeal_flat: '回復魔力',
  hp_percent: 'HP%',
  atk_percent: '攻撃%',
  def_percent: '防御%',
  critical_rate_percent: '会心率%',
  damage_reduction: '被ダメージ軽減',
}
