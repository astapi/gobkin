import type { AreaConfig } from '../lib/schema'
import type { FieldSize } from './fields'
import {
  FieldRow,
  NumberField,
  OptionalNumberField,
  OptionalTextField,
  TextField,
} from './fields'

type EventKey = 'battle' | 'exploring' | 'trap' | 'npc'

export function AreaSettingsEditor({
  area,
  onChange,
}: {
  area: AreaConfig
  onChange: (updater: (prev: AreaConfig) => AreaConfig) => void
}) {
  const w = area.encounter.eventWeights
  const totalWeight =
    (w.battle ?? 0) + (w.exploring ?? 0) + (w.trap ?? 0) + (w.npc ?? 0)

  const setTopField = <K extends keyof AreaConfig>(key: K, value: AreaConfig[K]) => {
    onChange((prev) => ({ ...prev, [key]: value }))
  }

  const setEncounterField = <K extends keyof AreaConfig['encounter']>(
    key: K,
    value: AreaConfig['encounter'][K],
  ) => {
    onChange((prev) => ({
      ...prev,
      encounter: { ...prev.encounter, [key]: value },
    }))
  }

  const setWeight = (key: EventKey, value: number | undefined) => {
    onChange((prev) => {
      const nextWeights = { ...prev.encounter.eventWeights }
      if (value === undefined) {
        if (key === 'battle' || key === 'exploring') {
          nextWeights[key] = 0
        } else {
          delete nextWeights[key]
        }
      } else {
        nextWeights[key] = value
      }
      return {
        ...prev,
        encounter: { ...prev.encounter, eventWeights: nextWeights },
      }
    })
  }

  return (
    <div className="panel-stack">
      <section className="card">
        <h3>基本情報</h3>
        <FieldRow>
          <TextField
            size="md"
            label="id"
            value={area.id}
            onChange={(v) => setTopField('id', v)}
          />
          <TextField
            size="lg"
            label="name"
            value={area.name}
            onChange={(v) => setTopField('name', v)}
          />
          <NumberField
            size="xs"
            label="areaLevel"
            value={area.areaLevel}
            min={0}
            onChange={(v) => setTopField('areaLevel', v)}
          />
          <NumberField
            size="xs"
            label="floors"
            value={area.floors}
            min={1}
            onChange={(v) => setTopField('floors', v)}
          />
          <NumberField
            size="sm"
            label="baseDurationSec"
            value={area.baseDurationSec}
            min={1}
            suffix="秒"
            onChange={(v) => setTopField('baseDurationSec', v)}
          />
          <OptionalNumberField
            size="sm"
            label="moveSpeedScale"
            value={area.moveSpeedScale}
            min={0}
            step={0.1}
            onChange={(v) => setTopField('moveSpeedScale', v)}
          />
          <OptionalTextField
            size="md"
            label="unlockNext"
            value={area.unlockNext}
            onChange={(v) => setTopField('unlockNext', v)}
          />
          <OptionalTextField
            size="lg"
            label="description"
            value={area.description}
            onChange={(v) => setTopField('description', v)}
          />
        </FieldRow>
      </section>

      <section className="card">
        <h3>エンカウント設定</h3>
        <FieldRow>
          <NumberField
            size="sm"
            label="perFloorEvents"
            value={area.encounter.perFloorEvents}
            min={1}
            onChange={(v) => setEncounterField('perFloorEvents', v)}
          />
          <OptionalNumberField
            size="sm"
            label="pityTimerSec"
            value={area.encounter.pityTimerSec}
            min={0}
            suffix="秒"
            onChange={(v) => setEncounterField('pityTimerSec', v)}
          />
        </FieldRow>
        <h4>イベント重み（合計 {totalWeight}）</h4>
        <FieldRow>
          <WeightRow
            size="sm"
            label="battle"
            value={w.battle}
            total={totalWeight}
            onChange={(v) => setWeight('battle', v)}
            required
          />
          <WeightRow
            size="sm"
            label="exploring"
            value={w.exploring}
            total={totalWeight}
            onChange={(v) => setWeight('exploring', v)}
            required
          />
          <WeightRow
            size="sm"
            label="trap"
            value={w.trap}
            total={totalWeight}
            onChange={(v) => setWeight('trap', v)}
          />
          <WeightRow
            size="sm"
            label="npc"
            value={w.npc}
            total={totalWeight}
            onChange={(v) => setWeight('npc', v)}
          />
        </FieldRow>
      </section>

      <section className="card">
        <h3>enemyTable（パターン未使用時のフォールバック）</h3>
        {(area.enemyTable ?? []).length === 0 ? (
          <p className="subtle">未設定（パターンベースのエンカウントを利用）</p>
        ) : (
          <pre className="json-view">
            {JSON.stringify(area.enemyTable, null, 2)}
          </pre>
        )}
      </section>

      {area.boss && (
        <section className="card">
          <h3>ボス</h3>
          <FieldRow>
            <TextField
              size="md"
              label="id"
              value={area.boss.id}
              onChange={(v) => setTopField('boss', { ...area.boss!, id: v })}
            />
            <NumberField
              size="xs"
              label="lvl"
              value={area.boss.lvl}
              min={0}
              onChange={(v) => setTopField('boss', { ...area.boss!, lvl: v })}
            />
          </FieldRow>
        </section>
      )}
    </div>
  )
}

function WeightRow({
  label,
  value,
  total,
  onChange,
  required,
  size,
}: {
  label: string
  value: number | undefined
  total: number
  onChange: (v: number | undefined) => void
  required?: boolean
  size?: FieldSize
}) {
  const pct = total > 0 && value !== undefined ? ((value / total) * 100).toFixed(1) : '-'
  return (
    <label className={size ? `field field-size-${size}` : 'field'}>
      <span className="field-label">
        {label}
        {!required && <span className="subtle"> (任意)</span>}
      </span>
      <span className="field-input">
        <input
          type="number"
          value={value ?? ''}
          placeholder={required ? '0' : '(未使用)'}
          min={0}
          onChange={(e) => {
            const raw = e.target.value
            if (required) {
              onChange(Number(raw) || 0)
            } else {
              onChange(raw === '' ? undefined : Number(raw))
            }
          }}
        />
        <span className="field-suffix">{pct}%</span>
      </span>
    </label>
  )
}
