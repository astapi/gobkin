import type {
  EquipmentCategory,
  EquipmentStat,
  EquipmentStatBonus,
  EquipmentTemplate,
  WeaponRange,
  WeaponSubCategory,
} from '../lib/schema'
import {
  FieldGroup,
  FieldRow,
  NumberField,
  OptionalNumberField,
  TextField,
} from './fields'
import { SkillIdListEditor } from './SkillEditors'

const CATEGORIES: EquipmentCategory[] = [
  'weapon',
  'armor',
  'shield',
  'gauntlet',
  'wand',
  'rod',
  'accessory',
]

const SUB_CATEGORIES: WeaponSubCategory[] = [
  'sword',
  'axe',
  'spear',
  'bow',
  'staff',
  'claw',
]

const RANGES: WeaponRange[] = ['melee', 'ranged']

const STATS: EquipmentStat[] = [
  'hp_flat',
  'atk_flat',
  'def_flat',
  'magic_atk_flat',
  'magic_def_flat',
  'attackCount_flat',
  'accuracy_flat',
  'evasion_flat',
  'magicHeal_flat',
  'hp_percent',
  'atk_percent',
  'def_percent',
  'critical_rate_percent',
  'damage_reduction',
]

export function EquipmentTemplateForm({
  template,
  onChange,
  onDelete,
}: {
  template: EquipmentTemplate
  onChange: (updater: (prev: EquipmentTemplate) => EquipmentTemplate) => void
  onDelete: () => void
}) {
  const set = <K extends keyof EquipmentTemplate>(key: K, value: EquipmentTemplate[K]) =>
    onChange((prev) => ({ ...prev, [key]: value }))

  const setOptional = <K extends keyof EquipmentTemplate>(key: K, value: EquipmentTemplate[K] | undefined) =>
    onChange((prev) => {
      const next = { ...prev }
      if (value === undefined) {
        delete next[key]
      } else {
        next[key] = value as EquipmentTemplate[K]
      }
      return next
    })

  const updateStatBonuses = (statBonuses: EquipmentStatBonus[]) => set('statBonuses', statBonuses)

  return (
    <aside className="card enemy-detail">
      <div className="section-head">
        <h3>
          {template.name} <span className="subtle">/ <code>{template.id}</code></span>
        </h3>
        <button
          className="btn ghost small danger"
          onClick={() => {
            if (window.confirm(`「${template.name}」(${template.id}) を削除しますか？`)) {
              onDelete()
            }
          }}
        >
          削除
        </button>
      </div>

      <FieldGroup columns={1}>
        <TextField label="id" value={template.id} onChange={(v) => set('id', v)} />
        <TextField label="name" value={template.name} onChange={(v) => set('name', v)} />
      </FieldGroup>

      <h4>カテゴリ</h4>
      <FieldGroup columns={3}>
        <label className="field">
          <span className="field-label">category</span>
          <span className="field-input">
            <select
              value={template.category}
              onChange={(e) => set('category', e.target.value as EquipmentCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="field">
          <span className="field-label">subCategory</span>
          <span className="field-input">
            <select
              value={template.subCategory ?? ''}
              onChange={(e) =>
                setOptional('subCategory', e.target.value === '' ? undefined : (e.target.value as WeaponSubCategory))
              }
            >
              <option value="">(未設定)</option>
              {SUB_CATEGORIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="field">
          <span className="field-label">range</span>
          <span className="field-input">
            <select
              value={template.range ?? ''}
              onChange={(e) =>
                setOptional('range', e.target.value === '' ? undefined : (e.target.value as WeaponRange))
              }
            >
              <option value="">(未設定)</option>
              {RANGES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </span>
        </label>
      </FieldGroup>

      <h4>価格・ランク</h4>
      <FieldGroup columns={3}>
        <NumberField
          label="price"
          value={template.price}
          min={0}
          onChange={(v) => set('price', v)}
        />
        <OptionalNumberField
          label="unlockRank (店売り)"
          value={template.unlockRank}
          min={0}
          onChange={(v) => setOptional('unlockRank', v)}
        />
        <OptionalNumberField
          label="rank (敵ドロップ)"
          value={template.rank}
          min={0}
          onChange={(v) => setOptional('rank', v)}
        />
      </FieldGroup>
      <label className="field">
        <span className="field-input">
          <input
            type="checkbox"
            checked={template.isRare === true}
            onChange={(e) => setOptional('isRare', e.target.checked ? true : undefined)}
          />
          <span style={{ marginLeft: '0.4rem' }}>
            レアアイテム (装備一覧で同カテゴリ内のレア枠に並びます)
          </span>
        </span>
      </label>

      <h4>statBonuses</h4>
      <StatBonusListEditor bonuses={template.statBonuses} onChange={updateStatBonuses} />

      <h4>付与スキル (skillId)</h4>
      <SkillIdListEditor
        skillIds={template.grantedSkillIds ?? []}
        onChange={(skillIds) =>
          setOptional('grantedSkillIds', skillIds.length > 0 ? skillIds : undefined)
        }
      />
    </aside>
  )
}

function StatBonusListEditor({
  bonuses,
  onChange,
}: {
  bonuses: EquipmentStatBonus[]
  onChange: (next: EquipmentStatBonus[]) => void
}) {
  const updateAt = (index: number, updater: (prev: EquipmentStatBonus) => EquipmentStatBonus) => {
    onChange(bonuses.map((b, i) => (i === index ? updater(b) : b)))
  }
  const removeAt = (index: number) => {
    onChange(bonuses.filter((_, i) => i !== index))
  }
  return (
    <div className="story-block-list">
      {bonuses.map((bonus, index) => (
        <div key={index} className="story-block">
          <div className="story-block-head">
            <strong>{bonus.stat}</strong>
            <div className="pattern-actions">
              <button className="icon-btn danger" onClick={() => removeAt(index)}>
                ×
              </button>
            </div>
          </div>
          <FieldRow>
            <label className="field field-size-md">
              <span className="field-label">stat</span>
              <span className="field-input">
                <select
                  value={bonus.stat}
                  onChange={(e) => updateAt(index, (prev) => ({ ...prev, stat: e.target.value as EquipmentStat }))}
                >
                  {STATS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <NumberField
              size="sm"
              label="value"
              value={bonus.value}
              step={0.1}
              onChange={(v) => updateAt(index, (prev) => ({ ...prev, value: v }))}
            />
          </FieldRow>
        </div>
      ))}
      <button
        className="btn ghost small"
        onClick={() => onChange([...bonuses, { stat: 'atk_flat', value: 0 }])}
      >
        + statBonus を追加
      </button>
    </div>
  )
}
