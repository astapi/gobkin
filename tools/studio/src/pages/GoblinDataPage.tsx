import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { getGoblinJobDefinition } from '@app/shared/data/goblinJobs'

import type {
  GoblinBaseAttributes,
  GoblinFactorSeed,
  GoblinJobSeed,
  GoblinRaceEntry,
  GoblinStudioData,
  GoblinVariantSeed,
  BirthSkillLotteryEntry,
  FactorSkillInheritanceRule,
  PureGoblinSkillManifestationRule,
} from '../lib/schema'
import { GoblinStudioDataSchema } from '../lib/schema'
import { JobSkillListEditor, SkillIdListEditor, SkillMeta, SkillSelectField } from '../components/SkillEditors'
import {
  FieldRow,
  NumberField,
  OptionalNumberField,
  OptionalTextField,
  TextAreaField,
  TextField,
} from '../components/fields'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string }

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }
  | { kind: 'success' }

type Tab = 'races' | 'factors' | 'variants' | 'jobs' | 'birthSkills'

const EMPTY_ATTRIBUTES: GoblinBaseAttributes = {
  power: 10,
  wisdom: 10,
  spirit: 10,
  vitality: 10,
  agility: 10,
  luck: 10,
}

const EMPTY_RACE: GoblinRaceEntry = {
  id: '',
  label: '',
  implies: [],
}

const EMPTY_VARIANT: GoblinVariantSeed = {
  factorId: '',
  factorName: '',
  factorDescription: '',
  inheritProbability: 0,
  factorEffects: [],
  variantProbability: 0,
  raceId: '',
  raceName: '',
  avatar: '',
  imageKey: '',
}

const EMPTY_FACTOR: GoblinFactorSeed = {
  id: '',
  name: '',
  description: '',
  inheritProbability: 0,
  effects: [],
  source: 'standalone',
}

const EMPTY_JOB: GoblinJobSeed = {
  id: '',
  accentColor: '#000000',
  skills: [],
}

