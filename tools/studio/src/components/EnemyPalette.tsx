import { useMemo, useState } from 'react'

import type { EnemyDatabase } from '../lib/schema'
import { encodePayload } from './dragPayload'

type Enemy = EnemyDatabase['enemies'][number]

export function EnemyPalette({
  enemies,
  selectedEnemyId,
  onSelect,
}: {
  enemies: Enemy[]
  selectedEnemyId: string | null
  onSelect: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q === '') return enemies
    return enemies.filter(
      (e) =>
        e.id.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.raceTags.some((tag) => tag.toLowerCase().includes(q)),
    )
  }, [enemies, query])

  return (
    <aside className="enemy-palette">
      <h3>敵パレット</h3>
      <p className="subtle">クリックで選択、ドラッグでスロットに配置</p>
      <input
        type="search"
        className="search-input"
        placeholder="絞り込み"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="palette-list">
        {filtered.map((e) => (
          <div
            key={e.id}
            className={`palette-item ${selectedEnemyId === e.id ? 'selected' : ''}`}
            draggable
            onDragStart={(ev) => {
              ev.dataTransfer.effectAllowed = 'copy'
              ev.dataTransfer.setData(
                'application/x-goblin-studio',
                encodePayload({ kind: 'new', enemyId: e.id }),
              )
            }}
            onClick={() => onSelect(e.id)}
          >
            <div className="palette-name">{e.name}</div>
            <div className="palette-sub">
              <code>{e.id}</code>
              <span className="subtle">Lv{e.level}</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="subtle">該当する敵がいません</p>}
      </div>
    </aside>
  )
}
