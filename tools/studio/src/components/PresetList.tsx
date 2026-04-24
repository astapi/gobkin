import { useState } from 'react'

import { usePartyStore } from '../stores/partyStore'

export function PresetList() {
  const {
    presets,
    presetsLoading,
    presetsError,
    loadPreset,
    deletePreset,
    renamePreset,
    updatePreset,
    draft,
  } = usePartyStore()
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  if (presetsLoading) {
    return (
      <section className="card">
        <h3>プリセット</h3>
        <p className="subtle">読み込み中…</p>
      </section>
    )
  }

  if (presets.length === 0) {
    return (
      <section className="card">
        <h3>プリセット</h3>
        <p className="subtle">保存済みプリセットはまだありません。</p>
        {presetsError && <p className="save-error">{presetsError}</p>}
      </section>
    )
  }

  const draftCount = draft.members.filter((m) => m !== null).length

  return (
    <section className="card">
      <h3>プリセット ({presets.length})</h3>
      {presetsError && <p className="save-error">{presetsError}</p>}
      <ul className="preset-list">
        {presets.map((p) => (
          <li key={p.id} className="preset-item">
            {renamingId === p.id ? (
              <>
                <input
                  type="text"
                  className="inline-input flex1"
                  value={renameValue}
                  autoFocus
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (renameValue.trim() !== '') renamePreset(p.id, renameValue.trim())
                      setRenamingId(null)
                    } else if (e.key === 'Escape') {
                      setRenamingId(null)
                    }
                  }}
                  onBlur={() => {
                    if (renameValue.trim() !== '') renamePreset(p.id, renameValue.trim())
                    setRenamingId(null)
                  }}
                />
              </>
            ) : (
              <>
                <div className="preset-info">
                  <div className="preset-name">{p.name}</div>
                  <div className="subtle">
                    {p.memberIds.length} 体 · 更新 {p.updatedAt.slice(0, 10)}
                  </div>
                </div>
                <div className="preset-actions">
                  <button
                    className="btn ghost small"
                    onClick={() => loadPreset(p.id)}
                    title="現在の編成に読み込む"
                  >
                    読込
                  </button>
                  <button
                    className="btn ghost small"
                    disabled={draftCount === 0}
                    onClick={() => updatePreset(p.id)}
                    title="現在の編成で上書き"
                  >
                    上書き
                  </button>
                  <button
                    className="icon-btn small"
                    onClick={() => {
                      setRenamingId(p.id)
                      setRenameValue(p.name)
                    }}
                    title="名前変更"
                  >
                    ✎
                  </button>
                  <button
                    className="icon-btn small danger"
                    onClick={() => {
                      if (window.confirm(`プリセット「${p.name}」を削除しますか？`)) {
                        deletePreset(p.id)
                      }
                    }}
                    title="削除"
                  >
                    ×
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
