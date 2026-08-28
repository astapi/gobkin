import { MAX_PARTY_MEMBERS, useGoblinById, usePartyStore } from '../stores/partyStore'

export function PartyEditor() {
  const { draft, setDraftName, removeMember, clearDraft, savePreset } = usePartyStore()
  const filledCount = draft.members.filter((m) => m !== null).length

  return (
    <section className="card">
      <header className="party-editor-head">
        <input
          type="text"
          className="inline-input flex1"
          value={draft.name}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="PT名"
        />
        <span className="subtle">{filledCount} / {MAX_PARTY_MEMBERS}</span>
      </header>
      <ol className="party-slots">
        {draft.members.map((id, idx) => (
          <PartySlot key={idx} index={idx} goblinId={id} onRemove={() => removeMember(idx)} />
        ))}
      </ol>
      <div className="party-editor-actions">
        <button
          className="btn ghost"
          onClick={clearDraft}
          disabled={filledCount === 0 && draft.name === '新規PT'}
        >
          クリア
        </button>
        <button
          className="btn primary"
          onClick={savePreset}
          disabled={filledCount === 0}
        >
          プリセット保存
        </button>
      </div>
    </section>
  )
}

function PartySlot({
  index,
  goblinId,
  onRemove,
}: {
  index: number
  goblinId: number | null
  onRemove: () => void
}) {
  const goblin = useGoblinById(goblinId)

  if (goblinId === null) {
    return (
      <li className="party-slot empty">
        <span className="slot-index">{index + 1}</span>
        <span className="subtle">空きスロット</span>
      </li>
    )
  }

  if (goblin === null) {
    return (
      <li className="party-slot">
        <span className="slot-index">{index + 1}</span>
        <div className="slot-body">
          <div className="slot-title">
            <strong>ID: {goblinId}</strong>
            <span className="subtle"> / バックアップ未ロード</span>
          </div>
        </div>
        <button className="icon-btn danger" onClick={onRemove} title="外す">×</button>
      </li>
    )
  }

  const stats = goblin.effectiveStats ?? goblin.stats
  return (
    <li className="party-slot">
      <span className="slot-index">{index + 1}</span>
      <div className="slot-body">
        <div className="slot-title">
          <strong>{goblin.name}</strong>
          <span className="subtle"> / Lv{goblin.level} {goblin.job ? `(${goblin.job})` : ''}</span>
        </div>
        <div className="slot-stats">
          <span>HP {stats.hp}</span>
          <span>ATK {stats.atk}</span>
          <span>DEF {stats.def}</span>
          {stats.magicAtk !== undefined && <span>M-ATK {stats.magicAtk}</span>}
        </div>
      </div>
      <button className="icon-btn danger" onClick={onRemove} title="外す">×</button>
    </li>
  )
}
