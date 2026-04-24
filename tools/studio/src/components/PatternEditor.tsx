import { useMemo, useState } from 'react'

import type { EnemyDatabase } from '../lib/schema'
import { EnemyPalette } from './EnemyPalette'
import { PatternCardEditor } from './PatternCardEditor'

type Pattern = EnemyDatabase['patterns'][number]

export function PatternEditor({
  enemy,
  enemyNameMap,
  onChange,
}: {
  enemy: EnemyDatabase
  enemyNameMap: Map<string, string>
  onChange: (updater: (prev: EnemyDatabase) => EnemyDatabase) => void
}) {
  const [floorFilter, setFloorFilter] = useState<number | 'all'>('all')
  const [bossOnly, setBossOnly] = useState(false)
  const [rawMode, setRawMode] = useState(false)
  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(
    enemy.enemies[0]?.id ?? null,
  )

  const availableFloors = useMemo(() => {
    const set = new Set<number>()
    enemy.patterns.forEach((p) => p.floors.forEach((f) => set.add(f)))
    return Array.from(set).sort((a, b) => a - b)
  }, [enemy.patterns])

  const visiblePatterns = useMemo(() => {
    return enemy.patterns
      .map((pattern, idx) => ({ pattern, idx }))
      .filter(({ pattern }) => {
        if (bossOnly && !pattern.isBoss) return false
        if (floorFilter !== 'all' && !pattern.floors.includes(floorFilter)) return false
        return true
      })
  }, [enemy.patterns, floorFilter, bossOnly])

  const mutatePattern = (index: number, updater: (prev: Pattern) => Pattern) => {
    onChange((prev) => {
      const next = prev.patterns.slice()
      next[index] = updater(next[index])
      return { ...prev, patterns: next }
    })
  }

  const duplicatePattern = (index: number) => {
    onChange((prev) => {
      const source = prev.patterns[index]
      const clone: Pattern = {
        ...source,
        id: uniqueCopyId(source.id, prev.patterns),
        floors: [...source.floors],
        enemies: source.enemies.map((row) => [...row]),
      }
      const next = prev.patterns.slice()
      next.splice(index + 1, 0, clone)
      return { ...prev, patterns: next }
    })
  }

  const deletePattern = (index: number) => {
    onChange((prev) => {
      const next = prev.patterns.slice()
      next.splice(index, 1)
      return { ...prev, patterns: next }
    })
  }

  const movePattern = (index: number, direction: -1 | 1) => {
    onChange((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.patterns.length) return prev
      const next = prev.patterns.slice()
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...prev, patterns: next }
    })
  }

  const addPattern = () => {
    onChange((prev) => ({
      ...prev,
      patterns: [
        ...prev.patterns,
        {
          id: uniqueCopyId('NEW', prev.patterns),
          floors: floorFilter === 'all' ? [1] : [floorFilter],
          enemies: [[]],
        },
      ],
    }))
  }

  if (rawMode) {
    return (
      <div className="panel-stack">
        <div className="filters">
          <button className="btn ghost" onClick={() => setRawMode(false)}>
            ← ビジュアル編集に戻る
          </button>
          <span className="subtle">JSON 直接編集モード（保存時に検証）</span>
        </div>
        <RawPatternEditor enemy={enemy} onChange={onChange} />
      </div>
    )
  }

  return (
    <div className="pattern-layout">
      <div className="pattern-main">
        <div className="filters">
          <label>
            階層:{' '}
            <select
              value={floorFilter === 'all' ? 'all' : String(floorFilter)}
              onChange={(e) =>
                setFloorFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
            >
              <option value="all">すべて</option>
              {availableFloors.map((f) => (
                <option key={f} value={String(f)}>
                  {f}F
                </option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={bossOnly}
              onChange={(e) => setBossOnly(e.target.checked)}
            />
            ボスのみ
          </label>
          <span className="subtle">
            {visiblePatterns.length} / {enemy.patterns.length} 件表示
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
            <button className="btn primary" onClick={addPattern}>+ パターン追加</button>
            <button className="btn ghost" onClick={() => setRawMode(true)}>JSON 直接編集</button>
          </div>
        </div>

        <div className="pattern-grid">
          {visiblePatterns.map(({ pattern, idx }) => (
            <PatternCardEditor
              key={`${pattern.id}-${idx}`}
              pattern={pattern}
              enemyNameMap={enemyNameMap}
              selectedEnemyId={selectedEnemyId}
              onChange={(updater) => mutatePattern(idx, updater)}
              onDuplicate={() => duplicatePattern(idx)}
              onDelete={() => deletePattern(idx)}
              onMoveUp={() => movePattern(idx, -1)}
              onMoveDown={() => movePattern(idx, 1)}
            />
          ))}
          {visiblePatterns.length === 0 && (
            <p className="subtle">該当するパターンがありません</p>
          )}
        </div>
      </div>

      <EnemyPalette
        enemies={enemy.enemies}
        selectedEnemyId={selectedEnemyId}
        onSelect={setSelectedEnemyId}
      />
    </div>
  )
}

function uniqueCopyId(baseId: string, patterns: Pattern[]): string {
  const taken = new Set(patterns.map((p) => p.id))
  if (!taken.has(baseId)) return baseId
  for (let i = 2; i < 999; i++) {
    const candidate = `${baseId}_${i}`
    if (!taken.has(candidate)) return candidate
  }
  return `${baseId}_${Date.now()}`
}

function RawPatternEditor({
  enemy,
  onChange,
}: {
  enemy: EnemyDatabase
  onChange: (updater: (prev: EnemyDatabase) => EnemyDatabase) => void
}) {
  const [text, setText] = useState(() => JSON.stringify(enemy.patterns, null, 2))
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  return (
    <div>
      <textarea
        className="json-editor tall"
        value={text}
        rows={24}
        onChange={(e) => {
          setText(e.target.value)
          setDirty(true)
          setError(null)
        }}
      />
      {error && <p className="save-error">{error}</p>}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          className="btn primary"
          disabled={!dirty}
          onClick={() => {
            try {
              const parsed = JSON.parse(text)
              if (!Array.isArray(parsed)) throw new Error('パターンは配列である必要があります')
              onChange((prev) => ({ ...prev, patterns: parsed }))
              setDirty(false)
              setError(null)
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err))
            }
          }}
        >
          パターン反映
        </button>
        <button
          className="btn ghost"
          onClick={() => {
            setText(JSON.stringify(enemy.patterns, null, 2))
            setDirty(false)
            setError(null)
          }}
        >
          リセット
        </button>
      </div>
    </div>
  )
}