export function GoblinDataPage() {
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' })
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })
  const [tab, setTab] = useState<Tab>('variants')
  const [draft, setDraft] = useState<GoblinStudioData | null>(null)
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null)
  const [selectedFactorId, setSelectedFactorId] = useState<string | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const originalRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/goblin-data')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as GoblinStudioData
        if (cancelled) return
        setDraft(data)
        originalRef.current = stableStringify(data)
        setSelectedRaceId(data.races[0]?.id ?? null)
        setSelectedFactorId(data.factors[0]?.id ?? null)
        setSelectedVariantId(data.variants[0]?.factorId ?? null)
        setSelectedJobId(data.jobs[0]?.id ?? null)
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

  const isDirty = useMemo(() => {
    if (!draft || originalRef.current === null) return false
    return stableStringify(draft) !== originalRef.current
  }, [draft])

  const updateDraft = useCallback((updater: (prev: GoblinStudioData) => GoblinStudioData) => {
    setDraft((prev) => (prev ? updater(prev) : prev))
    setSaveState({ kind: 'idle' })
  }, [])

  const save = useCallback(async () => {
    if (!draft) return
    const result = GoblinStudioDataSchema.safeParse(draft)
    if (!result.success) {
      setSaveState({
        kind: 'error',
        message: result.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join(' / '),
      })
      return
    }
    setSaveState({ kind: 'saving' })
    try {
      const res = await fetch('/api/goblin-data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        throw new Error(errBody?.error ?? `HTTP ${res.status}`)
      }
      originalRef.current = stableStringify(draft)
      setSaveState({ kind: 'success' })
    } catch (err) {
      setSaveState({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }, [draft])

  const revert = useCallback(() => {
    if (originalRef.current === null) return
    const parsed = JSON.parse(originalRef.current) as GoblinStudioData
    setDraft(parsed)
    setSelectedRaceId(parsed.races[0]?.id ?? null)
    setSelectedFactorId(parsed.factors[0]?.id ?? null)
    setSelectedVariantId(parsed.variants[0]?.factorId ?? null)
    setSelectedJobId(parsed.jobs[0]?.id ?? null)
    setSaveState({ kind: 'idle' })
  }, [])

  const selectedRace = draft?.races.find((race) => race.id === selectedRaceId) ?? null
  const selectedFactor = draft?.factors.find((factor) => factor.id === selectedFactorId) ?? null
  const selectedVariant =
    draft?.variants.find((variant) => variant.factorId === selectedVariantId) ?? null
  const selectedJob = draft?.jobs.find((job) => job.id === selectedJobId) ?? null

  if (loadState.kind === 'loading') return <p className="state-msg">読み込み中…</p>
  if (loadState.kind === 'error') {
    return <p className="state-msg error">読み込みに失敗しました: {loadState.message}</p>
  }
  if (!draft) return null

  return (
    <div className="detail">
      <div className="detail-head">
        <div>
          <h2>ゴブリンデータ</h2>
          <p className="subtle">
            race / variant / job を確認し、主要定義を編集できます。Race は敵味方共通の種族タグ辞書です。
          </p>
        </div>
        <div className="save-bar">
          {saveState.kind === 'saving' && <span className="subtle">保存中…</span>}
          {saveState.kind === 'success' && !isDirty && (
            <span className="saved">保存しました</span>
          )}
          <button
            className="btn ghost"
            onClick={revert}
            disabled={!isDirty || saveState.kind === 'saving'}
          >
            取り消し
          </button>
          <button className="btn primary" onClick={save} disabled={saveState.kind === 'saving'}>
            保存
          </button>
        </div>
      </div>

      {saveState.kind === 'error' && <p className="save-error">{saveState.message}</p>}

      <div className="tabs">
        <button className={tab === 'races' ? 'tab active' : 'tab'} onClick={() => setTab('races')}>
          Race
        </button>
        <button
          className={tab === 'factors' ? 'tab active' : 'tab'}
          onClick={() => setTab('factors')}
        >
          因子
        </button>
        <button
          className={tab === 'variants' ? 'tab active' : 'tab'}
          onClick={() => setTab('variants')}
        >
          亜種
        </button>
        <button className={tab === 'jobs' ? 'tab active' : 'tab'} onClick={() => setTab('jobs')}>
          Job
        </button>
        <button
          className={tab === 'birthSkills' ? 'tab active' : 'tab'}
          onClick={() => setTab('birthSkills')}
        >
          誕生スキル
        </button>
      </div>

      <div className="tab-panel">
        {tab === 'races' && (
          <DataEditorLayout
            items={draft.races}
            getKey={(item) => item.id}
            getLabel={(item) => item.label || item.id || '(新規 race)'}
            selectedKey={selectedRaceId}
            onSelect={setSelectedRaceId}
            onAdd={() => {
              const next = { ...EMPTY_RACE, id: `new_race_${Date.now()}` }
              updateDraft((prev) => ({ ...prev, races: [...prev.races, next] }))
              setSelectedRaceId(next.id)
            }}
            onDelete={() => {
              if (!selectedRaceId) return
              updateDraft((prev) => ({
                ...prev,
                races: prev.races.filter((race) => race.id !== selectedRaceId),
              }))
              setSelectedRaceId(draft.races.find((race) => race.id !== selectedRaceId)?.id ?? null)
            }}
          >
            {selectedRace && (
              <section className="card">
                <h3>Race 定義</h3>
                <FieldRow>
                  <TextField
                    size="md"
                    label="id"
                    value={selectedRace.id}
                    onChange={(value) => {
                      updateDraft((prev) => ({
                        ...prev,
                        races: prev.races.map((race) =>
                          race.id === selectedRaceId ? { ...race, id: value } : race,
                        ),
                      }))
                      setSelectedRaceId(value)
                    }}
                  />
                  <TextField
                    size="lg"
                    label="label"
                    value={selectedRace.label}
                    onChange={(value) =>
                      updateDraft((prev) => ({
                        ...prev,
                        races: prev.races.map((race) =>
                          race.id === selectedRaceId ? { ...race, label: value } : race,
                        ),
                      }))
                    }
                  />
                  <TextField
                    size="xl"
                    label="implies (カンマ区切り)"
                    value={(selectedRace.implies ?? []).join(', ')}
                    onChange={(value) =>
                      updateDraft((prev) => ({
                        ...prev,
                        races: prev.races.map((race) =>
                          race.id === selectedRaceId
                            ? {
                                ...race,
                                implies: value
                                  .split(',')
                                  .map((entry) => entry.trim())
                                  .filter(Boolean),
                              }
                            : race,
                        ),
                      }))
                    }
                  />
                </FieldRow>
                <FieldRow>
                  <OptionalNumberField
                    size="sm"
                    label="physicalResistance%"
                    value={selectedRace.physicalResistancePercent}
                    onChange={(value) =>
                      updateDraft((prev) => ({
                        ...prev,
                        races: prev.races.map((race) =>
                          race.id === selectedRaceId ? { ...race, physicalResistancePercent: value } : race,
                        ),
                      }))
                    }
                  />
                  <OptionalNumberField
                    size="sm"
                    label="penetrationResistance%"
                    value={selectedRace.penetrationResistancePercent}
                    onChange={(value) =>
                      updateDraft((prev) => ({
                        ...prev,
                        races: prev.races.map((race) =>
                          race.id === selectedRaceId ? { ...race, penetrationResistancePercent: value } : race,
                        ),
                      }))
                    }
                  />
                  <OptionalNumberField
                    size="sm"
                    label="criticalResistance%"
                    value={selectedRace.criticalResistancePercent}
                    onChange={(value) =>
                      updateDraft((prev) => ({
                        ...prev,
                        races: prev.races.map((race) =>
                          race.id === selectedRaceId ? { ...race, criticalResistancePercent: value } : race,
                        ),
                      }))
                    }
                  />
                  <OptionalNumberField
                    size="sm"
                    label="magicResistance%"
                    value={selectedRace.magicResistancePercent}
                    onChange={(value) =>
                      updateDraft((prev) => ({
                        ...prev,
                        races: prev.races.map((race) =>
                          race.id === selectedRaceId ? { ...race, magicResistancePercent: value } : race,
                        ),
                      }))
                    }
                  />
                </FieldRow>
                <p className="subtle">
                  例: <code>slime</code> → <code>beast</code>, <code>undead</code> → <code>demon_race</code>
                </p>
                <section className="card nested-card">
                  <h3>Race スキル</h3>
                  <SkillIdListEditor
                    skillIds={selectedRace.skillIds ?? []}
                    onChange={(skillIds) =>
                      updateDraft((prev) => ({
                        ...prev,
                        races: prev.races.map((race) =>
                          race.id === selectedRaceId ? { ...race, skillIds } : race,
                        ),
                      }))
                    }
                  />
                </section>
              </section>
            )}
          </DataEditorLayout>
        )}

        {tab === 'factors' && (
          <DataEditorLayout
            items={draft.factors}
            getKey={(item) => item.id}
            getLabel={(item) => item.name || item.id || '(新規因子)'}
            selectedKey={selectedFactorId}
            onSelect={setSelectedFactorId}
            canDelete={selectedFactor?.source !== 'variant'}
            onAdd={() => {
              const next = { ...EMPTY_FACTOR, id: `new_factor_${Date.now()}` }
              updateDraft((prev) => ({ ...prev, factors: [...prev.factors, next] }))
              setSelectedFactorId(next.id)
            }}
            onDelete={() => {
              if (!selectedFactorId) return
              if (selectedFactor?.source === 'variant') return
              updateDraft((prev) => ({
                ...prev,
                factors: prev.factors.filter((factor) => factor.id !== selectedFactorId),
              }))
              setSelectedFactorId(
                draft.factors.find((factor) => factor.id !== selectedFactorId)?.id ?? null,
              )
            }}
          >
            {selectedFactor && (
              <FactorEditor
                factor={selectedFactor}
                onIdChange={setSelectedFactorId}
                onChange={(nextFactor) =>
                  updateDraft((prev) => ({
                    ...prev,
                    factors: prev.factors.map((factor) =>
                      factor.id === selectedFactorId ? nextFactor : factor,
                    ),
                    variants: prev.variants.map((variant) =>
                      variant.factorId === selectedFactorId && selectedFactor.source === 'variant'
                        ? { ...variant, factorId: nextFactor.id }
                        : variant,
                    ),
                  }))
                }
              />
            )}
          </DataEditorLayout>
        )}

        {tab === 'variants' && (
          <DataEditorLayout
            items={draft.variants}
            getKey={(item) => item.factorId}
            getLabel={(item) => item.raceName || item.factorId || '(新規亜種)'}
            selectedKey={selectedVariantId}
            onSelect={setSelectedVariantId}
            onAdd={() => {
              const next = { ...EMPTY_VARIANT, factorId: `new_variant_${Date.now()}` }
              const nextFactor: GoblinFactorSeed = {
                ...EMPTY_FACTOR,
                id: next.factorId,
                source: 'variant',
              }
              updateDraft((prev) => ({
                ...prev,
                factors: [...prev.factors, nextFactor],
                variants: [...prev.variants, next],
              }))
              setSelectedVariantId(next.factorId)
            }}
            onDelete={() => {
              if (!selectedVariantId) return
              updateDraft((prev) => ({
                ...prev,
                variants: prev.variants.filter((variant) => variant.factorId !== selectedVariantId),
              }))
              setSelectedVariantId(
                draft.variants.find((variant) => variant.factorId !== selectedVariantId)?.factorId ??
                  null,
              )
            }}
          >
            {selectedVariant && (
              <VariantEditor
                variant={selectedVariant}
                onIdChange={setSelectedVariantId}
                onChange={(nextVariant) =>
                  updateDraft((prev) => ({
                    ...prev,
                    factors: prev.factors.map((factor) =>
                      factor.id === selectedVariantId && factor.source === 'variant'
                        ? { ...factor, id: nextVariant.factorId }
                        : factor,
                    ),
                    variants: prev.variants.map((variant) =>
                      variant.factorId === selectedVariantId ? nextVariant : variant,
                    ),
                  }))
                }
              />
            )}
          </DataEditorLayout>
        )}

        {tab === 'jobs' && (
          <DataEditorLayout
            items={draft.jobs}
            getKey={(item) => item.id}
            getLabel={(item) => {
              try {
                return getGoblinJobDefinition(item.id as never).name
              } catch {
                return item.id || '(新規 job)'
              }
            }}
            selectedKey={selectedJobId}
            onSelect={setSelectedJobId}
            onAdd={() => {
              const next = { ...EMPTY_JOB, id: `new_job_${Date.now()}` }
              updateDraft((prev) => ({ ...prev, jobs: [...prev.jobs, next] }))
              setSelectedJobId(next.id)
            }}
            onDelete={() => {
              if (!selectedJobId) return
              updateDraft((prev) => ({
                ...prev,
                jobs: prev.jobs.filter((job) => job.id !== selectedJobId),
              }))
              setSelectedJobId(draft.jobs.find((job) => job.id !== selectedJobId)?.id ?? null)
            }}
          >
            {selectedJob && (
              <JobEditor
                job={selectedJob}
                onIdChange={setSelectedJobId}
                onChange={(nextJob) =>
                  updateDraft((prev) => ({
                    ...prev,
                    jobs: prev.jobs.map((job) => (job.id === selectedJobId ? nextJob : job)),
                  }))
                }
              />
            )}
          </DataEditorLayout>
        )}

        {tab === 'birthSkills' && (
          <BirthSkillRulesEditor
            inheritanceRules={draft.factorSkillInheritanceRules}
            manifestationRules={draft.pureGoblinSkillManifestationRules}
            factors={draft.factors}
            onInheritanceChange={(factorSkillInheritanceRules) =>
              updateDraft((prev) => ({ ...prev, factorSkillInheritanceRules }))
            }
            onManifestationChange={(pureGoblinSkillManifestationRules) =>
              updateDraft((prev) => ({ ...prev, pureGoblinSkillManifestationRules }))
            }
          />
        )}
      </div>
    </div>
  )
}

function DataEditorLayout<T>({
  items,
  getKey,
  getLabel,
  selectedKey,
  onSelect,
  canDelete = true,
  onAdd,
  onDelete,
  children,
}: {
  items: T[]
  getKey: (item: T) => string
  getLabel: (item: T) => string
  selectedKey: string | null
  onSelect: (key: string | null) => void
  canDelete?: boolean
  onAdd: () => void
  onDelete: () => void
  children: ReactNode
}) {
  return (
    <div className="goblin-data-layout">
      <aside className="card goblin-data-list">
        <div className="section-head">
          <h3>一覧</h3>
          <div className="field-row">
            <button className="btn ghost small" onClick={onAdd}>
              + 追加
            </button>
            <button className="btn ghost small" onClick={onDelete} disabled={!selectedKey || !canDelete}>
              削除
            </button>
          </div>
        </div>
        <div className="goblin-list-items">
          {items.map((item, index) => {
            const key = getKey(item)
            return (
              <button
                key={key || `empty-${index}`}
                className={selectedKey === key ? 'goblin-list-item active' : 'goblin-list-item'}
                onClick={() => onSelect(key)}
              >
                <strong>{getLabel(item)}</strong>
                <span className="subtle">{key || '(id未設定)'}</span>
              </button>
            )
          })}
        </div>
      </aside>
      <div className="panel-stack">{children}</div>
    </div>
  )
}

function BirthSkillRulesEditor({
  inheritanceRules,
  manifestationRules,
  factors,
  onInheritanceChange,
  onManifestationChange,
}: {
  inheritanceRules: FactorSkillInheritanceRule[]
  manifestationRules: PureGoblinSkillManifestationRule[]
  factors: GoblinFactorSeed[]
  onInheritanceChange: (rules: FactorSkillInheritanceRule[]) => void
  onManifestationChange: (rules: PureGoblinSkillManifestationRule[]) => void
}) {
  const factorOptions = factors.map((factor) => ({
    id: factor.id,
    label: `${factor.name || factor.id} / ${factor.id}`,
  }))

  return (
    <div className="panel-stack">
      <section className="card">
        <div className="section-head">
          <h3>因子スキル継承</h3>
          <button
            className="btn ghost small"
            onClick={() => {
              const used = new Set(inheritanceRules.map((rule) => rule.factorId))
              const factorId = factorOptions.find((factor) => !used.has(factor.id))?.id ?? ''
              onInheritanceChange([...inheritanceRules, { factorId, skills: [] }])
            }}
          >
            + 追加
          </button>
        </div>
        <div className="story-block-list">
          {inheritanceRules.map((rule, index) => (
            <div key={`${rule.factorId}-${index}`} className="story-block">
              <div className="story-block-head">
                <strong>{rule.factorId || '(factor 未設定)'}</strong>
                <div className="pattern-actions">
                  <button className="icon-btn" onClick={() => onInheritanceChange(moveItem(inheritanceRules, index, -1))}>
                    ↑
                  </button>
                  <button className="icon-btn" onClick={() => onInheritanceChange(moveItem(inheritanceRules, index, 1))}>
                    ↓
                  </button>
                  <button
                    className="icon-btn danger"
                    onClick={() => onInheritanceChange(inheritanceRules.filter((_, entryIndex) => entryIndex !== index))}
                  >
                    ×
                  </button>
                </div>
              </div>
              <FieldRow>
                <label className="field field-size-lg">
                  <span className="field-label">factorId</span>
                  <span className="field-input">
                    <select
                      value={rule.factorId}
                      onChange={(e) =>
                        onInheritanceChange(
                          inheritanceRules.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, factorId: e.target.value } : entry,
                          ),
                        )
                      }
                    >
                      <option value="">(未設定)</option>
                      {factorOptions.map((factor) => (
                        <option key={factor.id} value={factor.id}>
                          {factor.label}
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
              </FieldRow>
              <SkillLotteryListEditor
                skills={rule.skills}
                onChange={(skills) =>
                  onInheritanceChange(
                    inheritanceRules.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, skills } : entry,
                    ),
                  )
                }
              />
            </div>
          ))}
          {inheritanceRules.length === 0 && <p className="subtle">未設定</p>}
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <h3>純ゴブリン スキル発現</h3>
          <button
            className="btn ghost small"
            onClick={() => {
              const nextRank = Math.max(0, ...manifestationRules.map((rule) => rule.baseRank)) + 1
              onManifestationChange([...manifestationRules, { baseRank: nextRank, skills: [] }])
            }}
          >
            + 追加
          </button>
        </div>
        <p className="subtle">誕生時の追加スキルは最大4枠です。継承スキルの後に発現スキルを判定します。</p>
        <div className="story-block-list">
          {manifestationRules.map((rule, index) => (
            <div key={`${rule.baseRank}-${index}`} className="story-block">
              <div className="story-block-head">
                <strong>Rank {rule.baseRank}</strong>
                <div className="pattern-actions">
                  <button className="icon-btn" onClick={() => onManifestationChange(moveItem(manifestationRules, index, -1))}>
                    ↑
                  </button>
                  <button className="icon-btn" onClick={() => onManifestationChange(moveItem(manifestationRules, index, 1))}>
                    ↓
                  </button>
                  <button
                    className="icon-btn danger"
                    onClick={() => onManifestationChange(manifestationRules.filter((_, entryIndex) => entryIndex !== index))}
                  >
                    ×
                  </button>
                </div>
              </div>
              <FieldRow>
                <NumberField
                  size="sm"
                  label="baseRank"
                  value={rule.baseRank}
                  min={1}
                  onChange={(baseRank) =>
                    onManifestationChange(
                      manifestationRules.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, baseRank } : entry,
                      ),
                    )
                  }
                />
              </FieldRow>
              <SkillLotteryListEditor
                skills={rule.skills}
                onChange={(skills) =>
                  onManifestationChange(
                    manifestationRules.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, skills } : entry,
                    ),
                  )
                }
              />
            </div>
          ))}
          {manifestationRules.length === 0 && <p className="subtle">未設定</p>}
        </div>
      </section>
    </div>
  )
}

