import { useMemo, useState } from 'react'

import type { EnemyDatabase } from '../lib/schema'
import {
  FieldGroup,
  NumberField,
  OptionalNumberField,
  TextField,
} from './fields'

type Enemy = EnemyDatabase['enemies'][number]

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
                <td className="num">{e.agility}</td>
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
  const set = <K extends keyof Enemy>(key: K, value: Enemy[K]) =>
    onChange((prev) => ({ ...prev, [key]: value }))

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

      <h4>ステータス</h4>
      <FieldGroup columns={2}>
        <NumberField label="level" value={enemy.level} min={0} onChange={(v) => set('level', v)} />
        <NumberField label="hp" value={enemy.hp} min={0} onChange={(v) => set('hp', v)} />
        <NumberField label="atk" value={enemy.atk} min={0} onChange={(v) => set('atk', v)} />
        <NumberField label="def" value={enemy.def} min={0} onChange={(v) => set('def', v)} />
        <NumberField
          label="agility"
          value={enemy.agility}
          min={0}
          onChange={(v) => set('agility', v)}
        />
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

      <h4>オプション</h4>
      <FieldGroup columns={2}>
        <OptionalNumberField
          label="vitality"
          value={enemy.vitality}
          min={0}
          onChange={(v) => set('vitality', v)}
        />
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

      <ExtraJsonSection
        label="skills"
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
      <ExtraJsonSection
        label="equipmentDrops"
        value={(enemy as any).equipmentDrops}
        onChange={(v) => onChange((prev) => ({ ...prev, equipmentDrops: v }) as Enemy)}
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
