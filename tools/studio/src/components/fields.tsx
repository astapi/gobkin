import type { ChangeEvent, ReactNode } from 'react'

export type FieldSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

function fieldClass(size?: FieldSize): string {
  return size ? `field field-size-${size}` : 'field'
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  step = 1,
  suffix,
  size,
}: {
  label: string
  value: number | undefined
  onChange: (v: number) => void
  min?: number
  step?: number
  suffix?: string
  size?: FieldSize
}) {
  return (
    <label className={fieldClass(size)}>
      <span className="field-label">{label}</span>
      <span className="field-input">
        <input
          type="number"
          value={value ?? ''}
          min={min}
          step={step}
          onChange={(e) => onChange(parseNumber(e))}
        />
        {suffix && <span className="field-suffix">{suffix}</span>}
      </span>
    </label>
  )
}

export function OptionalNumberField({
  label,
  value,
  onChange,
  min,
  step = 1,
  suffix,
  size,
}: {
  label: string
  value: number | undefined
  onChange: (v: number | undefined) => void
  min?: number
  step?: number
  suffix?: string
  size?: FieldSize
}) {
  return (
    <label className={fieldClass(size)}>
      <span className="field-label">{label}</span>
      <span className="field-input">
        <input
          type="number"
          value={value ?? ''}
          min={min}
          step={step}
          placeholder="(未設定)"
          onChange={(e) => {
            const raw = e.target.value
            onChange(raw === '' ? undefined : Number(raw))
          }}
        />
        {suffix && <span className="field-suffix">{suffix}</span>}
      </span>
    </label>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  size,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  size?: FieldSize
}) {
  return (
    <label className={fieldClass(size)}>
      <span className="field-label">{label}</span>
      <span className="field-input">
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
    </label>
  )
}

export function OptionalTextField({
  label,
  value,
  onChange,
  placeholder,
  size,
}: {
  label: string
  value: string | undefined
  onChange: (v: string | undefined) => void
  placeholder?: string
  size?: FieldSize
}) {
  return (
    <label className={fieldClass(size)}>
      <span className="field-label">{label}</span>
      <span className="field-input">
        <input
          type="text"
          value={value ?? ''}
          placeholder={placeholder ?? '(未設定)'}
          onChange={(e) => {
            const raw = e.target.value
            onChange(raw === '' ? undefined : raw)
          }}
        />
      </span>
    </label>
  )
}

export function FieldGroup({ children, columns = 2 }: { children: ReactNode; columns?: number }) {
  return (
    <div className="field-group" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {children}
    </div>
  )
}

export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="field-row">{children}</div>
}

function parseNumber(e: ChangeEvent<HTMLInputElement>): number {
  const v = Number(e.target.value)
  return Number.isFinite(v) ? v : 0
}
