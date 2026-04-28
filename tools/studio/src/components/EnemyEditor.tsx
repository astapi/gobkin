import { useEffect, useMemo, useState } from 'react'
import {
  calculateEnemyBaseHpFromInputs,
  detectEnemyHpSpecies,
  getEnemyHpSpeciesCoefficient,
  type EnemyHpSpecies,
} from '@app/shared/utils/enemyStats'
import { races } from '@app/shared/data/races'
import { getRaceResistanceTotals } from '@app/shared/data/races'
import type { CharacterSkill } from '@app/shared/types/CharacterSkill'

import type { EnemyDatabase } from '../lib/schema'
import {
  FieldGroup,
  FieldRow,
  NumberField,
  OptionalNumberField,
  TextField,
} from './fields'
import { EnemySkillListEditor } from './SkillEditors'
import { RareEquipmentDropsEditor } from './RareEquipmentDropsEditor'

type Enemy = EnemyDatabase['enemies'][number]
const raceEntries = Object.entries(races).sort((a, b) => a[1].label.localeCompare(b[1].label, 'ja'))

export function EnemyEditor({
  enemy,
  onChange,
}: {
  enemy: EnemyDatabase
  onChange: (updater: (prev: EnemyDatabase) => EnemyDatabase) => void
}) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(enemy.enemies[0]?.id ?? null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q === '') return enemy.enemies
    return enemy.enemies.filter(
      (e) =>
        e.id.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.raceTags.some((tag) => tag.toLowerCase().includes(q)),
    )
  }, [enemy.enemies, query])

  const selectedIndex = enemy.enemies.findIndex((e) => e.id === selectedId)
  const selected = selectedIndex >= 0 ? enemy.enemies[selectedIndex] : null

  const updateSelected = (updater: (prev: Enemy) => Enemy) => {
    if (selectedIndex < 0) return
    onChange((prev) => {
      const next = prev.enemies.slice()
      next[selectedIndex] = updater(next[selectedIndex])
      return { ...prev, enemies: next }
    })
  }

  return (
    <div className="enemy-layout">
      <div className="enemy-list">
        <input
          type="search"
          placeholder="id / name / raceTag で絞り込み"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
        />
        <table className="enemy-table">
          <thead>
            <tr>
              <th>id</th>
              <th>name</th>
              <th className="num">Lv</th>
              <th className="num">HP</th>
              <th className="num">ATK</th>
              <th className="num">DEF</th>
              <th className="num">AGI</th>
              <th className="num">EXP</th>
              <th className="num">Gold</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr
                key={e.id}
                className={selectedId === e.id ? 'selected' : ''}
                onClick={() => setSelectedId(e.id)}
              >
                <td><code>{e.id}</code></td>
                <td>{e.name}</td>
                <td className="num">{e.level}</td>
                <td className="num">{e.hp}</td>
                <td className="num">{e.atk}</td>
                <td className="num">{e.def}</td>
                <td className="num">{e.baseAttributes.agility}</td>
                <td className="num">{e.exp}</td>
                <td className="num">{e.gold}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="subtle">該当する敵がいません</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {selected && <EnemyForm enemy={selected} onChange={updateSelected} />}
    </div>
  )
}

