import { useMemo, useState } from 'react'

import { usePartyStore } from '../stores/partyStore'
import type { BackupGoblin } from '../lib/goblinMapper'

type SortKey = 'id' | 'level' | 'name' | 'job' | 'race'

export function GoblinBrowser() {
  const { backup, draft, addMember } = usePartyStore()
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('level')
  const [sortDesc, setSortDesc] = useState(true)

  const partyMemberIds = useMemo(
    () => new Set(draft.members.filter((m): m is number => m !== null)),
    [draft.members],
  )

  const filtered = useMemo(() => {
    if (!backup) return []
    const q = query.trim().toLowerCase()
    let list = backup.goblins
    if (q !== '') {
      list = list.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.race.toLowerCase().includes(q) ||
          g.job?.toLowerCase().includes(q) ||
          String(g.id).includes(q),
      )
    }
    const sorted = list.slice().sort((a, b) => compareByKey(a, b, sortKey))
    if (sortDesc) sorted.reverse()
    return sorted
  }, [backup, query, sortKey, sortDesc])

  if (!backup) return null
  const equipmentByGoblin = backup.equipmentByGoblin

  return (
    <div>
      <div className="goblin-toolbar">
        <input
          type="search"
          className="search-input"
          placeholder="id / name / race / job で絞り込み"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="subtle">{filtered.length} / {backup.goblins.length} 体表示</span>
      </div>
      <table className="enemy-table">
        <thead>
          <tr>
            <SortHeader label="id" k="id" sortKey={sortKey} sortDesc={sortDesc} onClick={setSort(setSortKey, setSortDesc, sortKey, sortDesc)} align="num" />
            <SortHeader label="name" k="name" sortKey={sortKey} sortDesc={sortDesc} onClick={setSort(setSortKey, setSortDesc, sortKey, sortDesc)} />
            <SortHeader label="race" k="race" sortKey={sortKey} sortDesc={sortDesc} onClick={setSort(setSortKey, setSortDesc, sortKey, sortDesc)} />
            <SortHeader label="job" k="job" sortKey={sortKey} sortDesc={sortDesc} onClick={setSort(setSortKey, setSortDesc, sortKey, sortDesc)} />
            <SortHeader label="Lv" k="level" sortKey={sortKey} sortDesc={sortDesc} onClick={setSort(setSortKey, setSortDesc, sortKey, sortDesc)} align="num" />
            <th className="num">HP</th>
            <th className="num">ATK</th>
            <th className="num">DEF</th>
            <th className="num">装備</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((g) => {
            const inParty = partyMemberIds.has(g.id)
            const equipCount = equipmentByGoblin.get(g.id)?.length ?? 0
            const stats = g.effectiveStats ?? g.stats
            return (
              <tr key={g.id} className={inParty ? 'selected' : ''}>
                <td className="num">{g.id}</td>
                <td>{g.name}</td>
                <td>{g.race}</td>
                <td>{g.job ?? '-'}</td>
                <td className="num">{g.level}</td>
                <td className="num">{stats.hp}</td>
                <td className="num">{stats.atk}</td>
                <td className="num">{stats.def}</td>
                <td className="num">{equipCount}</td>
                <td>
                  <button
                    className="btn ghost small"
                    disabled={inParty}
                    onClick={() => addMember(g.id)}
                  >
                    {inParty ? '編成済' : '+ PT'}
                  </button>
                </td>
              </tr>
            )
          })}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={10} className="subtle">該当するゴブリンがいません</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function SortHeader({
  label,
  k,
  sortKey,
  sortDesc,
  onClick,
  align,
}: {
  label: string
  k: SortKey
  sortKey: SortKey
  sortDesc: boolean
  onClick: (k: SortKey) => void
  align?: 'num'
}) {
  const active = sortKey === k
  return (
    <th className={align === 'num' ? 'num sortable' : 'sortable'} onClick={() => onClick(k)}>
      {label}
      {active ? (sortDesc ? ' ▼' : ' ▲') : ''}
    </th>
  )
}

function setSort(
  setKey: (k: SortKey) => void,
  setDesc: (d: boolean) => void,
  currentKey: SortKey,
  currentDesc: boolean,
) {
  return (k: SortKey) => {
    if (k === currentKey) {
      setDesc(!currentDesc)
    } else {
      setKey(k)
      setDesc(true)
    }
  }
}

function compareByKey(a: BackupGoblin, b: BackupGoblin, key: SortKey): number {
  switch (key) {
    case 'id':
      return a.id - b.id
    case 'level':
      return a.level - b.level
    case 'name':
      return a.name.localeCompare(b.name)
    case 'job':
      return (a.job ?? '').localeCompare(b.job ?? '')
    case 'race':
      return a.race.localeCompare(b.race)
  }
}
