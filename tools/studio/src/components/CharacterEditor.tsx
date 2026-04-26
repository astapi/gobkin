import { useEffect, useMemo, useState } from 'react'

import {
  DEFAULT_DRAFT,
  PURE_GOBLIN_VARIANT_ID,
  buildCustomGoblin,
  draftFromBackupGoblin,
  listJobOptions,
  listSkillOptions,
  listVariantOptions,
  nextCustomGoblinId,
  type CharacterDraft,
} from '../lib/customGoblin'
import type { CharacterSkillId } from '@app/shared/data/skillCatalog'
import type { GoblinJob } from '@app/shared/types'
import type { BackupGoblin } from '../lib/goblinMapper'

const SKILL_OPTIONS = listSkillOptions()
const VARIANT_OPTIONS = listVariantOptions()
const JOB_OPTIONS = listJobOptions()

interface Props {
  open: boolean
  editingId: number | null
  existingGoblins: BackupGoblin[]
  onClose: () => void
  onSubmit: (goblin: BackupGoblin) => void | Promise<void>
  onDelete?: (id: number) => void | Promise<void>
}

export function CharacterEditor({
  open,
  editingId,
  existingGoblins,
  onClose,
  onSubmit,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState<CharacterDraft>(DEFAULT_DRAFT)
  const [skillQuery, setSkillQuery] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setSubmitError(null)
    setSkillQuery('')
    if (editingId !== null) {
      const target = existingGoblins.find((g) => g.id === editingId)
      if (target) {
        setDraft(draftFromBackupGoblin(target))
        return
      }
    }
    setDraft({ ...DEFAULT_DRAFT })
  }, [open, editingId, existingGoblins])

  const previewResult = useMemo(() => {
    if (!open) return null
    try {
      const id = editingId ?? nextCustomGoblinId(existingGoblins.map((g) => g.id))
      return buildCustomGoblin(draft, { id })
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) } as const
    }
  }, [draft, editingId, existingGoblins, open])

  const filteredSkills = useMemo(() => {
    const q = skillQuery.trim().toLowerCase()
    if (q === '') return SKILL_OPTIONS.slice(0, 60)
    return SKILL_OPTIONS.filter((s) => s.label.toLowerCase().includes(q)).slice(
      0,
      120,
    )
  }, [skillQuery])

  if (!open) return null

  const previewGoblin =
    previewResult && 'goblin' in previewResult ? previewResult.goblin : null
  const previewError =
    previewResult && 'error' in previewResult ? previewResult.error : null
  const baseSkillIds =
    previewResult && 'baseDefaultSkillIds' in previewResult
      ? previewResult.baseDefaultSkillIds
      : []
  const baseSkillIdSet = new Set(baseSkillIds)

  const toggleSkill = (id: CharacterSkillId) => {
    setDraft((prev) => {
      if (prev.extraSkillIds.includes(id)) {
        return { ...prev, extraSkillIds: prev.extraSkillIds.filter((x) => x !== id) }
      }
      if (baseSkillIdSet.has(id)) return prev
      return { ...prev, extraSkillIds: [...prev.extraSkillIds, id] }
    })
  }

  const handleSubmit = async () => {
    if (!previewGoblin) return
    if (draft.name.trim() === '') {
      setSubmitError('名前を入力してください')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit(previewGoblin)
      onClose()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (editingId === null || !onDelete) return
    if (
      !window.confirm('このキャラクターを削除しますか？（PT/プリセット側からも外れます）')
    )
      return
    setSubmitting(true)
    try {
      await onDelete(editingId)
      onClose()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>{editingId !== null ? 'キャラクター編集' : '新規キャラクター作成'}</h2>
          <button className="icon-btn" onClick={onClose} title="閉じる">
            ×
          </button>
        </header>

        <div className="modal-body">
          <div className="character-editor-grid">
            <label className="field">
              <span className="field-label">名前</span>
              <span className="field-input">
                <input
                  type="text"
                  value={draft.name}
                  placeholder="例: 試作ゴブリン"
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </span>
            </label>

            <label className="field">
              <span className="field-label">亜種（因子）</span>
              <span className="field-input">
                <select
                  value={draft.variantId}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      variantId: e.target.value,
                      job: e.target.value === PURE_GOBLIN_VARIANT_ID ? prev.job : null,
                    }))
                  }
                >
                  {VARIANT_OPTIONS.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            <label className="field">
              <span className="field-label">ジョブ</span>
              <span className="field-input">
                <select
                  value={draft.job ?? ''}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      job: (e.target.value || null) as GoblinJob | null,
                    }))
                  }
                  disabled={draft.variantId !== PURE_GOBLIN_VARIANT_ID}
                  title={
                    draft.variantId !== PURE_GOBLIN_VARIANT_ID
                      ? '亜種ゴブリンはジョブを設定できません'
                      : undefined
                  }
                >
                  {JOB_OPTIONS.map((j) => (
                    <option key={j.id ?? '__none__'} value={j.id ?? ''}>
                      {j.label}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            <label className="field">
              <span className="field-label">レベル</span>
              <span className="field-input">
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={draft.level}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      level: clamp(Number(e.target.value) || 1, 1, 200),
                    }))
                  }
                />
              </span>
            </label>

            <label className="field">
              <span className="field-label">個体値 (1〜64)</span>
              <span className="field-input">
                <input
                  type="number"
                  min={1}
                  max={64}
                  value={draft.individualValue}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      individualValue: clamp(
                        Number(e.target.value) || 1,
                        1,
                        64,
                      ),
                    }))
                  }
                />
              </span>
            </label>
          </div>

          <section className="character-editor-section">
            <h3>付与スキル</h3>
            <p className="subtle" style={{ marginTop: 0 }}>
              種族・亜種・ジョブの既定スキルは自動付与されます。それ以外で追加したいスキルを選択してください。
            </p>
            <div className="character-editor-skill-summary">
              <div>
                <strong>既定:</strong>{' '}
                {baseSkillIds.length === 0 ? (
                  <span className="subtle">なし</span>
                ) : (
                  baseSkillIds.map((id) => (
                    <code key={id} className="skill-chip">
                      {id}
                    </code>
                  ))
                )}
              </div>
              <div>
                <strong>追加 ({draft.extraSkillIds.length}):</strong>{' '}
                {draft.extraSkillIds.length === 0 ? (
                  <span className="subtle">なし</span>
                ) : (
                  draft.extraSkillIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className="skill-chip removable"
                      onClick={() => toggleSkill(id)}
                      title="クリックで外す"
                    >
                      {id} ×
                    </button>
                  ))
                )}
              </div>
            </div>
            <input
              type="search"
              className="search-input"
              placeholder="スキル名 / IDで絞り込み"
              value={skillQuery}
              onChange={(e) => setSkillQuery(e.target.value)}
              style={{ marginTop: '0.5rem' }}
            />
            <div className="character-editor-skill-list">
              {filteredSkills.map((s) => {
                const isBase = baseSkillIdSet.has(s.id)
                const isExtra = draft.extraSkillIds.includes(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`skill-chip ${isExtra ? 'selected' : ''} ${
                      isBase ? 'base' : ''
                    }`}
                    onClick={() => toggleSkill(s.id)}
                    disabled={isBase}
                    title={isBase ? '既定で付与済み' : s.label}
                  >
                    {s.label}
                  </button>
                )
              })}
              {filteredSkills.length === 0 && (
                <span className="subtle">該当スキルがありません</span>
              )}
            </div>
          </section>

          <section className="character-editor-section">
            <h3>ステータスプレビュー</h3>
            {previewError && <p className="save-error">{previewError}</p>}
            {previewGoblin && (
              <div className="character-editor-stats">
                <StatRow label="HP" value={previewGoblin.effectiveStats?.hp ?? previewGoblin.stats.hp} base={previewGoblin.stats.hp} />
                <StatRow label="ATK" value={previewGoblin.effectiveStats?.atk ?? previewGoblin.stats.atk} base={previewGoblin.stats.atk} />
                <StatRow label="DEF" value={previewGoblin.effectiveStats?.def ?? previewGoblin.stats.def} base={previewGoblin.stats.def} />
                <StatRow label="M-ATK" value={previewGoblin.effectiveStats?.magicAtk ?? previewGoblin.stats.magicAtk ?? 0} base={previewGoblin.stats.magicAtk ?? 0} />
                <StatRow label="M-DEF" value={previewGoblin.effectiveStats?.magicDef ?? previewGoblin.stats.magicDef ?? 0} base={previewGoblin.stats.magicDef ?? 0} />
                <StatRow label="HEAL" value={previewGoblin.effectiveStats?.magicHeal ?? previewGoblin.stats.magicHeal ?? 0} base={previewGoblin.stats.magicHeal ?? 0} />
                <StatRow label="ATK回数" value={previewGoblin.effectiveStats?.attackCount ?? previewGoblin.stats.attackCount} base={previewGoblin.stats.attackCount} />
                <StatRow label="命中" value={previewGoblin.effectiveStats?.accuracy ?? previewGoblin.stats.accuracy} base={previewGoblin.stats.accuracy} />
                <StatRow label="回避" value={previewGoblin.effectiveStats?.evasion ?? previewGoblin.stats.evasion} base={previewGoblin.stats.evasion} />
                <StatRow label="必殺" value={previewGoblin.effectiveStats?.criticalRate ?? previewGoblin.stats.criticalRate ?? 0} base={previewGoblin.stats.criticalRate ?? 0} />
              </div>
            )}
          </section>

          {submitError && <p className="save-error">{submitError}</p>}
        </div>

        <footer className="modal-foot">
          {editingId !== null && onDelete && (
            <button
              className="btn ghost"
              onClick={handleDelete}
              disabled={submitting}
              style={{ marginRight: 'auto' }}
            >
              削除
            </button>
          )}
          <button className="btn ghost" onClick={onClose} disabled={submitting}>
            キャンセル
          </button>
          <button
            className="btn primary"
            onClick={handleSubmit}
            disabled={submitting || !previewGoblin}
          >
            {editingId !== null ? '保存' : '作成'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function StatRow({
  label,
  value,
  base,
}: {
  label: string
  value: number
  base: number
}) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        {value}
        {value !== base && <span className="subtle"> (基本 {base})</span>}
      </span>
    </div>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
