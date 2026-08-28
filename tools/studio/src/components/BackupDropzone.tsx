import { useRef, useState } from 'react'

import { usePartyStore } from '../stores/partyStore'

export function BackupDropzone({ compact = false }: { compact?: boolean }) {
  const { importBackup, importBackupBusy } = usePartyStore()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = (file: File | undefined | null) => {
    if (!file) return
    void importBackup(file)
  }

  if (compact) {
    return (
      <>
        <button
          className="btn ghost"
          onClick={() => inputRef.current?.click()}
          disabled={importBackupBusy}
        >
          バックアップを再取り込み
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            handleFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </>
    )
  }

  return (
    <div
      className={`dropzone ${dragging ? 'drag-over' : ''}`}
      onDragOver={(ev) => {
        ev.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(ev) => {
        ev.preventDefault()
        setDragging(false)
        handleFile(ev.dataTransfer.files[0])
      }}
      onClick={() => inputRef.current?.click()}
    >
      <p>
        <strong>クリック</strong>してファイル選択、または JSON をここにドラッグ&ドロップ
      </p>
      <p className="subtle">
        対応形式: ゴブリンキングダムのバックアップ JSON（<code>meta.app = "goblin_kingdom"</code>）
      </p>
      {importBackupBusy && <p className="subtle">読み込み中…</p>}
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
