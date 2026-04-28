import { useEffect, useMemo, useState } from 'react'

import {
  EquipmentPoolSchema,
  isEquipmentTemplate,
  type EquipmentTemplate,
} from '../lib/schema'

interface RareDropEntry {
  templateId: string
}

let cachedPool: EquipmentTemplate[] | null = null
let cachedPoolPromise: Promise<EquipmentTemplate[]> | null = null

async function loadEquipmentTemplates(): Promise<EquipmentTemplate[]> {
  if (cachedPool) return cachedPool
  if (cachedPoolPromise) return cachedPoolPromise
  cachedPoolPromise = (async () => {
    const res = await fetch('/api/equipment-pool')
    if (!res.ok) throw new Error(`equipment-pool 取得失敗: HTTP ${res.status}`)
    const raw = await res.json()
    const parsed = EquipmentPoolSchema.parse(raw)
    const templates = parsed.templates.filter(isEquipmentTemplate)
    cachedPool = templates
    return templates
  })()
  try {
    return await cachedPoolPromise
  } finally {
    cachedPoolPromise = null
  }
}

export function invalidateEquipmentPoolCache() {
  cachedPool = null
}

export function RareEquipmentDropsEditor({
  rareEquipmentDrops,
  onChange,
}: {
  rareEquipmentDrops: RareDropEntry[] | undefined
  onChange: (next: RareDropEntry[] | undefined) => void
}) {
  const entries = rareEquipmentDrops ?? []
  const [templates, setTemplates] = useState<EquipmentTemplate[] | null>(cachedPool)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (templates) return
    loadEquipmentTemplates()
      .then((list) => {
        if (cancelled) return
        setTemplates(list)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [templates])

  const templateMap = useMemo(() => {
    const map = new Map<string, EquipmentTemplate>()
    for (const t of templates ?? []) map.set(t.id, t)
    return map
  }, [templates])

  const rareTemplates = useMemo(
    () => (templates ?? []).filter((t) => t.isRare === true),
    [templates],
  )

  const updateAt = (index: number, templateId: string) => {
    onChange(entries.map((e, i) => (i === index ? { templateId } : e)))
  }
  const removeAt = (index: number) => {
    const next = entries.filter((_, i) => i !== index)
    onChange(next.length > 0 ? next : undefined)
  }
  const addEntry = () => {
    onChange([...entries, { templateId: '' }])
  }

  return (
    <section className="card">
      <div className="section-head">
        <h4>レアドロップ (rareEquipmentDrops)</h4>
        <button className="btn ghost small" onClick={addEntry}>
          + 追加
        </button>
      </div>
      <p className="subtle">
        登録したアイテム1つごとに運値ベースの当落判定が走ります（確率指定なし）。
        同じ敵から複数種のレアアイテムがドロップする可能性があります。
        セレクトには <strong>isRare=true のアイテムのみ</strong> 表示されます（アイテム管理画面のチェックでON可）。
      </p>
      {loadError && <p className="save-error">{loadError}</p>}
      {!templates && !loadError && <p className="subtle">アイテム一覧を読み込み中…</p>}
      {templates && (
        <div className="story-block-list">
          {entries.map((entry, index) => {
            const template = templateMap.get(entry.templateId)
            return (
              <div key={index} className="story-block">
                <div className="story-block-head">
                  <strong>
                    {template ? `${template.name}` : entry.templateId || '(未設定)'}
                  </strong>
                  <div className="pattern-actions">
                    <button className="icon-btn danger" onClick={() => removeAt(index)}>
                      ×
                    </button>
                  </div>
                </div>
                <TemplateSelect
                  value={entry.templateId}
                  templates={rareTemplates}
                  onChange={(value) => updateAt(index, value)}
                />
                {template && (
                  <p className="subtle">
                    <code>{template.id}</code> · {template.category}
                    {template.subCategory ? ` / ${template.subCategory}` : ''}
                    {template.rank !== undefined ? ` · rank ${template.rank}` : ''}
                  </p>
                )}
                {!template && entry.templateId && (
                  <p className="save-error">
                    equipmentPool に存在しない templateId です: {entry.templateId}
                  </p>
                )}
              </div>
            )
          })}
          {entries.length === 0 && <p className="subtle">未設定</p>}
        </div>
      )}
    </section>
  )
}

function TemplateSelect({
  value,
  templates,
  onChange,
}: {
  value: string
  templates: EquipmentTemplate[]
  onChange: (value: string) => void
}) {
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')

  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    return templates
      .filter((t) => (categoryFilter ? t.category === categoryFilter : true))
      .filter((t) => {
        if (q === '') return true
        return (
          t.id.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          (t.subCategory ?? '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => a.id.localeCompare(b.id))
  }, [templates, query, categoryFilter])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const t of templates) set.add(t.category)
    return Array.from(set).sort()
  }, [templates])

  return (
    <div className="rare-drop-select">
      <div className="rare-drop-select-toolbar">
        <input
          type="search"
          placeholder="id / name で絞り込み"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">全カテゴリ</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">(未設定)</option>
        {value && !options.some((t) => t.id === value) && (
          <option value={value}>{value} (絞り込み外)</option>
        )}
        {options.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} / {t.id} ({t.category}
            {t.subCategory ? `:${t.subCategory}` : ''})
          </option>
        ))}
      </select>
    </div>
  )
}
