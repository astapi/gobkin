import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface TipRecord {
  id: string
  text: string
  enabled: boolean
}

interface TipsFile {
  tips: TipRecord[]
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string }

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }
  | { kind: 'success' }

const API_URL = '/api/tips'

export function TipsPage() {
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' })
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })
  const [tipsFile, setTipsFile] = useState<TipsFile | null>(null)
  const originalRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadState({ kind: 'loading' })
    ;(async () => {
      try {
        const res = await fetch(API_URL)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const raw = await res.json()
        if (!isTipsFile(raw)) {
          throw new Error('tips.json の形式が不正です')
        }
        if (cancelled) return
        originalRef.current = JSON.stringify(raw)
        setTipsFile(raw)
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
    if (!tipsFile || originalRef.current === null) return false
    return JSON.stringify(tipsFile) !== originalRef.current
  }, [tipsFile])

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const updateTip = useCallback((index: number, patch: Partial<TipRecord>) => {
    setTipsFile((prev) => {
      if (!prev) return prev
      return {
        tips: prev.tips.map((tip, tipIndex) =>
          tipIndex === index ? { ...tip, ...patch } : tip,
        ),
      }
    })
    setSaveState({ kind: 'idle' })
  }, [])

  const addTip = useCallback(() => {
    setTipsFile((prev) => {
      if (!prev) return prev
      return {
        tips: [
          ...prev.tips,
          {
            id: generateUniqueId(prev.tips),
            text: '新しいTIPS',
            enabled: true,
          },
        ],
      }
    })
    setSaveState({ kind: 'idle' })
  }, [])

  const deleteTip = useCallback((index: number) => {
    setTipsFile((prev) => {
      if (!prev) return prev
      return { tips: prev.tips.filter((_, tipIndex) => tipIndex !== index) }
    })
    setSaveState({ kind: 'idle' })
  }, [])

  const save = useCallback(async () => {
    if (!tipsFile) return
    const error = validateTipsFile(tipsFile)
    if (error) {
      setSaveState({ kind: 'error', message: error })
      return
    }
    setSaveState({ kind: 'saving' })
    try {
      const res = await fetch(API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tipsFile),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        throw new Error(errBody?.error ?? `HTTP ${res.status}`)
      }
      originalRef.current = JSON.stringify(tipsFile)
      setSaveState({ kind: 'success' })
    } catch (err) {
      setSaveState({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }, [tipsFile])

  const revert = useCallback(() => {
    if (originalRef.current === null) return
    setTipsFile(JSON.parse(originalRef.current) as TipsFile)
    setSaveState({ kind: 'idle' })
  }, [])

  if (loadState.kind === 'loading') return <p className="state-msg">読み込み中…</p>
  if (loadState.kind === 'error') {
    return <p className="state-msg error">読み込みに失敗しました: {loadState.message}</p>
  }
  if (!tipsFile) return null

  return (
    <div className="detail">
      <div className="detail-head">
        <div>
          <h2>TIPS管理</h2>
          <p className="subtle">tips.json · {tipsFile.tips.length} 件</p>
        </div>
        <SaveBar isDirty={isDirty} saveState={saveState} onSave={save} onRevert={revert} />
      </div>

      <div className="panel-stack">
        <div className="card">
          <div className="tips-toolbar">
            <button className="btn primary small" onClick={addTip}>
              + 新規追加
            </button>
          </div>
          <table className="enemy-table tips-table">
            <thead>
              <tr>
                <th>有効</th>
                <th>id</th>
                <th>本文</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tipsFile.tips.map((tip, index) => (
                <tr key={`${tip.id}-${index}`}>
                  <td>
                    <input
                      type="checkbox"
                      checked={tip.enabled}
                      onChange={(e) => updateTip(index, { enabled: e.target.checked })}
                    />
                  </td>
                  <td>
                    <input
                      className="inline-input"
                      value={tip.id}
                      onChange={(e) => updateTip(index, { id: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="inline-input flex1"
                      value={tip.text}
                      onChange={(e) => updateTip(index, { text: e.target.value })}
                    />
                  </td>
                  <td className="num">
                    <button className="btn ghost small" onClick={() => deleteTip(index)}>
                      削除
                    </button>
                  </td>
                </tr>
              ))}
              {tipsFile.tips.length === 0 && (
                <tr>
                  <td colSpan={4} className="subtle">TIPSがありません</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
      <button className="btn ghost" onClick={onRevert} disabled={!isDirty || saveState.kind === 'saving'}>
        取り消し
      </button>
      <button className="btn primary" onClick={onSave} disabled={!isDirty || saveState.kind === 'saving'}>
        保存
      </button>
    </div>
  )
}

function isTipsFile(value: unknown): value is TipsFile {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    Array.isArray(record.tips) &&
    record.tips.every((tip) => {
      if (!tip || typeof tip !== 'object') return false
      const tipRecord = tip as Record<string, unknown>
      return (
        typeof tipRecord.id === 'string' &&
        typeof tipRecord.text === 'string' &&
        typeof tipRecord.enabled === 'boolean'
      )
    })
  )
}

function validateTipsFile(file: TipsFile): string | null {
  const ids = new Set<string>()
  for (const tip of file.tips) {
    if (tip.id.trim() === '') return '空の id があります'
    if (tip.text.trim() === '') return `本文が空です: ${tip.id}`
    if (!/^[a-z0-9_]+$/.test(tip.id)) {
      return `id は小文字英数字と _ のみにしてください: ${tip.id}`
    }
    if (ids.has(tip.id)) return `id が重複しています: ${tip.id}`
    ids.add(tip.id)
  }
  return null
}

function generateUniqueId(tips: TipRecord[]): string {
  const ids = new Set(tips.map((tip) => tip.id))
  let n = 1
  while (ids.has(`tip_${n}`)) n++
  return `tip_${n}`
}
