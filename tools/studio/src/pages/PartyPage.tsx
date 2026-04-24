import { usePartyStore } from '../stores/partyStore'
import { BackupDropzone } from '../components/BackupDropzone'
import { BackupPartyList } from '../components/BackupPartyList'
import { GoblinBrowser } from '../components/GoblinBrowser'
import { PartyEditor } from '../components/PartyEditor'
import { PresetList } from '../components/PresetList'

export function PartyPage() {
  const { backup, backupError, clearBackup } = usePartyStore()

  return (
    <div className="party-layout">
      <div className="party-main">
        {backup ? (
          <>
            <div className="filters">
              <span className="subtle">
                バックアップ読み込み済み：ゴブリン {backup.goblins.length} 体 /
                PT {backup.parties.length} 件 /
                装備 {backup.equipmentAll.length} 個
                {backup.rawBackup.meta.exportedAt
                  ? `（${backup.rawBackup.meta.exportedAt.slice(0, 10)} 出力）`
                  : ''}
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
                <BackupDropzone compact />
                <button className="btn ghost" onClick={clearBackup}>
                  アンロード
                </button>
              </div>
            </div>
            {backupError && <p className="save-error">{backupError}</p>}
            <GoblinBrowser />
          </>
        ) : (
          <section className="card">
            <h2>バックアップ JSON を読み込む</h2>
            <p className="subtle">
              実ゲームのセーブデータ（バックアップ JSON）からゴブリンを読み込んで
              シミュレーション用 PT を編成します。バックアップはブラウザ内のメモリにのみ保持され、
              ファイルや外部への送信は行いません。
            </p>
            <BackupDropzone />
            {backupError && <p className="save-error">{backupError}</p>}
          </section>
        )}
      </div>
      <aside className="party-side">
        <PartyEditor />
        <BackupPartyList />
        <PresetList />
      </aside>
    </div>
  )
}