function SkillLotteryListEditor({
  skills,
  onChange,
}: {
  skills: BirthSkillLotteryEntry[]
  onChange: (skills: BirthSkillLotteryEntry[]) => void
}) {
  return (
    <div className="story-block-list">
      {skills.map((skill, index) => (
        <div key={`${skill.skillId}-${index}`} className="story-block">
          <div className="story-block-head">
            <strong>{skill.skillId || '(skill 未設定)'}</strong>
            <div className="pattern-actions">
              <button className="icon-btn" onClick={() => onChange(moveItem(skills, index, -1))}>
                ↑
              </button>
              <button className="icon-btn" onClick={() => onChange(moveItem(skills, index, 1))}>
                ↓
              </button>
              <button
                className="icon-btn danger"
                onClick={() => onChange(skills.filter((_, entryIndex) => entryIndex !== index))}
              >
                ×
              </button>
            </div>
          </div>
          <FieldRow>
            <SkillSelectField
              size="lg"
              label="skillId"
              value={skill.skillId}
              onChange={(skillId) =>
                onChange(
                  skills.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, skillId } : entry,
                  ),
                )
              }
            />
            <NumberField
              size="sm"
              label="probability"
              value={skill.probability}
              min={0}
              step={0.01}
              onChange={(probability) =>
                onChange(
                  skills.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, probability } : entry,
                  ),
                )
              }
            />
          </FieldRow>
          <SkillMeta skillId={skill.skillId} />
        </div>
      ))}
      <button className="btn ghost small" onClick={() => onChange([...skills, { skillId: '', probability: 0 }])}>
        + スキル
      </button>
    </div>
  )
}

