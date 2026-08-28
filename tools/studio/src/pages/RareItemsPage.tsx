import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DROP_RANK_TABLE,
  findStartStepIndex,
} from '@app/core/services/DropRankRoller'
import { getCharacterSkillDescription } from '@app/shared/data/characterSkills'
import {
  CHARACTER_SKILL_CATALOG,
  getCharacterSkillDefinition,
} from '@app/shared/data/skillCatalog'
import {
  DUNGEON_TIER_LIST,
  DUNGEON_TIER_META,
  DUNGEON_TIER_SCALING,
  getDungeonTierAreaLevel,
  type DungeonTier,
} from '@app/shared/types/DungeonTier'
import en from '@app/shared/i18n/resources/en'
import ja from '@app/shared/i18n/resources/ja'

import {
  AreaConfigSchema,
  EnemyDatabaseSchema,
  EquipmentPoolSchema,
  isEquipmentTemplate,
  type DungeonDetailDto,
  type DungeonSummary,
  type EquipmentPool,
  type EquipmentStat,
  type EquipmentStatBonus,
  type EquipmentTemplate,
  type EnemyDatabase,
} from '../lib/schema'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string }

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }
  | { kind: 'success' }

type DetailState = {
  summary: DungeonSummary
  detail: DungeonDetailDto
}

type ViewMode = 'items' | 'dungeons'

type DropAssignment = {
  areaId: string
  areaName: string
  enemyId: string
  enemyName: string
  tier: DungeonTier
}

type EnemyOption = DropAssignment & {
  value: string
  label: string
}

type EnemyWithRareDrops = EnemyDatabase['enemies'][number] & {
  rareEquipmentDrops?: Array<{ templateId: string }>
  tierRareEquipmentDrops?: Array<{ tier: DungeonTier; drops: Array<{ templateId: string }> }>
}

const EQUIPMENT_STATS: EquipmentStat[] = [
  'hp_flat',
  'atk_flat',
  'def_flat',
  'magic_atk_flat',
  'magic_def_flat',
  'attackCount_flat',
  'accuracy_flat',
  'evasion_flat',
  'magicHeal_flat',
  'critical_rate_percent',
  'damage_reduction',
]

const STAT_LABELS: Record<EquipmentStat, string> = {
  hp_flat: 'HP',
  atk_flat: '攻撃',
  def_flat: '防御',
  magic_atk_flat: '魔力',
  magic_def_flat: '魔防',
  attackCount_flat: '回数',
  accuracy_flat: '命中',
  evasion_flat: '回避',
  magicHeal_flat: '回復',
  hp_percent: 'HP%',
  atk_percent: '攻撃%',
  def_percent: '防御%',
  critical_rate_percent: '会心%',
  damage_reduction: '軽減',
}

const TIERS: DungeonTier[] = [0, 1, 2, 3, 4, 5]
const SKILL_IDS = Object.keys(CHARACTER_SKILL_CATALOG).sort()

