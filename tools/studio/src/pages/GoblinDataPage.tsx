import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { getCharacterSkillDefinition } from '@app/shared/data/skillCatalog'
import { getGoblinJobDefinition } from '@app/shared/data/goblinJobs'
import { getSkillLabel } from '@app/shared/i18n/entityLocalization'

import type {
  GoblinBaseAttributes,
  GoblinJobSeed,
  GoblinJobSkillSeed,
  GoblinRaceEntry,
  GoblinStudioData,
  GoblinVariantSeed,
} from '../lib/schema'
import { GoblinStudioDataSchema } from '../lib/schema'
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

type Tab = 'races' | 'variants' | 'jobs'

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
  additionalEffects: [],
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
    setSelectedVariantId(parsed.variants[0]?.factorId ?? null)
    setSelectedJobId(parsed.jobs[0]?.id ?? null)
    setSaveState({ kind: 'idle' })
  }, [])

  const selectedRace = draft?.races.find((race) => race.id === selectedRaceId) ?? null
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
            race / variant / job を確認し、主要定義を編集できます。
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
          className={tab === 'variants' ? 'tab active' : 'tab'}
          onClick={() => setTab('variants')}
        >
          亜種
        </button>
        <button className={tab === 'jobs' ? 'tab active' : 'tab'} onClick={() => setTab('jobs')}>
          Job
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
                </FieldRow>
              </section>
            )}
          </DataEditorLayout>
        )}

        {tab === 'variants' && (
          <DataEditorLayout
            items={draft.variants}
            getKey={(item) => item.factorId}
            getLabel={(item) => item.factorName || item.factorId || '(新規亜種)'}
            selectedKey={selectedVariantId}
            onSelect={setSelectedVariantId}
            onAdd={() => {
              const next = { ...EMPTY_VARIANT, factorId: `new_variant_${Date.now()}` }
              updateDraft((prev) => ({ ...prev, variants: [...prev.variants, next] }))
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
  onAdd,
  onDelete,
  children,
}: {
  items: T[]
  getKey: (item: T) => string
  getLabel: (item: T) => string
  selectedKey: string | null
  onSelect: (key: string | null) => void
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
            <button className="btn ghost small" onClick={onDelete} disabled={!selectedKey}>
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
          <TextField size="lg" label="factorName" value={variant.factorName} onChange={(value) => onChange({ ...variant, factorName: value })} />
          <TextField size="md" label="raceId" value={variant.raceId} onChange={(value) => onChange({ ...variant, raceId: value })} />
          <TextField size="lg" label="raceName" value={variant.raceName} onChange={(value) => onChange({ ...variant, raceName: value })} />
          <NumberField size="sm" label="inheritProbability" value={variant.inheritProbability} step={0.01} onChange={(value) => onChange({ ...variant, inheritProbability: value })} />
          <NumberField size="sm" label="variantProbability" value={variant.variantProbability} step={0.01} onChange={(value) => onChange({ ...variant, variantProbability: value })} />
          <OptionalNumberField size="sm" label="hpCoefficient" value={variant.hpCoefficient} step={0.1} onChange={(value) => onChange({ ...variant, hpCoefficient: value })} />
          <TextField size="lg" label="avatar" value={variant.avatar} onChange={(value) => onChange({ ...variant, avatar: value })} />
          <TextField size="md" label="imageKey" value={variant.imageKey} onChange={(value) => onChange({ ...variant, imageKey: value })} />
        </FieldRow>
        <FieldRow>
          <TextAreaField
            size="xl"
            label="factorDescription"
            value={variant.factorDescription}
            rows={4}
            onChange={(value) => onChange({ ...variant, factorDescription: value })}
          />
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
        <div className="section-head">
          <h3>戦闘補正</h3>
          <button
            className="btn ghost small"
            onClick={() =>
              onChange({
                ...variant,
                combatStats: variant.combatStats
                  ? undefined
                  : { attackCount: 2, accuracy: 20, evasion: 15 },
              })
            }
          >
            {variant.combatStats ? '削除' : '追加'}
          </button>
        </div>
        {variant.combatStats ? (
          <FieldRow>
            <NumberField
              size="sm"
              label="attackCount"
              value={variant.combatStats.attackCount}
              onChange={(value) =>
                onChange({
                  ...variant,
                  combatStats: { ...variant.combatStats!, attackCount: value },
                })
              }
            />
            <NumberField
              size="sm"
              label="accuracy"
              value={variant.combatStats.accuracy}
              onChange={(value) =>
                onChange({
                  ...variant,
                  combatStats: { ...variant.combatStats!, accuracy: value },
                })
              }
            />
            <NumberField
              size="sm"
              label="evasion"
              value={variant.combatStats.evasion}
              onChange={(value) =>
                onChange({
                  ...variant,
                  combatStats: { ...variant.combatStats!, evasion: value },
                })
              }
            />
          </FieldRow>
        ) : (
          <p className="subtle">未設定</p>
        )}
      </section>

      <EffectListEditor
        title="因子効果"
        effects={variant.factorEffects}
        onChange={(effects) => onChange({ ...variant, factorEffects: effects })}
      />
      <EffectListEditor
        title="追加効果"
        effects={variant.additionalEffects}
        onChange={(effects) => onChange({ ...variant, additionalEffects: effects })}
      />

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
        <div className="story-block-list">
          {job.skills.map((skill, index) => (
            <div key={`${skill.skillId}-${index}`} className="story-block">
              <div className="story-block-head">
                <strong>{skill.skillId || '(skill 未設定)'}</strong>
                <div className="pattern-actions">
                  <button
                    className="icon-btn"
                    onClick={() => onChange({ ...job, skills: moveItem(job.skills, index, -1) })}
                  >
                    ↑
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => onChange({ ...job, skills: moveItem(job.skills, index, 1) })}
                  >
                    ↓
                  </button>
                  <button
                    className="icon-btn danger"
                    onClick={() =>
                      onChange({
                        ...job,
                        skills: job.skills.filter((_, entryIndex) => entryIndex !== index),
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              </div>
              <FieldRow>
                <TextField
                  size="lg"
                  label="skillId"
                  value={skill.skillId}
                  onChange={(value) =>
                    onChange({
                      ...job,
                      skills: job.skills.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, skillId: value } : entry,
                      ),
                    })
                  }
                />
                <OptionalNumberField
                  size="sm"
                  label="unlockLevel"
                  value={skill.unlockLevel}
                  min={1}
                  onChange={(value) =>
                    onChange({
                      ...job,
                      skills: job.skills.map((entry, entryIndex) =>
                        entryIndex === index
                          ? { ...entry, unlockLevel: value }
                          : entry,
                      ),
                    })
                  }
                />
              </FieldRow>
              <SkillMeta skillId={skill.skillId} />
            </div>
          ))}
          {job.skills.length === 0 && <p className="subtle">未設定</p>}
        </div>
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
  effects: GoblinVariantSeed['factorEffects']
  onChange: (effects: GoblinVariantSeed['factorEffects']) => void
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

function SkillIdListEditor({
  skillIds,
  onChange,
}: {
  skillIds: string[]
  onChange: (skillIds: string[]) => void
}) {
  return (
    <div className="story-block-list">
      {skillIds.map((skillId, index) => (
            <div key={`${skillId}-${index}`} className="story-block">
          <div className="story-block-head">
            <strong>{skillId || '(skill 未設定)'}</strong>
            <div className="pattern-actions">
              <button className="icon-btn" onClick={() => onChange(moveItem(skillIds, index, -1))}>
                ↑
              </button>
              <button className="icon-btn" onClick={() => onChange(moveItem(skillIds, index, 1))}>
                ↓
              </button>
              <button
                className="icon-btn danger"
                onClick={() => onChange(skillIds.filter((_, entryIndex) => entryIndex !== index))}
              >
                ×
              </button>
            </div>
          </div>
          <TextField
            size="xl"
            label="skillId"
            value={skillId}
            onChange={(value) =>
              onChange(
                skillIds.map((entry, entryIndex) => (entryIndex === index ? value : entry)),
              )
            }
          />
          <SkillMeta skillId={skillId} />
        </div>
      ))}
      <button className="btn ghost small" onClick={() => onChange([...skillIds, ''])}>
        + 追加
      </button>
    </div>
  )
}

function SkillMeta({ skillId }: { skillId: string }) {
  if (!skillId) return null
  try {
    const skill = getCharacterSkillDefinition(skillId)
    return (
      <div className="goblin-skill-meta">
        <div className="subtle">
          <code>{getSkillNameKey(skillId)}</code>
        </div>
        <div>{getSkillLabel(skill)}</div>
      </div>
    )
  } catch {
    return (
      <div className="goblin-skill-meta">
        <div className="subtle">
          <code>{getSkillNameKey(skillId)}</code>
        </div>
        <div className="save-error">skillCatalog に存在しません</div>
      </div>
    )
  }
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction
  if (target < 0 || target >= items.length) return items
  const next = items.slice()
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

function getSkillNameKey(skillId: string): string {
  return `entities.skill.${skillId}.name`
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