function FactorEditor({
  factor,
  onIdChange,
  onChange,
}: {
  factor: GoblinFactorSeed
  onIdChange: (id: string) => void
  onChange: (factor: GoblinFactorSeed) => void
}) {
  const isVariantFactor = factor.source === 'variant'

  return (
    <div className="panel-stack">
      <section className="card">
        <h3>基本情報</h3>
        <FieldRow>
          <TextField
            size="md"
            label="id"
            value={factor.id}
            onChange={(value) => {
              onIdChange(value)
              onChange({ ...factor, id: value })
            }}
          />
          <TextField
            size="lg"
            label="name"
            value={factor.name}
            onChange={(value) => onChange({ ...factor, name: value })}
          />
          <NumberField
            size="sm"
            label="inheritProbability"
            value={factor.inheritProbability}
            step={0.01}
            onChange={(value) => onChange({ ...factor, inheritProbability: value })}
          />
        </FieldRow>
        <FieldRow>
          <TextAreaField
            size="xl"
            label="description"
            value={factor.description}
            rows={4}
            onChange={(value) => onChange({ ...factor, description: value })}
          />
        </FieldRow>
        <p className="subtle">
          {isVariantFactor
            ? '亜種に紐づく因子です。保存時に goblinVariants.ts へ反映されます。'
            : '因子のみの定義です。保存時に factors.ts へ反映されます。'}
        </p>
      </section>

      <EffectListEditor
        title="因子効果"
        effects={factor.effects}
        onChange={(effects) => onChange({ ...factor, effects })}
      />
    </div>
  )
}

