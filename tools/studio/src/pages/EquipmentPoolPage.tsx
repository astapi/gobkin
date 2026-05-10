import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  EquipmentPoolSchema,
  isEquipmentTemplate,
  type EquipmentPool,
  type EquipmentPoolEntry,
  type EquipmentTemplate,
} from '../lib/schema'
import { EquipmentTemplateForm } from '../components/EquipmentTemplateForm'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string }

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }
  | { kind: 'success' }

type KeyedTemplate = EquipmentTemplate & { _key: number }
type KeyedEntry = EquipmentPoolEntry | KeyedTemplate
interface KeyedPool {
  version: string
  templates: KeyedEntry[]
}

const ALL_CATEGORIES = ['weapon', 'armor', 'robe', 'shield', 'gauntlet', 'wand', 'rod', 'accessory'] as const

let keySeed = 0
const nextKey = () => ++keySeed

function isKeyedTemplate(entry: KeyedEntry): entry is KeyedTemplate {
  return isEquipmentTemplate(entry) && typeof (entry as { _key?: unknown })._key === 'number'
}

function attachKeys(pool: EquipmentPool): KeyedPool {
  return {
    version: pool.version,
    templates: pool.templates.map((entry) =>
      isEquipmentTemplate(entry) ? { ...entry, _key: nextKey() } : entry,
    ),
  }
}

function stripKeys(pool: KeyedPool): EquipmentPool {
  return {
    version: pool.version,
    templates: pool.templates.map((entry) => {
      if (!isKeyedTemplate(entry)) return entry
      const { _key, ...rest } = entry
      return rest as EquipmentTemplate
    }),
  }
}