export function RareItemsPage() {
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' })
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })
  const [pool, setPool] = useState<EquipmentPool | null>(null)
  const [details, setDetails] = useState<DetailState[]>([])
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('items')
  const [showUnassigned, setShowUnassigned] = useState(false)
  const originalRef = useRef<string>('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoadState({ kind: 'loading' })
        const [poolRes, listRes] = await Promise.all([
          fetch('/api/equipment-pool'),
          fetch('/api/dungeons'),
        ])
        if (!poolRes.ok) throw new Error(`equipment-pool 取得失敗: HTTP ${poolRes.status}`)
        if (!listRes.ok) throw new Error(`dungeons 取得失敗: HTTP ${listRes.status}`)

        const rawPool = await poolRes.json()
        const parsedPool = EquipmentPoolSchema.safeParse(rawPool)
        if (!parsedPool.success) {
          throw new Error(
            `equipment-pool 検証失敗: ${parsedPool.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' / ')}`,
          )
        }

        const summaries = (await listRes.json()) as DungeonSummary[]
        const loadedDetails = await Promise.all(
          summaries.map(async (summary) => {
            const res = await fetch(`/api/dungeons/${summary.areaId}`)
            if (!res.ok) throw new Error(`${summary.areaId} 取得失敗: HTTP ${res.status}`)
            return { summary, detail: (await res.json()) as DungeonDetailDto }
          }),
        )

        if (cancelled) return
        setPool(parsedPool.data)
        setDetails(loadedDetails)
        originalRef.current = stableStringify({ pool: parsedPool.data, details: loadedDetails })
        setLoadState({ kind: 'ready' })
      } catch (err) {
        if (!cancelled) {
          setLoadState({
            kind: 'error',
            message: err instanceof Error ? err.message : String(err),
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const assignmentsByTemplate = useMemo(() => buildAssignmentMap(details), [details])
  const enemyOptions = useMemo(() => buildEnemyOptions(details), [details])
  const templateById = useMemo(() => buildTemplateMap(pool), [pool])

  const rareItems = useMemo(() => {
    if (!pool) return []
    const q = query.trim().toLowerCase()
    return pool.templates
      .filter(isEquipmentTemplate)
      .filter((template) => template.isRare === true)
      .filter((template) => {
        if (q === '') return true
        return (
          template.id.toLowerCase().includes(q) ||
          template.name.toLowerCase().includes(q) ||
          template.category.toLowerCase().includes(q) ||
          (template.subCategory ?? '').toLowerCase().includes(q) ||
          (template.grantedSkillIds ?? []).some((skillId) => {
            const labels = getSkillDisplayInfo(skillId)
            return (
              skillId.toLowerCase().includes(q) ||
              labels.ja.toLowerCase().includes(q) ||
              labels.en.toLowerCase().includes(q) ||
              labels.description.toLowerCase().includes(q)
            )
          })
        )
      })
      .filter((template) => showUnassigned || (assignmentsByTemplate.get(template.id)?.length ?? 0) > 0)
      .sort((a, b) => {
        const aAssigned = (assignmentsByTemplate.get(a.id)?.length ?? 0) > 0
        const bAssigned = (assignmentsByTemplate.get(b.id)?.length ?? 0) > 0
        if (aAssigned !== bAssigned) return aAssigned ? -1 : 1
        return a.id.localeCompare(b.id)
      })
  }, [assignmentsByTemplate, pool, query, showUnassigned])

  const isDirty = useMemo(() => {
    if (loadState.kind !== 'ready' || !pool) return false
    return stableStringify({ pool, details }) !== originalRef.current
  }, [details, loadState.kind, pool])

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const updateTemplate = useCallback((templateId: string, updater: (prev: EquipmentTemplate) => EquipmentTemplate) => {
    setPool((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        templates: prev.templates.map((entry) => {
          if (!isEquipmentTemplate(entry) || entry.id !== templateId) return entry
          return updater(entry)
        }),
      }
    })
    setSaveState({ kind: 'idle' })
  }, [])

  const setDropAssignments = useCallback((templateId: string, assignments: DropAssignment[]) => {
    setDetails((prev) => {
      let next = removeTemplateFromDetails(prev, templateId)
      for (const assignment of assignments) {
        next = addTemplateToEnemy(
          next,
          assignment.areaId,
          assignment.enemyId,
          templateId,
          assignment.tier,
        )
      }
      return next
    })
    setSaveState({ kind: 'idle' })
  }, [])

  const saveAll = useCallback(async () => {
    if (!pool) return

    const parsedPool = EquipmentPoolSchema.safeParse(pool)
    if (!parsedPool.success) {
      setSaveState({
        kind: 'error',
        message: `equipment-pool 検証失敗: ${parsedPool.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' / ')}`,
      })
      return
    }

    for (const entry of details) {
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

    const original = JSON.parse(originalRef.current || '{}') as {
      pool?: EquipmentPool
      details?: DetailState[]
    }
    const poolDirty = stableStringify(pool) !== stableStringify(original.pool)
    const dirtyDetails = details.filter((entry) => {
      const originalEntry = original.details?.find((item) => item.summary.areaId === entry.summary.areaId)
      return stableStringify(entry) !== stableStringify(originalEntry)
    })

    setSaveState({ kind: 'saving' })
    try {
      if (poolDirty) {
        const res = await fetch('/api/equipment-pool', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pool),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(`equipment-pool: ${body?.error ?? `HTTP ${res.status}`}`)
        }
      }
      await Promise.all(
        dirtyDetails.map(async (entry) => {
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
      originalRef.current = stableStringify({ pool, details })
      setSaveState({ kind: 'success' })
    } catch (err) {
      setSaveState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }, [details, pool])

  const revert = useCallback(() => {
    if (!originalRef.current) return
    const original = JSON.parse(originalRef.current) as { pool: EquipmentPool; details: DetailState[] }
    setPool(original.pool)
    setDetails(original.details)
    setSaveState({ kind: 'idle' })
  }, [])

  if (loadState.kind === 'loading') return <p className="state-msg">読み込み中…</p>
  if (loadState.kind === 'error') {
    return <p className="state-msg error">読み込みに失敗しました: {loadState.message}</p>
  }
  if (!pool) return null

  const rareCount = pool.templates.filter(isEquipmentTemplate).filter((t) => t.isRare === true).length
  const assignedRareCount = pool.templates
    .filter(isEquipmentTemplate)
    .filter((t) => t.isRare === true && (assignmentsByTemplate.get(t.id)?.length ?? 0) > 0).length

  return (
    <div className="detail rare-items-page">
      <div className="detail-head">
        <div>
          <h2>レアアイテム一覧</h2>
          <p className="subtle">
            equipmentPool.json · ドロップ設定 {assignedRareCount} 件 / レア {rareCount} 件
          </p>
        </div>
        <SaveBar isDirty={isDirty} saveState={saveState} onSave={saveAll} onRevert={revert} />
      </div>

      <div className="equipment-toolbar rare-items-toolbar">
        <div className="rare-items-view-switch" role="tablist" aria-label="レアアイテム表示切替">
          <button
            type="button"
            className={viewMode === 'items' ? 'selected' : ''}
            onClick={() => setViewMode('items')}
          >
            アイテム別
          </button>
          <button
            type="button"
            className={viewMode === 'dungeons' ? 'selected' : ''}
            onClick={() => setViewMode('dungeons')}
          >
            ダンジョン別
          </button>
        </div>
        <input
          type="search"
          placeholder="id / name / category / skill / 効果で絞り込み"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
        />
        {viewMode === 'items' && (
          <label className="rare-items-toggle subtle">
            <input
              type="checkbox"
              checked={showUnassigned}
              onChange={(e) => setShowUnassigned(e.target.checked)}
            />
            未割り当て候補も表示
          </label>
        )}
      </div>

      {viewMode === 'items' ? (
        <RareItemEditTable
          rareItems={rareItems}
          assignmentsByTemplate={assignmentsByTemplate}
          enemyOptions={enemyOptions}
          updateTemplate={updateTemplate}
          setDropAssignments={setDropAssignments}
        />
      ) : (
        <DungeonRareDistributionView details={details} query={query} templateById={templateById} />
      )}
      <datalist id="rare-item-skill-ids">
        {SKILL_IDS.map((skillId) => (
          <option key={skillId} value={skillId} label={formatSkillDatalistLabel(skillId)} />
        ))}
      </datalist>
    </div>
  )
}

function RareItemEditTable({
  rareItems,
  assignmentsByTemplate,
  enemyOptions,
  updateTemplate,
  setDropAssignments,
}: {
  rareItems: EquipmentTemplate[]
  assignmentsByTemplate: Map<string, DropAssignment[]>
  enemyOptions: EnemyOption[]
  updateTemplate: (templateId: string, updater: (prev: EquipmentTemplate) => EquipmentTemplate) => void
  setDropAssignments: (templateId: string, assignments: DropAssignment[]) => void
}) {
  return (
    <div className="rare-items-table-wrap">
      <table className="enemy-table rare-items-table">
        <thead>
          <tr>
            <th className="rare-items-name-col">アイテム名</th>
            <th className="rare-items-drop-col">ドロップ設定</th>
            {EQUIPMENT_STATS.map((stat) => (
              <th key={stat} className="num rare-items-stat-col" title={stat}>
                {STAT_LABELS[stat]}
              </th>
            ))}
            {[0, 1, 2, 3].map((index) => (
              <th key={index} className="rare-items-skill-col">スキル{index + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rareItems.map((template) => {
            const assignments = assignmentsByTemplate.get(template.id) ?? []
            return (
              <tr key={template.id}>
                <td className="rare-items-name-cell">
                  <input
                    value={template.name}
                    onChange={(e) =>
                      updateTemplate(template.id, (prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                  <span className="subtle">
                    <code>{template.id}</code> · {template.category}
                    {template.subCategory ? ` / ${template.subCategory}` : ''}
                  </span>
                </td>
                <td>
                  <DropAssignmentsCell
                    assignments={assignments}
                    enemyOptions={enemyOptions}
                    onChange={(next) => setDropAssignments(template.id, next)}
                  />
                </td>
                {EQUIPMENT_STATS.map((stat) => (
                  <td key={stat} className="num">
                    <input
                      className="rare-items-number-input"
                      type="number"
                      step="0.1"
                      value={getDirectStatValue(template.statBonuses, stat)}
                      onChange={(e) =>
                        updateTemplate(template.id, (prev) => ({
                          ...prev,
                          statBonuses: setDirectStatValue(prev.statBonuses, stat, e.target.value),
                        }))
                      }
                    />
                  </td>
                ))}
                {[0, 1, 2, 3].map((index) => (
                  <td key={index} className="rare-items-skill-cell">
                    <input
                      list="rare-item-skill-ids"
                      value={template.grantedSkillIds?.[index] ?? ''}
                      onChange={(e) =>
                        updateTemplate(template.id, (prev) => ({
                          ...prev,
                          ...buildGrantedSkillPatch(prev.grantedSkillIds ?? [], index, e.target.value),
                        }))
                      }
                    />
                    <SkillNameHint skillId={template.grantedSkillIds?.[index] ?? ''} />
                  </td>
                ))}
              </tr>
            )
          })}
          {rareItems.length === 0 && (
            <tr>
              <td colSpan={2 + EQUIPMENT_STATS.length + 4} className="subtle">
                該当するレアアイテムがありません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

type DistributionDrop = {
  templateId: string
  enemyId: string
  enemyName: string
  addedTier: DungeonTier
}

type DistributionRow = {
  areaId: string
  areaName: string
  baseAreaLevel: number
  tier: DungeonTier
  effectiveAreaLevel: number
  maxEnemyLevel: number
  maxEffectiveEnemyLevel: number
  maxNormalRank: number
  drops: DistributionDrop[]
}

function DungeonRareDistributionView({
  details,
  query,
  templateById,
}: {
  details: DetailState[]
  query: string
  templateById: Map<string, EquipmentTemplate>
}) {
  const rows = useMemo(
    () => buildDistributionRows(details, templateById, query),
    [details, query, templateById],
  )

  return (
    <section className="rare-distribution">
      <div className="rare-distribution-head">
        <div>
          <h3>ダンジョン別レア分布</h3>
          <p className="subtle">
            難易度は Tier 反映後の実効エリアLvです。レアは通常Tier分に、現在Tierまでの追加分を累積して表示します。
          </p>
        </div>
        <span className="subtle">{rows.length} 行</span>
      </div>
      <div className="rare-items-table-wrap">
        <table className="enemy-table rare-distribution-table">
          <thead>
            <tr>
              <th className="rare-distribution-dungeon-col">ダンジョン</th>
              <th>Tier</th>
              <th className="num">難易度</th>
              <th className="num">敵Lv</th>
              <th className="num">通常rank</th>
              <th>レアアイテム</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.areaId}-${row.tier}`}>
                <td>
                  <strong>{row.areaName}</strong>
                  <div className="subtle">
                    <code>{row.areaId}</code> · base Lv {row.baseAreaLevel}
                  </div>
                </td>
                <td>{getTierLabel(row.tier)}</td>
                <td className="num">{row.effectiveAreaLevel}</td>
                <td className="num">
                  {row.maxEffectiveEnemyLevel}
                  <div className="subtle">base {row.maxEnemyLevel}</div>
                </td>
                <td className="num">{row.maxNormalRank}</td>
                <td>
                  {row.drops.length > 0 ? (
                    <div className="rare-distribution-drop-list">
                      {row.drops.map((drop) => (
                        <DistributionDropCard
                          key={`${drop.enemyId}-${drop.templateId}-${drop.addedTier}`}
                          drop={drop}
                          template={templateById.get(drop.templateId)}
                          currentTier={row.tier}
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="subtle">なし</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="subtle">該当するダンジョン/レアアイテムがありません</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function DistributionDropCard({
  drop,
  template,
  currentTier,
}: {
  drop: DistributionDrop
  template: EquipmentTemplate | undefined
  currentTier: DungeonTier
}) {
  const isNewAtTier = drop.addedTier === currentTier && currentTier !== 0
  return (
    <div className={`rare-distribution-drop ${isNewAtTier ? 'new' : ''}`}>
      <div>
        <strong>{template?.name ?? drop.templateId}</strong>
        {isNewAtTier && <span className="rare-distribution-new-badge">追加</span>}
      </div>
      <div className="subtle">
        {drop.enemyName} <code>{drop.enemyId}</code>
      </div>
      {template ? (
        <>
          <div className="subtle">
            {template.category}
            {template.subCategory ? ` / ${template.subCategory}` : ''}
            {template.price !== undefined ? ` · ${template.price}G` : ''}
          </div>
          <div className="rare-distribution-item-meta">
            {formatTemplateStats(template)}
            {formatTemplateSkills(template)}
          </div>
        </>
      ) : (
        <div className="invalid-cell">未登録 templateId</div>
      )}
    </div>
  )
}

function SkillNameHint({ skillId }: { skillId: string }) {
  if (skillId.trim() === '') return null
  const labels = getSkillDisplayInfo(skillId)
  return (
    <div className="rare-items-skill-hint">
      <span>{labels.ja}</span>
      <span>{labels.en}</span>
      {labels.description && <span className="rare-items-skill-effect">{labels.description}</span>}
    </div>
  )
}

function getSkillDisplayInfo(skillId: string): { ja: string; en: string; description: string } {
  const key = skillId as keyof typeof ja.entities.skill
  const skill = CHARACTER_SKILL_CATALOG[skillId as keyof typeof CHARACTER_SKILL_CATALOG]
  return {
    ja: ja.entities.skill[key]?.name ?? skillId,
    en: en.entities.skill[key as keyof typeof en.entities.skill]?.name ?? skillId,
    description: skill ? getCharacterSkillDescription(getCharacterSkillDefinition(skillId)) : '',
  }
}

function formatSkillDatalistLabel(skillId: string): string {
  const labels = getSkillDisplayInfo(skillId)
  return `${labels.ja} / ${labels.en}`
}

function SaveBar({
  isDirty,
  saveState,
  onSave,
  onRevert,
}: {
  isDirty: boolean
  saveState: SaveState
  onSave: () => void
  onRevert: () => void
}) {
  return (
    <div className="save-bar">
      {saveState.kind === 'saving' && <span className="subtle">保存中…</span>}
      {saveState.kind === 'success' && !isDirty && <span className="saved">保存しました</span>}
      {saveState.kind === 'error' && <span className="save-error">{saveState.message}</span>}
      <button className="btn ghost" onClick={onRevert} disabled={!isDirty || saveState.kind === 'saving'}>
        取り消し
      </button>
      <button className="btn primary" onClick={onSave} disabled={!isDirty || saveState.kind === 'saving'}>
        保存
      </button>
    </div>
  )
}

function DropAssignmentsCell({
  assignments,
  enemyOptions,
  onChange,
}: {
  assignments: DropAssignment[]
  enemyOptions: EnemyOption[]
  onChange: (assignments: DropAssignment[]) => void
}) {
  const updateAt = (index: number, assignment: DropAssignment) => {
    onChange(assignments.map((entry, entryIndex) => (entryIndex === index ? assignment : entry)))
  }
  const removeAt = (index: number) => {
    onChange(assignments.filter((_, entryIndex) => entryIndex !== index))
  }
  const add = () => {
    const option = enemyOptions[0]
    if (!option) return
    onChange([...assignments, toAssignment(option, 0)])
  }

  return (
    <div className="rare-items-drop-editor">
      {assignments.map((assignment, index) => {
        const value = assignmentToEnemyValue(assignment)
        return (
          <div className="rare-items-drop-row" key={`${value}-${assignment.tier}-${index}`}>
            <select
              value={value}
              onChange={(e) => {
                const option = enemyOptions.find((candidate) => candidate.value === e.target.value)
                if (!option) return
                updateAt(index, toAssignment(option, assignment.tier))
              }}
            >
              {value && !enemyOptions.some((option) => option.value === value) && (
                <option value={value}>
                  {assignment.enemyName} / {assignment.areaName} ({assignment.enemyId})
                </option>
              )}
              {enemyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="rare-items-tier-select"
              value={assignment.tier}
              onChange={(e) =>
                updateAt(index, {
                  ...assignment,
                  tier: Number(e.target.value) as DungeonTier,
                })
              }
            >
              {TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  {getTierLabel(tier)}
                </option>
              ))}
            </select>
            <button className="icon-btn danger" type="button" onClick={() => removeAt(index)}>
              ×
            </button>
          </div>
        )
      })}
      {assignments.length === 0 && <p className="subtle rare-items-empty-drop">未設定</p>}
      <button className="btn ghost small rare-items-add-drop" type="button" onClick={add} disabled={enemyOptions.length === 0}>
        + 追加
      </button>
    </div>
  )
}

function buildTemplateMap(pool: EquipmentPool | null): Map<string, EquipmentTemplate> {
  const map = new Map<string, EquipmentTemplate>()
  for (const template of pool?.templates ?? []) {
    if (isEquipmentTemplate(template)) map.set(template.id, template)
  }
  return map
}

function buildDistributionRows(
  details: DetailState[],
  templateById: Map<string, EquipmentTemplate>,
  query: string,
): DistributionRow[] {
  const normalizedQuery = query.trim().toLowerCase()
  const rows: DistributionRow[] = []

  for (const entry of details) {
    const enemies = entry.detail.enemy?.enemies ?? []
    const maxEnemyLevel = enemies.length > 0 ? Math.max(...enemies.map((enemy) => enemy.level)) : 0

    for (const tier of DUNGEON_TIER_LIST) {
      const drops = collectDistributionDrops(enemies as EnemyWithRareDrops[], tier)
      const row: DistributionRow = {
        areaId: entry.summary.areaId,
        areaName: entry.summary.name,
        baseAreaLevel: entry.summary.areaLevel,
        tier,
        effectiveAreaLevel: getDungeonTierAreaLevel(entry.summary.areaLevel, tier),
        maxEnemyLevel,
        maxEffectiveEnemyLevel: getEffectiveEnemyLevel(maxEnemyLevel, tier),
        maxNormalRank: getMaxRankForLevel(getEffectiveEnemyLevel(maxEnemyLevel, tier)),
        drops,
      }

      if (matchesDistributionRow(row, templateById, normalizedQuery)) {
        rows.push({
          ...row,
          drops: normalizedQuery === ''
            ? row.drops
            : row.drops.filter((drop) => matchesDistributionDrop(drop, templateById, normalizedQuery)),
        })
      }
    }
  }

  return rows.sort((a, b) => (
    a.effectiveAreaLevel - b.effectiveAreaLevel ||
    a.baseAreaLevel - b.baseAreaLevel ||
    a.areaId.localeCompare(b.areaId) ||
    a.tier - b.tier
  ))
}

function collectDistributionDrops(enemies: EnemyWithRareDrops[], tier: DungeonTier): DistributionDrop[] {
  const drops: DistributionDrop[] = []
  const seen = new Set<string>()
  for (const enemy of enemies) {
    for (const drop of enemy.rareEquipmentDrops ?? []) {
      addDistributionDrop(drops, seen, drop.templateId, enemy, 0)
    }
    for (const tierEntry of enemy.tierRareEquipmentDrops ?? []) {
      if (tierEntry.tier > tier) continue
      for (const drop of tierEntry.drops ?? []) {
        addDistributionDrop(drops, seen, drop.templateId, enemy, tierEntry.tier)
      }
    }
  }
  return drops.sort((a, b) => (
    a.addedTier - b.addedTier ||
    a.enemyName.localeCompare(b.enemyName) ||
    a.templateId.localeCompare(b.templateId)
  ))
}

function addDistributionDrop(
  drops: DistributionDrop[],
  seen: Set<string>,
  templateId: string,
  enemy: EnemyWithRareDrops,
  addedTier: DungeonTier,
) {
  const key = `${enemy.id}::${templateId}::${addedTier}`
  if (seen.has(key)) return
  seen.add(key)
  drops.push({
    templateId,
    enemyId: enemy.id,
    enemyName: enemy.name,
    addedTier,
  })
}

function matchesDistributionRow(
  row: DistributionRow,
  templateById: Map<string, EquipmentTemplate>,
  query: string,
): boolean {
  if (query === '') return true
  if (
    row.areaId.toLowerCase().includes(query) ||
    row.areaName.toLowerCase().includes(query) ||
    getTierLabel(row.tier).toLowerCase().includes(query)
  ) {
    return true
  }
  return row.drops.some((drop) => matchesDistributionDrop(drop, templateById, query))
}

function matchesDistributionDrop(
  drop: DistributionDrop,
  templateById: Map<string, EquipmentTemplate>,
  query: string,
): boolean {
  const template = templateById.get(drop.templateId)
  return (
    drop.enemyId.toLowerCase().includes(query) ||
    drop.enemyName.toLowerCase().includes(query) ||
    drop.templateId.toLowerCase().includes(query) ||
    (template ? matchesTemplate(template, query) : false)
  )
}

function matchesTemplate(template: EquipmentTemplate, query: string): boolean {
  return (
    template.id.toLowerCase().includes(query) ||
    template.name.toLowerCase().includes(query) ||
    template.category.toLowerCase().includes(query) ||
    (template.subCategory ?? '').toLowerCase().includes(query) ||
    formatTemplateStats(template).toLowerCase().includes(query) ||
    formatTemplateSkills(template).toLowerCase().includes(query) ||
    (template.grantedSkillIds ?? []).some((skillId) => {
      const info = getSkillDisplayInfo(skillId)
      return (
        skillId.toLowerCase().includes(query) ||
        info.ja.toLowerCase().includes(query) ||
        info.en.toLowerCase().includes(query) ||
        info.description.toLowerCase().includes(query)
      )
    })
  )
}

function getMaxRankForLevel(level: number): number {
  const idx = findStartStepIndex(level)
  return DROP_RANK_TABLE[idx]?.rank ?? 0
}

function getEffectiveEnemyLevel(baseLevel: number, tier: DungeonTier): number {
  const scaling = DUNGEON_TIER_SCALING[tier]
  return Math.floor(baseLevel * scaling.statScale) + scaling.levelBonus
}

function formatTemplateStats(template: EquipmentTemplate): string {
  const stats = (template.statBonuses ?? [])
    .filter(isDirectStatBonus)
    .map((bonus) => `${STAT_LABELS[bonus.stat] ?? bonus.stat}${bonus.value >= 0 ? '+' : ''}${bonus.value}`)
  return stats.length > 0 ? stats.join(' / ') : 'ステータスなし'
}

function formatTemplateSkills(template: EquipmentTemplate): string {
  const skills = (template.grantedSkillIds ?? [])
    .map((skillId) => getSkillDisplayInfo(skillId))
    .map((info) => `${info.ja}${info.description ? `: ${info.description}` : ''}`)
  return skills.length > 0 ? skills.join(' / ') : 'スキルなし'
}

function buildAssignmentMap(details: DetailState[]): Map<string, DropAssignment[]> {
  const map = new Map<string, DropAssignment[]>()
  for (const entry of details) {
    for (const enemy of entry.detail.enemy?.enemies ?? []) {
      const typedEnemy = enemy as EnemyWithRareDrops
      for (const drop of typedEnemy.rareEquipmentDrops ?? []) {
        addAssignment(map, drop.templateId, entry, typedEnemy, 0)
      }
      for (const tierEntry of typedEnemy.tierRareEquipmentDrops ?? []) {
        for (const drop of tierEntry.drops ?? []) {
          addAssignment(map, drop.templateId, entry, typedEnemy, tierEntry.tier)
        }
      }
    }
  }
  return map
}

function addAssignment(
  map: Map<string, DropAssignment[]>,
  templateId: string,
  entry: DetailState,
  enemy: EnemyWithRareDrops,
  tier: DungeonTier,
) {
  const assignments = map.get(templateId) ?? []
  assignments.push({
    areaId: entry.summary.areaId,
    areaName: entry.summary.name,
    enemyId: enemy.id,
    enemyName: enemy.name,
    tier,
  })
  map.set(templateId, assignments)
}

function buildEnemyOptions(details: DetailState[]): EnemyOption[] {
  return details.flatMap((entry) =>
    (entry.detail.enemy?.enemies ?? []).map((enemy) => ({
      areaId: entry.summary.areaId,
      areaName: entry.summary.name,
      enemyId: enemy.id,
      enemyName: enemy.name,
      tier: 0,
      value: `${entry.summary.areaId}::${enemy.id}`,
      label: `${enemy.name} / ${entry.summary.name} (${enemy.id})`,
    })),
  )
}

function toAssignment(option: EnemyOption, tier: DungeonTier): DropAssignment {
  return {
    areaId: option.areaId,
    areaName: option.areaName,
    enemyId: option.enemyId,
    enemyName: option.enemyName,
    tier,
  }
}

function assignmentToEnemyValue(assignment: DropAssignment): string {
  return `${assignment.areaId}::${assignment.enemyId}`
}

function removeTemplateFromDetails(details: DetailState[], templateId: string): DetailState[] {
  return details.map((entry) => {
    if (!entry.detail.enemy) return entry
    return {
      ...entry,
      detail: {
        ...entry.detail,
        enemy: {
          ...entry.detail.enemy,
          enemies: entry.detail.enemy.enemies.map((enemy) => removeTemplateFromEnemy(enemy, templateId)),
        },
      },
    }
  })
}

function removeTemplateFromEnemy(
  enemy: EnemyDatabase['enemies'][number],
  templateId: string,
): EnemyDatabase['enemies'][number] {
  const next = { ...enemy } as EnemyWithRareDrops
  const rareEquipmentDrops = (next.rareEquipmentDrops ?? []).filter((drop) => drop.templateId !== templateId)
  if (rareEquipmentDrops.length > 0) next.rareEquipmentDrops = rareEquipmentDrops
  else delete next.rareEquipmentDrops

  const tierRareEquipmentDrops = (next.tierRareEquipmentDrops ?? [])
    .map((entry) => ({
      ...entry,
      drops: (entry.drops ?? []).filter((drop) => drop.templateId !== templateId),
    }))
    .filter((entry) => entry.drops.length > 0)
  if (tierRareEquipmentDrops.length > 0) next.tierRareEquipmentDrops = tierRareEquipmentDrops
  else delete next.tierRareEquipmentDrops

  return next
}

function addTemplateToEnemy(
  details: DetailState[],
  areaId: string,
  enemyId: string,
  templateId: string,
  tier: DungeonTier,
): DetailState[] {
  return details.map((entry) => {
    if (entry.summary.areaId !== areaId || !entry.detail.enemy) return entry
    return {
      ...entry,
      detail: {
        ...entry.detail,
        enemy: {
          ...entry.detail.enemy,
          enemies: entry.detail.enemy.enemies.map((enemy) => {
            if (enemy.id !== enemyId) return enemy
            const next = { ...enemy } as EnemyWithRareDrops
            if (tier === 0) {
              next.rareEquipmentDrops = [...(next.rareEquipmentDrops ?? []), { templateId }]
              return next
            }
            const tierEntries = [...(next.tierRareEquipmentDrops ?? [])]
            const index = tierEntries.findIndex((entry) => entry.tier === tier)
            if (index >= 0) {
              tierEntries[index] = {
                ...tierEntries[index],
                drops: [...(tierEntries[index].drops ?? []), { templateId }],
              }
            } else {
              tierEntries.push({ tier, drops: [{ templateId }] })
              tierEntries.sort((a, b) => a.tier - b.tier)
            }
            next.tierRareEquipmentDrops = tierEntries
            return next
          }),
        },
      },
    }
  })
}

function getDirectStatValue(bonuses: EquipmentStatBonus[], stat: EquipmentStat): string {
  const value = bonuses
    .filter((bonus) => isDirectStatBonus(bonus) && bonus.stat === stat)
    .reduce((sum, bonus) => sum + bonus.value, 0)
  return value === 0 ? '' : String(value)
}

function setDirectStatValue(
  bonuses: EquipmentStatBonus[],
  stat: EquipmentStat,
  rawValue: string,
): EquipmentStatBonus[] {
  const value = rawValue.trim() === '' ? null : Number(rawValue)
  const preserved = bonuses.filter((bonus) => !isDirectStatBonus(bonus) || bonus.stat !== stat)
  if (value === null || Number.isNaN(value)) return preserved
  return [...preserved, { stat, value }]
}

function isDirectStatBonus(bonus: EquipmentStatBonus): boolean {
  return bonus.sourceCategory === undefined && bonus.sourceSubCategory === undefined
}

function buildGrantedSkillPatch(
  skillIds: string[],
  index: number,
  value: string,
): Pick<EquipmentTemplate, 'grantedSkillIds'> | Record<string, never> {
  const next = skillIds.slice(0, 4)
  while (next.length <= index) next.push('')
  next[index] = value
  const compacted = next.map((skillId) => skillId.trim()).filter((skillId) => skillId !== '')
  if (compacted.length === 0) return { grantedSkillIds: undefined } as Pick<EquipmentTemplate, 'grantedSkillIds'>
  return { grantedSkillIds: compacted }
}

function getTierLabel(tier: DungeonTier): string {
  const meta = DUNGEON_TIER_META[tier]
  if (!meta?.prefix) return '通常'
  return `Tier ${tier} ${meta.prefix}`
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
