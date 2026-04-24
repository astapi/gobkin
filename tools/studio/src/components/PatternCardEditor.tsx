import { useState } from 'react'

import type { EnemyDatabase } from '../lib/schema'
import { DRAG_MIME, decodePayload, encodePayload } from './dragPayload'

type Pattern = EnemyDatabase['patterns'][number]

interface Props {
  pattern: Pattern
  enemyNameMap: Map<string, string>
  selectedEnemyId: string | null
  onChange: (updater: (prev: Pattern) => Pattern) => void
  onDuplicate: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export function PatternCardEditor({
  pattern,
  enemyNameMap,
  selectedEnemyId,
  onChange,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: Props) {
  const [floorsText, setFloorsText] = useState(pattern.floors.join(','))

  const setFloorsFromText = (raw: string) => {
    const floors = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isFinite(n))
    onChange((prev) => ({ ...prev, floors }))
  }

  const insertSlot = (row: number, targetSlot: number, enemyId: string) => {
    onChange((prev) => {
      const nextRows = prev.enemies.map((r) => r.slice())
      while (nextRows.length <= row) nextRows.push([])
      const clamped = Math.max(0, Math.min(targetSlot, nextRows[row].length))
      nextRows[row].splice(clamped, 0, enemyId)
      return { ...prev, enemies: nextRows }
    })
  }

  const moveSlot = (
    source: { row: number; slot: number },
    target: { row: number; slot: number },
  ) => {
    onChange((prev) => {
      const nextRows = prev.enemies.map((r) => r.slice())
      if (source.row >= nextRows.length) return prev
      const [picked] = nextRows[source.row].splice(source.slot, 1)
      if (picked === undefined) return prev
      while (nextRows.length <= target.row) nextRows.push([])
      let targetSlot = target.slot
      if (source.row === target.row && source.slot < target.slot) {
        targetSlot = target.slot - 1
      }
      const clamped = Math.max(0, Math.min(targetSlot, nextRows[target.row].length))
      nextRows[target.row].splice(clamped, 0, picked)
      return { ...prev, enemies: nextRows }
    })
  }

  const removeSlot = (row: number, slot: number) => {
    onChange((prev) => {
      const nextRows = prev.enemies.map((r) => r.slice())
      if (row >= nextRows.length) return prev
      nextRows[row].splice(slot, 1)
      return { ...prev, enemies: nextRows }
    })
  }

  const addRow = () => {
    onChange((prev) => ({ ...prev, enemies: [...prev.enemies, []] }))
  }

  const removeRow = (row: number) => {
    onChange((prev) => {
      const nextRows = prev.enemies.slice()
      nextRows.splice(row, 1)
      return { ...prev, enemies: nextRows.length === 0 ? [[]] : nextRows }
    })
  }

  const moveRow = (row: number, direction: -1 | 1) => {
    onChange((prev) => {
      const target = row + direction
      if (target < 0 || target >= prev.enemies.length) return prev
      const nextRows = prev.enemies.slice()
      ;[nextRows[row], nextRows[target]] = [nextRows[target], nextRows[row]]
      return { ...prev, enemies: nextRows }
    })
  }

  const handleDropAt = (row: number, slot: number) => (ev: React.DragEvent) => {
    ev.preventDefault()
    const payload = decodePayload(ev.dataTransfer.getData(DRAG_MIME))
    if (!payload) return
    if (payload.kind === 'new') {
      insertSlot(row, slot, payload.enemyId)
    } else {
      moveSlot(payload.source, { row, slot })
    }
  }

  return (
    <section className={pattern.isBoss ? 'card pattern-card boss' : 'card pattern-card'}>
      <header className="pattern-header">
        <input
          type="text"
          className="inline-input"
          value={pattern.id}
          onChange={(e) => onChange((prev) => ({ ...prev, id: e.target.value }))}
        />
        <label className="subtle">
          階層:{' '}
          <input
            type="text"
            className="inline-input narrow"
            value={floorsText}
            onChange={(e) => setFloorsText(e.target.value)}
            onBlur={() => setFloorsFromText(floorsText)}
          />
        </label>
        <label className="subtle">
          <input
            type="checkbox"
            checked={!!pattern.isBoss}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, isBoss: e.target.checked || undefined }))
            }
          />
          boss
        </label>
        <div className="pattern-actions">
          <button className="icon-btn" title="上へ" onClick={onMoveUp}>↑</button>
          <button className="icon-btn" title="下へ" onClick={onMoveDown}>↓</button>
          <button className="icon-btn" title="複製" onClick={onDuplicate}>⧉</button>
          <button className="icon-btn danger" title="削除" onClick={onDelete}>×</button>
        </div>
      </header>

      <div className="formation editable-formation">
        {pattern.enemies.map((row, rowIndex) => (
          <div key={rowIndex} className="formation-row-editable">
            <div className="row-header">
              <span className="row-label">{rowIndex + 1}列</span>
              <div className="row-actions">
                <button
                  className="icon-btn small"
                  title="上の列へ"
                  onClick={() => moveRow(rowIndex, -1)}
                  disabled={rowIndex === 0}
                >
                  ↑
                </button>
                <button
                  className="icon-btn small"
                  title="下の列へ"
                  onClick={() => moveRow(rowIndex, 1)}
                  disabled={rowIndex === pattern.enemies.length - 1}
                >
                  ↓
                </button>
                <button
                  className="icon-btn small danger"
                  title="列を削除"
                  onClick={() => removeRow(rowIndex)}
                >
                  ×
                </button>
              </div>
            </div>
            <div
              className="slot-lane"
              onDragOver={(ev) => {
                ev.preventDefault()
                ev.dataTransfer.dropEffect = 'move'
              }}
              onDrop={handleDropAt(rowIndex, row.length)}
            >
              {row.map((enemyId, slotIndex) => (
                <SlotTile
                  key={`${rowIndex}-${slotIndex}`}
                  row={rowIndex}
                  slot={slotIndex}
                  enemyId={enemyId}
                  name={enemyNameMap.get(enemyId) ?? enemyId}
                  onDropBefore={handleDropAt(rowIndex, slotIndex)}
                  onRemove={() => removeSlot(rowIndex, slotIndex)}
                />
              ))}
              <button
                className="slot-add"
                title={selectedEnemyId ? `+ ${enemyNameMap.get(selectedEnemyId) ?? selectedEnemyId}` : '+'}
                disabled={!selectedEnemyId}
                onClick={() => {
                  if (selectedEnemyId) insertSlot(rowIndex, row.length, selectedEnemyId)
                }}
              >
                + 追加
              </button>
            </div>
          </div>
        ))}
        <button className="btn ghost small" onClick={addRow}>
          + 列を追加
        </button>
      </div>
    </section>
  )
}

function SlotTile({
  row,
  slot,
  enemyId,
  name,
  onDropBefore,
  onRemove,
}: {
  row: number
  slot: number
  enemyId: string
  name: string
  onDropBefore: (ev: React.DragEvent) => void
  onRemove: () => void
}) {
  const [dragOver, setDragOver] = useState(false)
  const known = name !== enemyId

  return (
    <div
      className={`slot-tile ${dragOver ? 'drag-over' : ''} ${known ? '' : 'unknown'}`}
      draggable
      onDragStart={(ev) => {
        ev.dataTransfer.effectAllowed = 'move'
        ev.dataTransfer.setData(
          DRAG_MIME,
          encodePayload({ kind: 'move', enemyId, source: { row, slot } }),
        )
      }}
      onDragOver={(ev) => {
        ev.preventDefault()
        ev.dataTransfer.dropEffect = 'move'
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(ev) => {
        setDragOver(false)
        onDropBefore(ev)
      }}
      title={enemyId}
    >
      <span className="slot-name">{name}</span>
      <button
        className="slot-remove"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        title="削除"
      >
        ×
      </button>
    </div>
  )
}