export function EquipmentPoolPage() {
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' })
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })
  const [pool, setPool] = useState<KeyedPool | null>(null)
  const originalRef = useRef<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    setLoadState({ kind: 'loading' })
    ;(async () => {
      try {
        const res = await fetch('/api/equipment-pool')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const raw = await res.json()
        const parsed = EquipmentPoolSchema.safeParse(raw)
        if (!parsed.success) {
          throw new Error(
            `equipment-pool 検証失敗: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' / ')}`,
          )
        }
        if (cancelled) return
        const keyed = attachKeys(parsed.data)
        originalRef.current = JSON.stringify(stripKeys(keyed))
        setPool(keyed)
        const firstTemplate = keyed.templates.find(isKeyedTemplate)
        setSelectedKey(firstTemplate?._key ?? null)
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
    if (!pool || originalRef.current === null) return false
    return JSON.stringify(stripKeys(pool)) !== originalRef.current
  }, [pool])

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const updateTemplate = useCallback(
    (key: number, updater: (prev: EquipmentTemplate) => EquipmentTemplate) => {
      setPool((prev) => {
        if (!prev) return prev
        const nextTemplates = prev.templates.map((entry) => {
          if (!isKeyedTemplate(entry) || entry._key !== key) return entry
          const { _key, ...rest } = entry
          const updated = updater(rest as EquipmentTemplate)
          return { ...updated, _key }
        })
        return { ...prev, templates: nextTemplates }
      })
      setSaveState({ kind: 'idle' })
    },
    [],
  )

  const addTemplate = useCallback(() => {
    setPool((prev) => {
      if (!prev) return prev
      const nextId = generateUniqueId(prev.templates)
      const newTemplate: KeyedTemplate = {
        id: nextId,
        name: '新規アイテム',
        category: 'accessory',
        statBonuses: [],
        price: 0,
        _key: nextKey(),
      }
      setSelectedKey(newTemplate._key)
      return { ...prev, templates: [...prev.templates, newTemplate] }
    })
    setSaveState({ kind: 'idle' })
  }, [])

  const deleteTemplate = useCallback((key: number) => {
    setPool((prev) => {
      if (!prev) return prev
      const nextTemplates = prev.templates.filter(
        (entry) => !isKeyedTemplate(entry) || entry._key !== key,
      )
      return { ...prev, templates: nextTemplates }
    })
    setSaveState({ kind: 'idle' })
    setSelectedKey((current) => (current === key ? null : current))
  }, [])

  const save = useCallback(async () => {
    if (!pool) return
    const stripped = stripKeys(pool)
    const parsed = EquipmentPoolSchema.safeParse(stripped)
    if (!parsed.success) {
      setSaveState({
        kind: 'error',
        message: `検証失敗: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' / ')}`,
      })
      return
    }
    const ids = new Set<string>()
    for (const entry of stripped.templates) {
      if (!isEquipmentTemplate(entry)) continue
      if (entry.id === '') {
        setSaveState({ kind: 'error', message: '空の id があります' })
        return
      }
      if (ids.has(entry.id)) {
        setSaveState({ kind: 'error', message: `id 重複: ${entry.id}` })
        return
      }
      ids.add(entry.id)
    }
    setSaveState({ kind: 'saving' })
    try {
      const res = await fetch('/api/equipment-pool', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stripped),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        throw new Error(errBody?.error ?? `HTTP ${res.status}`)
      }
      originalRef.current = JSON.stringify(stripped)
      setSaveState({ kind: 'success' })
    } catch (err) {
      setSaveState({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }, [pool])

  const revert = useCallback(() => {
    if (originalRef.current === null) return
    try {
      const original = JSON.parse(originalRef.current) as EquipmentPool
      setPool(attachKeys(original))
      setSaveState({ kind: 'idle' })
    } catch {
      // noop
    }
  }, [])

  const filtered = useMemo(() => {
    if (!pool) return [] as KeyedTemplate[]
    const q = query.trim().toLowerCase()
    return pool.templates.filter(isKeyedTemplate).filter((t) => {
      if (categoryFilter && t.category !== categoryFilter) return false
      if (q === '') return true
      return (
        t.id.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        (t.subCategory ?? '').toLowerCase().includes(q)
      )
    })
  }, [pool, query, categoryFilter])

  const selected = useMemo(() => {
    if (!pool || selectedKey === null) return null
    return (pool.templates.find(
      (entry) => isKeyedTemplate(entry) && entry._key === selectedKey,
    ) as KeyedTemplate | undefined) ?? null
  }, [pool, selectedKey])

  if (loadState.kind === 'loading') return <p className="state-msg">読み込み中…</p>
  if (loadState.kind === 'error') {
    return <p className="state-msg error">読み込みに失敗しました: {loadState.message}</p>
  }
  if (!pool) return null

  return (
    <div className="detail">
      <div className="detail-head">
        <div>
          <h2>アイテム管理</h2>
          <p className="subtle">
            equipmentPool.json · version {pool.version} ·
            {' '}
            {countTemplates(pool.templates)} アイテム
          </p>
        </div>
        <SaveBar isDirty={isDirty} saveState={saveState} onSave={save} onRevert={revert} />
      </div>

      <div className="enemy-layout">
        <div className="enemy-list">
          <div className="equipment-toolbar">
            <input
              type="search"
              placeholder="id / name / subCategory で絞り込み"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="search-input"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="search-input"
            >
              <option value="">全カテゴリ</option>
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button className="btn primary small" onClick={addTemplate}>
              + 新規追加
            </button>
          </div>
          <table className="enemy-table">
            <thead>
              <tr>
                <th>id</th>
                <th>name</th>
                <th>category</th>
                <th>sub</th>
                <th className="num">rank</th>
                <th className="num">price</th>
                <th>レア</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t._key}
                  className={selectedKey === t._key ? 'selected' : ''}
                  onClick={() => setSelectedKey(t._key)}
                >
                  <td><code>{t.id || '(未設定)'}</code></td>
                  <td>{t.name}</td>
                  <td>{t.category}</td>
                  <td>{t.subCategory ?? ''}</td>
                  <td className="num">{t.rank ?? ''}</td>
                  <td className="num">{t.price}</td>
                  <td>{t.isRare ? '★' : ''}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="subtle">該当するアイテムがありません</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {selected && (
          <EquipmentTemplateForm
            template={selected}
            onChange={(updater) => updateTemplate(selected._key, updater)}
            onDelete={() => deleteTemplate(selected._key)}
          />
        )}
      </div>
    </div>
  )
}

function countTemplates(entries: KeyedEntry[]): number {
  return entries.filter(isKeyedTemplate).length
}

function generateUniqueId(entries: KeyedEntry[]): string {
  const existing = new Set(
    entries.filter(isKeyedTemplate).map((e) => e.id),
  )
  let n = 1
  while (existing.has(`new_item_${n}`)) n++
  return `new_item_${n}`
}

function SaveBar({
  isDirty,
  saveState,
  onSave,
  onRevert,
}: {
  isDirty: boolean
  saveState: SaveState
  onSave: () => void
  onRevert: () => void
}) {
  return (
    <div className="save-bar">
      {saveState.kind === 'saving' && <span className="subtle">保存中…</span>}
      {saveState.kind === 'success' && !isDirty && <span className="saved">保存しました</span>}
      {saveState.kind === 'error' && <span className="save-error">{saveState.message}</span>}
      <button className="btn ghost" onClick={onRevert} disabled={!isDirty || saveState.kind === 'saving'}>
        取り消し
      </button>
      <button className="btn primary" onClick={onSave} disabled={!isDirty || saveState.kind === 'saving'}>
        保存
      </button>
    </div>
  )
}
