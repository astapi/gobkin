import { useEffect, useMemo, useState } from 'react'

import {
  CHARACTER_SKILL_CATALOG,
  getCharacterSkill,
  getCharacterSkillDefinition,
  isCharacterSkillId,
} from '@app/shared/data/skillCatalog'
import { getCharacterSkillDescription } from '@app/shared/data/characterSkills'
import ja from '@app/shared/i18n/resources/ja'
import { getSkillLabel } from '@app/shared/i18n/entityLocalization'
import type { CharacterSkill } from '@app/shared/types/CharacterSkill'

import { FieldRow, OptionalNumberField, type FieldSize } from './fields'

const SKILL_IDS = Object.keys(CHARACTER_SKILL_CATALOG).sort((a, b) =>
  getSkillOptionLabel(a).localeCompare(getSkillOptionLabel(b), 'ja'),
)

export function SkillIdListEditor({
  skillIds,
  onChange,
  addLabel = '+ 追加',
}: {
  skillIds: string[]
  onChange: (skillIds: string[]) => void
  addLabel?: string
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
          <SkillSelectField
            size="xl"
            label="skillId"
            value={skillId}
            onChange={(value) =>
              onChange(skillIds.map((entry, entryIndex) => (entryIndex === index ? value : entry)))
            }
          />
          <SkillMeta skillId={skillId} />
        </div>
      ))}
      <button className="btn ghost small" onClick={() => onChange([...skillIds, ''])}>
        {addLabel}
      </button>
    </div>
  )
}

export function JobSkillListEditor({
  skills,
  onChange,
}: {
  skills: Array<{ skillId: string; unlockLevel?: number }>
  onChange: (skills: Array<{ skillId: string; unlockLevel?: number }>) => void
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
              onChange={(value) =>
                onChange(
                  skills.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, skillId: value } : entry,
                  ),
                )
              }
            />
            <OptionalNumberField
              size="sm"
              label="unlockLevel"
              value={skill.unlockLevel}
              min={1}
              onChange={(value) =>
                onChange(
                  skills.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, unlockLevel: value } : entry,
                  ),
                )
              }
            />
          </FieldRow>
          <SkillMeta skillId={skill.skillId} />
        </div>
      ))}
    </div>
  )
}

export function EnemySkillListEditor({
  skills,
  onChange,
}: {
  skills: CharacterSkill[] | undefined
  onChange: (skills: CharacterSkill[] | undefined) => void
}) {
  const entries = skills ?? []

  return (
    <section className="card">
      <div className="section-head">
        <h4>スキル</h4>
        <button
          className="btn ghost small"
          onClick={() => onChange([...entries, { id: '' }])}
        >
          + 追加
        </button>
      </div>
      <div className="story-block-list">
        {entries.map((skill, index) => (
          <div key={`${skill.id}-${index}`} className="story-block">
            <div className="story-block-head">
              <strong>{skill.id || '(skill 未設定)'}</strong>
              <div className="pattern-actions">
                <button className="icon-btn" onClick={() => onChange(moveItem(entries, index, -1))}>
                  ↑
                </button>
                <button className="icon-btn" onClick={() => onChange(moveItem(entries, index, 1))}>
                  ↓
                </button>
                <button
                  className="icon-btn danger"
                  onClick={() => {
                    const next = entries.filter((_, entryIndex) => entryIndex !== index)
                    onChange(next.length > 0 ? next : undefined)
                  }}
                >
                  ×
                </button>
              </div>
            </div>
            <SkillSelectField
              size="xl"
              label="skillId"
              value={skill.id}
              onChange={(value) =>
                onChange(
                  entries.map((entry, entryIndex) =>
                    entryIndex === index ? toEnemySkill(value, entry) : entry,
                  ),
                )
              }
            />
            {!isCharacterSkillId(skill.id) && skill.id && (
              <p className="subtle skill-editor-note">
                catalog 未登録の独自スキルです。選び直すと skillCatalog 定義に置き換わります。
              </p>
            )}
            <SkillMeta skillId={skill.id} />
          </div>
        ))}
        {entries.length === 0 && <p className="subtle">未設定</p>}
      </div>
    </section>
  )
}

export function SkillSelectField({
  label,
  value,
  onChange,
  size,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  size?: FieldSize
}) {
  const [query, setQuery] = useState('')
  const className = size ? `field field-size-${size}` : 'field'
  const options = value && !SKILL_IDS.includes(value) ? [value, ...SKILL_IDS] : SKILL_IDS
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (normalizedQuery === '') return options

    return options.filter((skillId) => {
      const skill = isCharacterSkillId(skillId) ? getCharacterSkillDefinition(skillId) : null
      const label = skill ? getStudioSkillLabel(skill) : ''
      const description = skill ? getCharacterSkillDescription(skill) : ''
      const haystacks = [skillId, label, description].map((entry) => String(entry ?? ''))
      return haystacks.some((entry) => entry.toLowerCase().includes(normalizedQuery))
    })
  }, [options, query])

  useEffect(() => {
    setQuery('')
  }, [value])

  return (
    <label className={className}>
      <span className="field-label">{label}</span>
      <span className="skill-select-stack">
        <span className="field-input">
          <input
            type="search"
            value={query}
            placeholder="日本語名 / skillId / 説明で絞り込み"
            onChange={(e) => setQuery(e.target.value)}
          />
        </span>
        <span className="field-input">
          <select value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">(未設定)</option>
            {filteredOptions.map((skillId) => (
              <option key={skillId} value={skillId}>
                {getSkillOptionLabel(skillId)}
              </option>
            ))}
          </select>
        </span>
        {query.trim() !== '' && filteredOptions.length === 0 && (
          <span className="subtle skill-select-empty">該当するスキルがありません</span>
        )}
      </span>
    </label>
  )
}

export function SkillMeta({ skillId }: { skillId: string }) {
  if (!skillId) return null
  try {
    const skill = getCharacterSkillDefinition(skillId)
    return (
      <div className="goblin-skill-meta">
        <div className="subtle">
          <code>{getSkillNameKey(skillId)}</code>
        </div>
        <div>{getStudioSkillLabel(skill)}</div>
        <div className="subtle">{getCharacterSkillDescription(skill)}</div>
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

function getSkillOptionLabel(skillId: string): string {
  if (!isCharacterSkillId(skillId)) {
    return `${skillId} / catalog未登録`
  }

  const skill = getCharacterSkillDefinition(skillId)
  const label = getStudioSkillLabel(skill) || getCharacterSkillDescription(skill) || skillId
  return `${label} / ${skillId}`
}

function getStudioSkillLabel(skill: CharacterSkill): string {
  const localized = ja.entities.skill[skill.id as keyof typeof ja.entities.skill]?.name
  return localized || getSkillLabel(skill) || skill.id
}

function getSkillNameKey(skillId: string): string {
  return `entities.skill.${skillId}.name`
}

function toEnemySkill(skillId: string, current: CharacterSkill): CharacterSkill {
  if (skillId === '') return { id: '' }
  if (!isCharacterSkillId(skillId)) return current.id === skillId ? current : { id: skillId }
  return getCharacterSkill(skillId)
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction
  if (target < 0 || target >= items.length) return items
  const next = items.slice()
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