function VariantEditor({
  variant,
  onIdChange,
  onChange,
}: {
  variant: GoblinVariantSeed
  onIdChange: (id: string) => void
  onChange: (variant: GoblinVariantSeed) => void
}) {
  return (
    <div className="panel-stack">
      <section className="card">
        <h3>基本情報</h3>
        <FieldRow>
          <TextField size="md" label="factorId" value={variant.factorId} onChange={(value) => { onIdChange(value); onChange({ ...variant, factorId: value }) }} />
          <TextField size="md" label="raceId" value={variant.raceId} onChange={(value) => onChange({ ...variant, raceId: value })} />
          <TextField size="lg" label="raceName" value={variant.raceName} onChange={(value) => onChange({ ...variant, raceName: value })} />
          <NumberField size="sm" label="variantProbability" value={variant.variantProbability} step={0.01} onChange={(value) => onChange({ ...variant, variantProbability: value })} />
          <OptionalNumberField size="sm" label="hpCoefficient" value={variant.hpCoefficient} step={0.1} onChange={(value) => onChange({ ...variant, hpCoefficient: value })} />
          <TextField size="lg" label="avatar" value={variant.avatar} onChange={(value) => onChange({ ...variant, avatar: value })} />
          <TextField size="md" label="imageKey" value={variant.imageKey} onChange={(value) => onChange({ ...variant, imageKey: value })} />
        </FieldRow>
      </section>

      <section className="card">
        <div className="section-head">
          <h3>基本能力値</h3>
          <button
            className="btn ghost small"
            onClick={() =>
              onChange({
                ...variant,
                baseAttributes: variant.baseAttributes ? undefined : { ...EMPTY_ATTRIBUTES },
              })
            }
          >
            {variant.baseAttributes ? '削除' : '追加'}
          </button>
        </div>
        {variant.baseAttributes ? (
          <AttributeEditor
            value={variant.baseAttributes}
            onChange={(value) => onChange({ ...variant, baseAttributes: value })}
          />
        ) : (
          <p className="subtle">未設定</p>
        )}
      </section>

      <section className="card">
        <h3>デフォルトスキル</h3>
        <SkillIdListEditor
          skillIds={variant.defaultSkillIds ?? []}
          onChange={(skillIds) => onChange({ ...variant, defaultSkillIds: skillIds })}
        />
      </section>
    </div>
  )
}

