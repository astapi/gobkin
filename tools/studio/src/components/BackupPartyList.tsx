import { usePartyStore } from '../stores/partyStore'
import type { BackupGoblin } from '../lib/goblinMapper'

export function BackupPartyList() {
  const { backup, loadBackupParty, importBackupPartyAsPreset } = usePartyStore()
  if (!backup || backup.parties.length === 0) return null

  const goblinById = new Map(backup.goblins.map((g) => [g.id, g]))

  return (
    <section className="card">
      <h3>バックアップ内のPT ({backup.parties.length})</h3>
      <p className="subtle" style={{ margin: '0 0 0.5rem' }}>
        ゲーム本体で作成済みのPTをそのまま読み込めます。
      </p>
      <ul className="preset-list">
        {backup.parties.map((p) => {
          const members = p.memberIds
            .map((id) => goblinById.get(id))
            .filter((g): g is BackupGoblin => g !== undefined)
          return (
            <li key={p.id} className="preset-item">
              <div className="preset-info">
                <div className="preset-name">{p.name}</div>
                <div className="subtle">
                  {p.memberIds.length}体
                  {p.dungeonId ? ` · 遠征先: ${p.dungeonId}` : ''}
                  {p.status && p.status !== 'idle' ? ` · ${p.status}` : ''}
                </div>
                {members.length > 0 && (
                  <div className="subtle" style={{ marginTop: '0.2rem' }}>
                    {members
                      .map((g) => `${g.name}(Lv${g.level})`)
                      .join(' / ')}
                  </div>
                )}
                {members.length < p.memberIds.length && (
                  <div className="save-error" style={{ marginTop: '0.3rem', padding: '0.3rem 0.5rem' }}>
                    {p.memberIds.length - members.length}体のゴブリンがバックアップ内に見つかりません
                  </div>
                )}
              </div>
              <div className="preset-actions">
                <button
                  className="btn ghost small"
                  onClick={() => loadBackupParty(p.id)}
                  title="現在の編成に読み込む"
                >
                  読込
                </button>
                <button
                  className="btn ghost small"
                  onClick={() => importBackupPartyAsPreset(p.id)}
                  title="プリセットとして永続化"
                >
                  プリセット化
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
