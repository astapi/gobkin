import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  findThresholdLevel,
  runScenarioMatrix,
  type BalanceScenario,
  type EquipmentFilter,
  type ScenarioLoadout,
  type ScenarioMatrixResult,
  type ScenarioPartyMember,
} from '../lib/runBalanceReference'
import { PartyStatsPreview } from '../components/PartyStatsPreview'

interface ScenarioSummary {
  scenarioId: string
  areaId: string
  description?: string
  iterations?: number
  levelRange?: { min: number; max: number; step?: number }
  loadoutCount: number
}

interface EquipmentTemplate {
  id: string
  name: string
  category?: string
  subCategory?: string
  unlockRank?: number
  rank?: number
}

function applyEquipmentFilter(
  templates: EquipmentTemplate[],
  filter: EquipmentFilter | undefined,
): EquipmentTemplate[] {
  if (!filter) return templates
  const allow = filter.allowIds ? new Set(filter.allowIds) : null
  const deny = filter.denyIds ? new Set(filter.denyIds) : null
  return templates.filter((t) => {
    if (allow && allow.has(t.id)) return true
    if (deny && deny.has(t.id)) return false
    if (filter.maxUnlockRank !== undefined && t.unlockRank !== undefined) {
      if (t.unlockRank > filter.maxUnlockRank) return false
    }
    if (filter.maxDropRank !== undefined && t.rank !== undefined) {
      if (t.rank > filter.maxDropRank) return false
    }
    return true
  })
}

interface DungeonSummary {
  areaId: string
  name: string
}

interface VariantOption {
  factorId: string
  raceName: string
}

const JOB_OPTIONS = ['', 'warrior', 'guard', 'thief', 'mage', 'cleric', 'rider'] as const

const THRESHOLDS = [0.8, 0.5] as const