function JobEditor({
  job,
  onIdChange,
  onChange,
}: {
  job: GoblinJobSeed
  onIdChange: (id: string) => void
  onChange: (job: GoblinJobSeed) => void
}) {
  let derivedName = job.id
  let derivedSummary = ''
  let derivedDescription = ''
  try {
    const derived = getGoblinJobDefinition(job.id as never)
    derivedName = derived.name
    derivedSummary = derived.summary
    derivedDescription = derived.description
  } catch {
    // noop
  }

  return (
    <div className="panel-stack">
      <section className="card">
        <h3>基本情報</h3>
        <FieldRow>
          <TextField size="md" label="id" value={job.id} onChange={(value) => { onIdChange(value); onChange({ ...job, id: value }) }} />
          <TextField
            size="sm"
            label="accentColor"
            value={job.accentColor}
            onChange={(value) => onChange({ ...job, accentColor: value })}
          />
          <OptionalTextField
            size="md"
            label="unlockRequiresClearedArea"
            value={job.unlockRequiresClearedArea}
            onChange={(value) => onChange({ ...job, unlockRequiresClearedArea: value })}
          />
          <OptionalTextField
            size="md"
            label="unlockRequiresReadStory"
            value={job.unlockRequiresReadStory}
            onChange={(value) => onChange({ ...job, unlockRequiresReadStory: value })}
          />
        </FieldRow>
        <div className="goblin-derived">
          <div><strong>{derivedName}</strong></div>
          {derivedSummary && <div className="subtle">{derivedSummary}</div>}
          {derivedDescription && <div className="subtle">{derivedDescription}</div>}
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <h3>基本能力値</h3>
          <button
            className="btn ghost small"
            onClick={() =>
              onChange({
                ...job,
                baseAttributes: job.baseAttributes ? undefined : { ...EMPTY_ATTRIBUTES },
              })
            }
          >
            {job.baseAttributes ? '削除' : '追加'}
          </button>
        </div>
        {job.baseAttributes ? (
          <AttributeEditor
            value={job.baseAttributes}
            onChange={(value) => onChange({ ...job, baseAttributes: value })}
          />
        ) : (
          <p className="subtle">未設定</p>
        )}
      </section>

      <section className="card">
        <div className="section-head">
          <h3>ジョブスキル</h3>
          <button
            className="btn ghost small"
            onClick={() =>
              onChange({
                ...job,
                skills: [...job.skills, { skillId: '', unlockLevel: undefined }],
              })
            }
          >
            + 追加
          </button>
        </div>
        <JobSkillListEditor skills={job.skills} onChange={(skills) => onChange({ ...job, skills })} />
        {job.skills.length === 0 && <p className="subtle">未設定</p>}
      </section>
    </div>
  )
}

