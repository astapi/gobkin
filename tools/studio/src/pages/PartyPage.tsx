import { useState } from 'react'

import { usePartyStore } from '../stores/partyStore'
import { BackupDropzone } from '../components/BackupDropzone'
import { BackupPartyList } from '../components/BackupPartyList'
import { CharacterEditor } from '../components/CharacterEditor'
import { GoblinBrowser } from '../components/GoblinBrowser'
import { PartyEditor } from '../components/PartyEditor'
import { PresetList } from '../components/PresetList'

export function PartyPage() {
  const {
    library,
    libraryLoading,
    libraryError,
    importBackupError,
    clearLibrary,
    upsertCharacter,
    removeCharacter,
  } = usePartyStore()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const hasCharacters = library.goblins.length > 0
  const openCreate = () => {
    setEditingId(null)
    setEditorOpen(true)
  }
  const openEdit = (id: number) => {
    setEditingId(id)
    setEditorOpen(true)
  }

  return (
    <div className="party-layout">
      <div className="party-main">
        {libraryLoading ? (
          <section className="card">
            <p className="subtle">キャラクター情報を読み込み中…</p>
          </section>
        ) : (
          <>
            {hasCharacters ? (
              <>
                <div className="filters">
                  <span className="subtle">
                    ローカル保存済み：ゴブリン {library.goblins.length} 体 /
                    PT {library.parties.length} 件 /
                    装備 {library.equipment.length} 個
                    {library.meta?.sourceExportedAt
                      ? `（${library.meta.sourceExportedAt.slice(0, 10)} 出力）`
                      : library.meta?.importedAt
                      ? `（${library.meta.importedAt.slice(0, 10)} 取込）`
                      : ''}
                  </span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
                    <button className="btn primary" onClick={openCreate}>
                      + 新規キャラ作成
                    </button>
                    <BackupDropzone compact />
                    <button
                      className="btn ghost"
                      onClick={() => {
                        if (
                          window.confirm(
                            'ローカル保存しているキャラクター情報を削除しますか？（プリセットは残ります）',
                          )
                        ) {
                          void clearLibrary()
                        }
                      }}
                    >
                      ローカル削除
                    </button>
                  </div>
                </div>
                {libraryError && <p className="save-error">{libraryError}</p>}
                {importBackupError && <p className="save-error">{importBackupError}</p>}
                <GoblinBrowser onEditGoblin={openEdit} />
              </>
            ) : (
              <section className="card">
                <h2>キャラクターを準備する</h2>
                <p className="subtle">
                  1からキャラクターを定義するか、ゲーム本体のバックアップ JSON を取り込みます。
                  どちらの場合もキャラクター情報は <code>tools/studio/data/character-library.json</code>{' '}
                  にローカル保存され、以降はバックアップ無しで PT 編成・シミュレーションを利用できます。
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button className="btn primary" onClick={openCreate}>
                    + 新規キャラ作成
                  </button>
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <BackupDropzone />
                </div>
                {libraryError && <p className="save-error">{libraryError}</p>}
                {importBackupError && <p className="save-error">{importBackupError}</p>}
              </section>
            )}
          </>
        )}
      </div>
      <aside className="party-side">
        <PartyEditor />
        <BackupPartyList />
        <PresetList />
      </aside>
      <CharacterEditor
        open={editorOpen}
        editingId={editingId}
        existingGoblins={library.goblins}
        onClose={() => setEditorOpen(false)}
        onSubmit={(g) => upsertCharacter(g)}
        onDelete={(id) => removeCharacter(id)}
      />
    </div>
  )
}