function EnemyForm({
  enemy,
  onChange,
}: {
  enemy: Enemy
  onChange: (updater: (prev: Enemy) => Enemy) => void
}) {
  const [hpSpecies, setHpSpecies] = useState<EnemyHpSpecies>(() => detectEnemyHpSpecies(enemy.raceTags))
  useEffect(() => {
    setHpSpecies(detectEnemyHpSpecies(enemy.raceTags))
  }, [enemy.id, enemy.raceTags])
  const set = <K extends keyof Enemy>(key: K, value: Enemy[K]) =>
    onChange((prev) => ({ ...prev, [key]: value }))
  const setBaseAttribute = (key: keyof Enemy['baseAttributes'], value: number) =>
    onChange((prev) => ({
      ...prev,
      baseAttributes: {
        ...prev.baseAttributes,
        [key]: value,
      },
    }))
  const calculatedHp = calculateEnemyBaseHpFromInputs(enemy.level, enemy.baseAttributes.vitality, hpSpecies)
  const hpCoefficient = getEnemyHpSpeciesCoefficient(hpSpecies)
  const raceResistance = getRaceResistanceTotals(enemy.raceTags)
  const toggleRaceTag = (raceId: string) =>
    set(
      'raceTags',
      enemy.raceTags.includes(raceId)
        ? enemy.raceTags.filter((tag) => tag !== raceId)
        : [...enemy.raceTags, raceId],
    )

  return (
    <aside className="card enemy-detail">
      <h3>
        {enemy.name} <span className="subtle">/ <code>{enemy.id}</code></span>
      </h3>
      <FieldGroup columns={1}>
        <TextField
          label="id"
          value={enemy.id}
          onChange={(v) => set('id', v)}
        />
        <TextField
          label="name"
          value={enemy.name}
          onChange={(v) => set('name', v)}
        />
        <TextField
          label="raceTags (カンマ区切り)"
          value={enemy.raceTags.join(', ')}
          onChange={(v) =>
            set(
              'raceTags',
              v
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
        />
      </FieldGroup>
      <div className="race-tag-picker">
        {raceEntries.map(([raceId, race]) => (
          <button
            key={raceId}
            type="button"
            className={enemy.raceTags.includes(raceId) ? 'btn ghost small active-filter' : 'btn ghost small'}
            onClick={() => toggleRaceTag(raceId)}
            title={race.implies?.length ? `implies: ${race.implies.join(', ')}` : undefined}
          >
            {race.label}
          </button>
        ))}
      </div>
      <p className="subtle">
        race由来耐性: 物理 {raceResistance.physicalResistancePercent}% / 貫通 {raceResistance.penetrationResistancePercent}% / 必殺 {raceResistance.criticalResistancePercent}% / 魔法 {raceResistance.magicResistancePercent}%
      </p>

      <h4>ステータス</h4>
      <FieldRow>
        <label className="field field-size-md">
          <span className="field-label">HP算出用種族</span>
          <span className="field-input">
            <select value={hpSpecies} onChange={(e) => setHpSpecies(e.target.value as EnemyHpSpecies)}>
              <option value="goblin">ゴブリン x0.8</option>
              <option value="beast">魔獣 x1.1</option>
              <option value="human">人間 x1.0</option>
              <option value="demon_race">魔族 x1.3</option>
            </select>
          </span>
        </label>
        <button type="button" className="btn ghost small" onClick={() => set('hp', calculatedHp)}>
          算出HPを反映
        </button>
      </FieldRow>
      <p className="subtle">
        Lv {enemy.level} / 体力 {enemy.baseAttributes.vitality} / 種族係数 {hpCoefficient} → 算出HP {calculatedHp}
      </p>
      <FieldGroup columns={2}>
        <NumberField label="level" value={enemy.level} min={0} onChange={(v) => set('level', v)} />
        <NumberField label="hp" value={enemy.hp} min={0} onChange={(v) => set('hp', v)} />
        <NumberField label="atk" value={enemy.atk} min={0} onChange={(v) => set('atk', v)} />
        <NumberField label="def" value={enemy.def} min={0} onChange={(v) => set('def', v)} />
        <NumberField
          label="attackCount"
          value={enemy.attackCount}
          min={1}
          onChange={(v) => set('attackCount', v)}
        />
        <NumberField
          label="accuracy"
          value={enemy.accuracy}
          min={0}
          onChange={(v) => set('accuracy', v)}
        />
        <NumberField
          label="evasion"
          value={enemy.evasion}
          min={0}
          onChange={(v) => set('evasion', v)}
        />
        <NumberField label="exp" value={enemy.exp} min={0} onChange={(v) => set('exp', v)} />
        <NumberField label="gold" value={enemy.gold} min={0} onChange={(v) => set('gold', v)} />
      </FieldGroup>

      <h4>基本能力値</h4>
      <FieldGroup columns={2}>
        <NumberField label="power" value={enemy.baseAttributes.power} min={0} onChange={(v) => setBaseAttribute('power', v)} />
        <NumberField label="wisdom" value={enemy.baseAttributes.wisdom} min={0} onChange={(v) => setBaseAttribute('wisdom', v)} />
        <NumberField label="spirit" value={enemy.baseAttributes.spirit} min={0} onChange={(v) => setBaseAttribute('spirit', v)} />
        <NumberField label="vitality" value={enemy.baseAttributes.vitality} min={0} onChange={(v) => setBaseAttribute('vitality', v)} />
        <NumberField label="agility" value={enemy.baseAttributes.agility} min={0} onChange={(v) => setBaseAttribute('agility', v)} />
        <NumberField label="luck" value={enemy.baseAttributes.luck} min={0} onChange={(v) => setBaseAttribute('luck', v)} />
      </FieldGroup>

      <h4>オプション</h4>
      <FieldGroup columns={2}>
        <OptionalNumberField
          label="magicAtk"
          value={enemy.magicAtk}
          min={0}
          onChange={(v) => set('magicAtk', v)}
        />
        <OptionalNumberField
          label="magicDef"
          value={enemy.magicDef}
          min={0}
          onChange={(v) => set('magicDef', v)}
        />
        <OptionalNumberField
          label="magicHeal"
          value={enemy.magicHeal}
          min={0}
          onChange={(v) => set('magicHeal', v)}
        />
        <OptionalNumberField
          label="criticalRate"
          value={enemy.criticalRate}
          min={0}
          onChange={(v) => set('criticalRate', v)}
        />
      </FieldGroup>

      <h4>耐性 (%)</h4>
      <FieldGroup columns={2}>
        <OptionalNumberField
          label="physical"
          value={enemy.physicalResistancePercent}
          onChange={(v) => set('physicalResistancePercent', v)}
        />
        <OptionalNumberField
          label="penetration"
          value={enemy.penetrationResistancePercent}
          onChange={(v) => set('penetrationResistancePercent', v)}
        />
        <OptionalNumberField
          label="critical"
          value={enemy.criticalResistancePercent}
          onChange={(v) => set('criticalResistancePercent', v)}
        />
        <OptionalNumberField
          label="magic"
          value={enemy.magicResistancePercent}
          onChange={(v) => set('magicResistancePercent', v)}
        />
      </FieldGroup>

      <EnemySkillListEditor
        skills={(enemy as Enemy & { skills?: CharacterSkill[] }).skills}
        onChange={(skills) => onChange((prev) => ({ ...prev, skills }) as Enemy)}
      />
      <ExtraJsonSection
        label="skills JSON"
        value={(enemy as any).skills}
        onChange={(v) => onChange((prev) => ({ ...prev, skills: v }) as Enemy)}
      />
      <ExtraJsonSection
        label="spells"
        value={(enemy as any).spells}
        onChange={(v) => onChange((prev) => ({ ...prev, spells: v }) as Enemy)}
      />
      <ExtraJsonSection
        label="factorDrops"
        value={(enemy as any).factorDrops}
        onChange={(v) => onChange((prev) => ({ ...prev, factorDrops: v }) as Enemy)}
      />
      <RareEquipmentDropsEditor
        rareEquipmentDrops={
          (enemy as Enemy & { rareEquipmentDrops?: Array<{ templateId: string }> }).rareEquipmentDrops
        }
        onChange={(rareEquipmentDrops) =>
          onChange((prev) => {
            const next = { ...prev } as Enemy & { rareEquipmentDrops?: Array<{ templateId: string }> }
            if (!rareEquipmentDrops || rareEquipmentDrops.length === 0) {
              delete next.rareEquipmentDrops
            } else {
              next.rareEquipmentDrops = rareEquipmentDrops
            }
            return next as Enemy
          })
        }
      />
    </aside>
  )
}

function ExtraJsonSection({
  label,
  value,
  onChange,
}: {
  label: string
  value: unknown
  onChange: (v: unknown) => void
}) {
  const [text, setText] = useState(() =>
    value === undefined ? '' : JSON.stringify(value, null, 2),
  )
  const [dirtyLocal, setDirtyLocal] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  useEffect(() => {
    if (dirtyLocal) return
    setText(value === undefined ? '' : JSON.stringify(value, null, 2))
    setParseError(null)
  }, [dirtyLocal, value])

  return (
    <details className="json-section">
      <summary>{label}{Array.isArray(value) ? ` (${value.length})` : value !== undefined ? ' (設定あり)' : ' (未設定)'}</summary>
      <textarea
        className="json-editor"
        value={text}
        rows={Math.min(12, Math.max(3, text.split('\n').length))}
        onChange={(e) => {
          setText(e.target.value)
          setDirtyLocal(true)
          setParseError(null)
        }}
        placeholder="[] または未入力で削除"
      />
      {parseError && <p className="save-error">{parseError}</p>}
      <div className="json-section-actions">
        <button
          className="btn ghost"
          disabled={!dirtyLocal}
          onClick={() => {
            if (text.trim() === '') {
              onChange(undefined)
              setDirtyLocal(false)
              setParseError(null)
              return
            }
            try {
              onChange(JSON.parse(text))
              setDirtyLocal(false)
              setParseError(null)
            } catch (err) {
              setParseError(err instanceof Error ? err.message : String(err))
            }
          }}
        >
          適用
        </button>
      </div>
    </details>
  )
}