function AttributeEditor({
  value,
  onChange,
}: {
  value: GoblinBaseAttributes
  onChange: (value: GoblinBaseAttributes) => void
}) {
  return (
    <FieldRow>
      {(['power', 'wisdom', 'spirit', 'vitality', 'agility', 'luck'] as const).map((key) => (
        <NumberField
          key={key}
          size="sm"
          label={key}
          value={value[key]}
          onChange={(nextValue) => onChange({ ...value, [key]: nextValue })}
        />
      ))}
    </FieldRow>
  )
}

function EffectListEditor({
  title,
  effects,
  onChange,
}: {
  title: string
  effects: GoblinFactorSeed['effects']
  onChange: (effects: GoblinFactorSeed['effects']) => void
}) {
  return (
    <section className="card">
      <div className="section-head">
        <h3>{title}</h3>
        <button
          className="btn ghost small"
          onClick={() =>
            onChange([...effects, { type: 'stat_bonus', target: 'hp', value: 0 }])
          }
        >
          + 追加
        </button>
      </div>
      <div className="story-block-list">
        {effects.map((effect, index) => (
          <div key={`${effect.type}-${effect.target}-${index}`} className="story-block">
            <div className="story-block-head">
              <strong>{effect.target}</strong>
              <div className="pattern-actions">
                <button className="icon-btn" onClick={() => onChange(moveItem(effects, index, -1))}>
                  ↑
                </button>
                <button className="icon-btn" onClick={() => onChange(moveItem(effects, index, 1))}>
                  ↓
                </button>
                <button
                  className="icon-btn danger"
                  onClick={() => onChange(effects.filter((_, entryIndex) => entryIndex !== index))}
                >
                  ×
                </button>
              </div>
            </div>
            <FieldRow>
              <label className="field field-size-sm">
                <span className="field-label">type</span>
                <span className="field-input">
                  <select
                    value={effect.type}
                    onChange={(e) =>
                      onChange(
                        effects.map((entry, entryIndex) =>
                          entryIndex === index
                            ? { ...entry, type: e.target.value as typeof effect.type }
                            : entry,
                        ),
                      )
                    }
                  >
                    <option value="stat_bonus">stat_bonus</option>
                    <option value="resistance">resistance</option>
                    <option value="skill_unlock">skill_unlock</option>
                  </select>
                </span>
              </label>
              <label className="field field-size-sm">
                <span className="field-label">target</span>
                <span className="field-input">
                  <select
                    value={effect.target}
                    onChange={(e) =>
                      onChange(
                        effects.map((entry, entryIndex) =>
                          entryIndex === index
                            ? { ...entry, target: e.target.value as typeof effect.target }
                            : entry,
                        ),
                      )
                    }
                  >
                    {['hp', 'atk', 'magicAtk', 'def', 'magicDef', 'attackCount', 'accuracy', 'evasion', 'magicHeal'].map((target) => (
                      <option key={target} value={target}>
                        {target}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <NumberField
                size="sm"
                label="value"
                value={effect.value}
                onChange={(value) =>
                  onChange(
                    effects.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, value } : entry,
                    ),
                  )
                }
              />
            </FieldRow>
          </div>
        ))}
        {effects.length === 0 && <p className="subtle">未設定</p>}
      </div>
    </section>
  )
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction
  if (target < 0 || target >= items.length) return items
  const next = items.slice()
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {}
      for (const key of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[key] = (val as Record<string, unknown>)[key]
      }
      return sorted
    }
    return val
  })
}
