import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AreaConfigSchema, EnemyDatabaseSchema } from '../lib/schema'
import type { AreaConfig, DungeonDetailDto, EnemyDatabase } from '../lib/schema'
import { AreaSettingsEditor } from '../components/AreaSettingsEditor'
import { EnemyEditor } from '../components/EnemyEditor'
import { PatternEditor } from '../components/PatternEditor'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string }

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }
  | { kind: 'success' }

type Tab = 'area' | 'enemies' | 'patterns'

interface DraftState {
  area: AreaConfig
  enemy: EnemyDatabase | null
}

export function DungeonDetail() {
  const { areaId } = useParams<{ areaId: string }>()
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' })
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })
  const [tab, setTab] = useState<Tab>('area')
  const [draft, setDraft] = useState<DraftState | null>(null)
  const originalRef = useRef<string | null>(null)

  useEffect(() => {
    if (!areaId) return
    let cancelled = false
    setLoadState({ kind: 'loading' })
    setSaveState({ kind: 'idle' })
    ;(async () => {
      try {
        const res = await fetch(`/api/dungeons/${areaId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as DungeonDetailDto
        if (cancelled) return
        const initial: DraftState = { area: data.area, enemy: data.enemy }
        originalRef.current = stableStringify(initial)
        setDraft(initial)
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
  }, [areaId])

  const isDirty = useMemo(() => {
    if (!draft || originalRef.current === null) return false
    return stableStringify(draft) !== originalRef.current
  }, [draft])

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const updateArea = useCallback((updater: (prev: AreaConfig) => AreaConfig) => {
    setDraft((prev) => (prev ? { ...prev, area: updater(prev.area) } : prev))
    setSaveState({ kind: 'idle' })
  }, [])

  const updateEnemy = useCallback(
    (updater: (prev: EnemyDatabase) => EnemyDatabase) => {
      setDraft((prev) => {
        if (!prev || !prev.enemy) return prev
        return { ...prev, enemy: updater(prev.enemy) }
      })
      setSaveState({ kind: 'idle' })
    },
    [],
  )

  const save = useCallback(async () => {
    if (!areaId || !draft) return
    const areaResult = AreaConfigSchema.safeParse(draft.area)
    if (!areaResult.success) {
      setSaveState({
        kind: 'error',
        message: `area 検証失敗: ${areaResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' / ')}`,
      })
      return
    }
    let enemyPayload: EnemyDatabase | null = null
    if (draft.enemy) {
      const enemyResult = EnemyDatabaseSchema.safeParse(draft.enemy)
      if (!enemyResult.success) {
        setSaveState({
          kind: 'error',
          message: `enemy 検証失敗: ${enemyResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' / ')}`,
        })
        return
      }
      enemyPayload = draft.enemy
    }

    setSaveState({ kind: 'saving' })
    try {
      const res = await fetch(`/api/dungeons/${areaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area: draft.area, enemy: enemyPayload }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        throw new Error(errBody?.error ?? `HTTP ${res.status}`)
      }
      originalRef.current = stableStringify(draft)
      setSaveState({ kind: 'success' })
    } catch (err) {
      setSaveState({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }, [areaId, draft])

  const revert = useCallback(() => {
    if (originalRef.current === null) return
    try {
      setDraft(JSON.parse(originalRef.current) as DraftState)
      setSaveState({ kind: 'idle' })
    } catch {
      // noop
    }
  }, [])

  const enemyNameMap = useMemo(() => {
    if (!draft?.enemy) return new Map<string, string>()
    return new Map(draft.enemy.enemies.map((e) => [e.id, e.name]))
  }, [draft])

  if (loadState.kind === 'loading') return <p className="state-msg">読み込み中…</p>
  if (loadState.kind === 'error') {
    return <p className="state-msg error">読み込みに失敗しました: {loadState.message}</p>
  }
  if (!draft) return null

  const { area, enemy } = draft

  return (
    <div className="detail">
      <p>
        <Link to="/">← 一覧へ戻る</Link>
      </p>
      <div className="detail-head">
        <div>
          <h2>{area.name}</h2>
          <p className="subtle">
            <code>{area.id}</code> · Lv {area.areaLevel} · {area.floors}F · {area.baseDurationSec}s
            {enemy ? ` · 敵 ${enemy.enemies.length}種 / パターン ${enemy.patterns.length}個` : ''}
          </p>
        </div>
        <SaveBar
          isDirty={isDirty}
          saveState={saveState}
          onSave={save}
          onRevert={revert}
        />
      </div>
      <div className="tabs">
        <button
          className={tab === 'area' ? 'tab active' : 'tab'}
          onClick={() => setTab('area')}
        >
          エリア設定
        </button>
        <button
          className={tab === 'enemies' ? 'tab active' : 'tab'}
          onClick={() => setTab('enemies')}
          disabled={!enemy}
        >
          敵リスト{enemy ? ` (${enemy.enemies.length})` : ''}
        </button>
        <button
          className={tab === 'patterns' ? 'tab active' : 'tab'}
          onClick={() => setTab('patterns')}
          disabled={!enemy}
        >
          パターン{enemy ? ` (${enemy.patterns.length})` : ''}
        </button>
      </div>
      <div className="tab-panel">
        {tab === 'area' && <AreaSettingsEditor area={area} onChange={updateArea} />}
        {tab === 'enemies' && enemy && <EnemyEditor enemy={enemy} onChange={updateEnemy} />}
        {tab === 'patterns' && enemy && (
          <PatternEditor enemy={enemy} enemyNameMap={enemyNameMap} onChange={updateEnemy} />
        )}
      </div>
    </div>
  )
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
      <button
        className="btn ghost"
        onClick={onRevert}
        disabled={!isDirty || saveState.kind === 'saving'}
      >
        取り消し
      </button>
      <button
        className="btn primary"
        onClick={onSave}
        disabled={!isDirty || saveState.kind === 'saving'}
      >
        保存
      </button>
    </div>
  )
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {}
      for (const k of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[k] = (val as Record<string, unknown>)[k]
      }
      return sorted
    }
    return val
  })
}