export function BalanceReferencePage() {
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([])
  const [scenarioId, setScenarioId] = useState<string>('')
  const [scenario, setScenario] = useState<BalanceScenario | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [iterations, setIterations] = useState<number>(150)
  const [levelMin, setLevelMin] = useState<number>(5)
  const [levelMax, setLevelMax] = useState<number>(25)
  const [step, setStep] = useState<number>(1)
  const [seed, setSeed] = useState<number>(1)
  const [previewLevel, setPreviewLevel] = useState<number>(5)

  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<ScenarioMatrixResult | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  const [equipmentList, setEquipmentList] = useState<EquipmentTemplate[]>([])
  const [dungeons, setDungeons] = useState<DungeonSummary[]>([])
  const [variants, setVariants] = useState<VariantOption[]>([])

  // load scenarios + equipment + dungeons
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [scenRes, eqRes, dgRes, gobRes] = await Promise.all([
          fetch('/api/balance-scenarios'),
          fetch('/api/equipment-pool'),
          fetch('/api/dungeons'),
          fetch('/api/goblin-data'),
        ])
        if (!scenRes.ok) throw new Error(`scenarios HTTP ${scenRes.status}`)
        const scenarios = (await scenRes.json()) as ScenarioSummary[]
        if (cancelled) return
        setScenarios(scenarios)
        if (scenarios.length > 0 && !scenarioId) setScenarioId(scenarios[0].scenarioId)

        if (eqRes.ok) {
          const pool = (await eqRes.json()) as { templates: EquipmentTemplate[] }
          if (!cancelled) {
            setEquipmentList(
              pool.templates.filter((t) => typeof t.id === 'string'),
            )
          }
        }
        if (dgRes.ok) {
          const dlist = (await dgRes.json()) as DungeonSummary[]
          if (!cancelled) setDungeons(dlist)
        }
        if (gobRes.ok) {
          const data = (await gobRes.json()) as {
            variants: Array<{ factorId: string; raceName: string }>
          }
          if (!cancelled) {
            setVariants(
              (data.variants ?? []).map((v) => ({
                factorId: v.factorId,
                raceName: v.raceName,
              })),
            )
          }
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err))
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // load chosen scenario
  useEffect(() => {
    if (!scenarioId) return
    let cancelled = false
    ;(async () => {
      try {
        setResult(null)
        const res = await fetch(`/api/balance-scenarios/${scenarioId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as BalanceScenario
        if (cancelled) return
        setScenario(data)
        setIterations(data.iterations ?? 150)
        setLevelMin(data.levelRange?.min ?? 5)
        setLevelMax(data.levelRange?.max ?? 25)
        setPreviewLevel(data.levelRange?.min ?? 5)
        setStep(data.levelRange?.step ?? 1)
        setLoadError(null)
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [scenarioId])

  const updateScenario = useCallback((mutator: (s: BalanceScenario) => BalanceScenario) => {
    setScenario((prev) => (prev ? mutator(prev) : prev))
  }, [])

  const handleSave = useCallback(async () => {
    if (!scenario || !scenarioId) return
    setSaving(true)
    setSaveError(null)
    try {
      const body: BalanceScenario = {
        ...scenario,
        iterations,
        levelRange: { min: levelMin, max: levelMax, step },
      }
      const res = await fetch(`/api/balance-scenarios/${scenarioId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [scenario, scenarioId, iterations, levelMin, levelMax, step])

  const handleRun = useCallback(async () => {
    if (!scenario) return
    setRunning(true)
    setRunError(null)
    setResult(null)
    setProgress({ done: 0, total: 0 })
    try {
      const res = await runScenarioMatrix({
        scenario,
        iterations,
        levelMin,
        levelMax,
        step,
        seed,
        onProgress: (done, total) => setProgress({ done, total }),
      })
      setResult(res)
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }, [scenario, iterations, levelMin, levelMax, step, seed])

  return (
    <div className="panel-stack">
      <section className="card">
        <h2>バランス基準シミュレーション</h2>
        <p className="subtle">
          `scripts/balance/scenarios/*.json` のシナリオを編集し、ブラウザ上で
          `ExpeditionEngine` を回して勝率マトリクスを取得します。
        </p>

        <div className="field-group" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <label className="field">
            <span className="field-label">シナリオ</span>
            <span className="field-input">
              <select
                value={scenarioId}
                onChange={(e) => setScenarioId(e.target.value)}
              >
                {scenarios.map((s) => (
                  <option key={s.scenarioId} value={s.scenarioId}>
                    {s.scenarioId} （{s.areaId}・{s.loadoutCount}LO）
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label className="field">
            <span className="field-label">対象ダンジョン (areaId)</span>
            <span className="field-input">
              <select
                value={scenario?.areaId ?? ''}
                onChange={(e) =>
                  updateScenario((s) => ({ ...s, areaId: e.target.value }))
                }
              >
                {dungeons.map((d) => (
                  <option key={d.areaId} value={d.areaId}>
                    {d.areaId} - {d.name}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </div>

        {loadError && <p className="save-error">読込エラー: {loadError}</p>}
      </section>

      {scenario && (
        <ScenarioEditor
          scenario={scenario}
          equipmentList={equipmentList}
          filteredEquipmentList={applyEquipmentFilter(equipmentList, scenario.equipmentFilter)}
          variants={variants}
          updateScenario={updateScenario}
        />
      )}

      {scenario && (
        <PartyStatsPreview
          scenario={scenario}
          level={previewLevel}
          onLevelChange={setPreviewLevel}
        />
      )}

      <section className="card">
        <h3>実行設定</h3>
        <div
          className="field-group"
          style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}
        >
          <NumField label="iterations" value={iterations} onChange={setIterations} min={1} />
          <NumField label="Lv min" value={levelMin} onChange={setLevelMin} min={1} />
          <NumField label="Lv max" value={levelMax} onChange={setLevelMax} min={1} />
          <NumField label="step" value={step} onChange={setStep} min={1} />
          <NumField label="seed" value={seed} onChange={setSeed} min={0} />
        </div>
        <div className="simulate-actions">
          <button
            className="btn"
            onClick={handleSave}
            disabled={saving || !scenario}
          >
            {saving ? '保存中…' : 'シナリオを保存'}
          </button>
          <button
            className="btn primary"
            onClick={handleRun}
            disabled={running || !scenario}
          >
            {running ? '実行中…' : 'シミュレーション実行'}
          </button>
          {progress && (
            <span className="subtle">
              {progress.done} / {progress.total}（
              {progress.total > 0
                ? `${Math.floor((progress.done / progress.total) * 100)}%`
                : '0%'}
              ）
            </span>
          )}
        </div>
        {saveError && <p className="save-error">保存エラー: {saveError}</p>}
        {runError && <p className="save-error">実行エラー: {runError}</p>}
      </section>

      {result && <ResultMatrix result={result} onSelectLevel={setPreviewLevel} />}
    </div>
  )
}

interface ScenarioEditorProps {
  scenario: BalanceScenario
  equipmentList: EquipmentTemplate[]
  filteredEquipmentList: EquipmentTemplate[]
  variants: VariantOption[]
  updateScenario: (mutator: (s: BalanceScenario) => BalanceScenario) => void
}

function ScenarioEditor({
  scenario,
  equipmentList,
  filteredEquipmentList,
  variants,
  updateScenario,
}: ScenarioEditorProps) {
  return (
    <section className="card">
      <h3>シナリオ編集</h3>
      <label className="field">
        <span className="field-label">説明</span>
        <span className="field-input">
          <textarea
            value={scenario.description ?? ''}
            onChange={(e) =>
              updateScenario((s) => ({ ...s, description: e.target.value }))
            }
            rows={2}
          />
        </span>
      </label>

      <EquipmentFilterEditor
        filter={scenario.equipmentFilter}
        equipmentList={equipmentList}
        filteredCount={filteredEquipmentList.length}
        onChange={(next) =>
          updateScenario((s) => ({ ...s, equipmentFilter: next }))
        }
      />

      {scenario.loadouts.map((loadout, loIdx) => (
        <LoadoutEditor
          key={`${loIdx}-${loadout.name}`}
          loadout={loadout}
          equipmentList={filteredEquipmentList}
          variants={variants}
          onChange={(next) =>
            updateScenario((s) => {
              const loadouts = [...s.loadouts]
              loadouts[loIdx] = next
              return { ...s, loadouts }
            })
          }
          onDelete={() =>
            updateScenario((s) => ({
              ...s,
              loadouts: s.loadouts.filter((_, i) => i !== loIdx),
            }))
          }
        />
      ))}

      <div className="simulate-actions">
        <button
          className="btn"
          onClick={() =>
            updateScenario((s) => ({
              ...s,
              loadouts: [
                ...s.loadouts,
                {
                  name: `loadout_${s.loadouts.length + 1}`,
                  description: '',
                  party: [{ name: 'メンバー1', job: 'warrior', equipmentTemplateIds: [] }],
                },
              ],
            }))
          }
        >
          + ロードアウトを追加
        </button>
      </div>
    </section>
  )
}

interface EquipmentFilterEditorProps {
  filter: EquipmentFilter | undefined
  equipmentList: EquipmentTemplate[]
  filteredCount: number
  onChange: (filter: EquipmentFilter | undefined) => void
}

function EquipmentFilterEditor({
  filter,
  equipmentList,
  filteredCount,
  onChange,
}: EquipmentFilterEditorProps) {
  const enabled = filter !== undefined
  const f = filter ?? {}
  const handleNumberChange = (
    key: 'maxUnlockRank' | 'maxDropRank',
    value: string,
  ) => {
    const next: EquipmentFilter = { ...f }
    if (value === '') {
      delete next[key]
    } else {
      const num = Number(value)
      if (Number.isFinite(num)) next[key] = num
    }
    onChange(next)
  }
  return (
    <div
      style={{
        marginTop: 8,
        marginBottom: 12,
        padding: 12,
        background: 'var(--background-soft, #f8f9fc)',
        borderRadius: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <strong>装備プールフィルタ</strong>
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onChange(e.target.checked ? {} : undefined)}
          />
          有効化
        </label>
        <span className="subtle">
          {enabled
            ? `表示中: ${filteredCount} / ${equipmentList.length} 件`
            : `フィルタ無し（全 ${equipmentList.length} 件表示）`}
        </span>
      </div>
      {enabled && (
        <div className="field-group" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <label className="field">
            <span className="field-label">maxUnlockRank（ショップ解放）</span>
            <span className="field-input">
              <input
                type="number"
                value={f.maxUnlockRank ?? ''}
                placeholder="例: 1（拠点ランク1）"
                min={0}
                onChange={(e) => handleNumberChange('maxUnlockRank', e.target.value)}
              />
            </span>
          </label>
          <label className="field">
            <span className="field-label">maxDropRank（ドロップ階層）</span>
            <span className="field-input">
              <input
                type="number"
                value={f.maxDropRank ?? ''}
                placeholder="例: 1"
                min={0}
                onChange={(e) => handleNumberChange('maxDropRank', e.target.value)}
              />
            </span>
          </label>
          <label className="field">
            <span className="field-label">allowIds（許可、カンマ区切り）</span>
            <span className="field-input">
              <input
                type="text"
                value={(f.allowIds ?? []).join(',')}
                placeholder="例: rare_drop_id1,rare_drop_id2"
                onChange={(e) => {
                  const ids = e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0)
                  onChange({ ...f, allowIds: ids.length > 0 ? ids : undefined })
                }}
              />
            </span>
          </label>
          <label className="field">
            <span className="field-label">denyIds（除外、カンマ区切り）</span>
            <span className="field-input">
              <input
                type="text"
                value={(f.denyIds ?? []).join(',')}
                placeholder="例: sword_excalibur"
                onChange={(e) => {
                  const ids = e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0)
                  onChange({ ...f, denyIds: ids.length > 0 ? ids : undefined })
                }}
              />
            </span>
          </label>
        </div>
      )}
    </div>
  )
}

interface LoadoutEditorProps {
  loadout: ScenarioLoadout
  equipmentList: EquipmentTemplate[]
  variants: VariantOption[]
  onChange: (loadout: ScenarioLoadout) => void
  onDelete: () => void
}

function LoadoutEditor({ loadout, equipmentList, variants, onChange, onDelete }: LoadoutEditorProps) {
  return (
    <div
      className="card"
      style={{ marginTop: 12, padding: 12, background: 'var(--background-soft, #f8f9fc)' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 12,
        }}
      >
        <input
          value={loadout.name}
          onChange={(e) => onChange({ ...loadout, name: e.target.value })}
          style={{ fontSize: '1.1em', fontWeight: 'bold', flex: 1 }}
        />
        <button className="btn" onClick={onDelete} title="ロードアウト削除">
          削除
        </button>
      </div>
      <textarea
        value={loadout.description ?? ''}
        onChange={(e) => onChange({ ...loadout, description: e.target.value })}
        placeholder="ロードアウトの説明"
        rows={2}
        style={{ width: '100%', marginTop: 8 }}
      />

      <div style={{ marginTop: 12 }}>
        {loadout.party.map((member, mIdx) => (
          <PartyMemberEditor
            key={mIdx}
            index={mIdx}
            member={member}
            equipmentList={equipmentList}
            variants={variants}
            onChange={(next) =>
              onChange({
                ...loadout,
                party: loadout.party.map((m, i) => (i === mIdx ? next : m)),
              })
            }
            onDelete={() =>
              onChange({
                ...loadout,
                party: loadout.party.filter((_, i) => i !== mIdx),
              })
            }
          />
        ))}
        <button
          className="btn"
          onClick={() =>
            onChange({
              ...loadout,
              party: [
                ...loadout.party,
                {
                  name: `メンバー${loadout.party.length + 1}`,
                  equipmentTemplateIds: [],
                },
              ],
            })
          }
        >
          + メンバー追加（最大6）
        </button>
      </div>
    </div>
  )
}

interface PartyMemberEditorProps {
  index: number
  member: ScenarioPartyMember
  equipmentList: EquipmentTemplate[]
  variants: VariantOption[]
  onChange: (member: ScenarioPartyMember) => void
  onDelete: () => void
}

function PartyMemberEditor({
  index,
  member,
  equipmentList,
  variants,
  onChange,
  onDelete,
}: PartyMemberEditorProps) {
  return (
    <div
      style={{
        border: '1px solid var(--border, #ddd)',
        borderRadius: 6,
        padding: 10,
        marginBottom: 10,
        background: 'var(--surface, white)',
      }}
    >
      <div
        style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}
      >
        <strong style={{ width: 60 }}>列{index + 1}</strong>
        <input
          value={member.name}
          onChange={(e) => onChange({ ...member, name: e.target.value })}
          style={{ width: 140 }}
          placeholder="名前"
        />
        <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span className="subtle" style={{ fontSize: '0.85em' }}>job</span>
          <select
            value={member.job ?? ''}
            onChange={(e) =>
              onChange({ ...member, job: e.target.value === '' ? undefined : e.target.value })
            }
          >
            {JOB_OPTIONS.map((j) => (
              <option key={j} value={j}>
                {j === '' ? '（無職）' : j}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span className="subtle" style={{ fontSize: '0.85em' }}>亜種</span>
          <select
            value={member.variantFactorId ?? ''}
            onChange={(e) =>
              onChange({
                ...member,
                variantFactorId: e.target.value === '' ? undefined : e.target.value,
              })
            }
          >
            <option value="">（通常ゴブリン）</option>
            {variants.map((v) => (
              <option key={v.factorId} value={v.factorId}>
                {v.factorId} ({v.raceName})
              </option>
            ))}
          </select>
        </label>
        <span className="subtle" style={{ flex: 1, minWidth: 200 }}>
          装備順=優先順（解放枠を超えた分は無視）
        </span>
        <button className="btn" onClick={onDelete}>
          削除
        </button>
      </div>
      <ol style={{ paddingLeft: 20, margin: 0 }}>
        {member.equipmentTemplateIds.map((tid, eIdx) => {
          const inList = tid === '' || equipmentList.some((eq) => eq.id === tid)
          return (
          <li
            key={eIdx}
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}
          >
            <select
              value={tid}
              onChange={(e) =>
                onChange({
                  ...member,
                  equipmentTemplateIds: member.equipmentTemplateIds.map((t, i) =>
                    i === eIdx ? e.target.value : t,
                  ),
                })
              }
              style={{ flex: 1, ...(inList ? {} : { background: '#ffe4e1' }) }}
              title={inList ? undefined : 'フィルタ範囲外の装備が選択されています'}
            >
              <option value="">（未選択）</option>
              {!inList && tid !== '' && (
                <option value={tid}>⚠ {tid}（フィルタ外）</option>
              )}
              {equipmentList.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.id} / {eq.name}
                  {eq.category ? ` [${eq.category}${eq.subCategory ? '/' + eq.subCategory : ''}]` : ''}
                </option>
              ))}
            </select>
            <button
              className="btn"
              onClick={() =>
                onChange({
                  ...member,
                  equipmentTemplateIds: member.equipmentTemplateIds.filter(
                    (_, i) => i !== eIdx,
                  ),
                })
              }
            >
              ×
            </button>
          </li>
          )
        })}
      </ol>
      <button
        className="btn"
        onClick={() =>
          onChange({
            ...member,
            equipmentTemplateIds: [...member.equipmentTemplateIds, ''],
          })
        }
      >
        + 装備スロット追加
      </button>
    </div>
  )
}

function NumField({
  label,
  value,
  onChange,
  min,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-input">
        <input
          type="number"
          value={value}
          min={min}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
      </span>
    </label>
  )
}

function ResultMatrix({
  result,
  onSelectLevel,
}: {
  result: ScenarioMatrixResult
  onSelectLevel: (level: number) => void
}) {
  const loadoutNames = useMemo(
    () => result.scenario.loadouts.map((l) => l.name),
    [result.scenario.loadouts],
  )
  return (
    <section className="card">
      <h3>結果マトリクス</h3>
      <p className="subtle">
        対象: {result.scenario.areaId} / iterations={result.options.iterations} / Lv{' '}
        {result.options.levelMin}〜{result.options.levelMax}
      </p>
      <p className="subtle">Lv 列をクリックすると、そのレベルの味方ステータスを上のプレビューに表示します。</p>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={cellStyle}>Lv</th>
            {loadoutNames.map((name) => (
              <th key={name} style={cellStyle}>
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row) => (
            <tr key={row.level}>
              <th
                style={{ ...cellStyle, cursor: 'pointer' }}
                onClick={() => onSelectLevel(row.level)}
                title="このレベルの味方ステータスを表示"
              >
                {row.level}
              </th>
              {loadoutNames.map((name) => {
                const cell = row.loadouts[name]
                return (
                  <td
                    key={name}
                    style={{
                      ...cellStyle,
                      background: cellColor(cell?.winRate ?? 0),
                    }}
                  >
                    {cell ? `${(cell.winRate * 100).toFixed(0)}%` : '-'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={{ marginTop: 16 }}>勝率しきい値到達Lv</h4>
      <table style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={cellStyle}>ロードアウト</th>
            {THRESHOLDS.map((t) => (
              <th key={t} style={cellStyle}>
                ≥ {Math.floor(t * 100)}%
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loadoutNames.map((name) => (
            <tr key={name}>
              <th style={cellStyle}>{name}</th>
              {THRESHOLDS.map((t) => {
                const lv = findThresholdLevel(result.rows, name, t)
                return (
                  <td key={t} style={cellStyle}>
                    {lv === null ? '範囲内未達' : `Lv${lv}`}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

const cellStyle: CSSProperties = {
  border: '1px solid var(--border, #ddd)',
  padding: '4px 8px',
  textAlign: 'center',
}

function cellColor(winRate: number): string {
  if (winRate >= 0.8) return 'rgba(40, 200, 80, 0.15)'
  if (winRate >= 0.5) return 'rgba(255, 200, 60, 0.15)'
  if (winRate > 0) return 'rgba(255, 100, 100, 0.10)'
  return 'transparent'
}
