import type { Dungeon, Party, Goblin } from '../types/index.ts'

interface DungeonConfirmModalProps {
  dungeon: Dungeon
  party: Party
  goblins: Goblin[]
  onConfirm: () => void
  onCancel: () => void
}

export const DungeonConfirmModal = ({ dungeon, party, goblins, onConfirm, onCancel }: DungeonConfirmModalProps) => {
  const members = party.memberIds
    .map(id => goblins.find(g => g.id === id))
    .filter((g): g is Goblin => g !== undefined)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-[414px] w-full mx-4">
        <div className="text-lg font-bold text-gray-800 mb-4">
          探索開始の確認
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="text-sm text-gray-600 mb-2">ダンジョン</div>
          <div className="font-bold text-gray-800 mb-3">
            {dungeon.icon || '🏰'} {dungeon.name}
          </div>

          <div className="text-sm text-gray-600 mb-2">パーティ</div>
          <div className="font-bold text-gray-800 mb-2">{party.name}</div>
          <div className="flex gap-2 flex-wrap">
            {members.map(member => (
              <div key={member.id} className="flex items-center gap-1 text-xs bg-white rounded px-2 py-1 border border-gray-300">
                <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center border border-gray-400 overflow-hidden">
                  <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                </div>
                <span className="text-gray-600">{member.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-sm text-gray-600 mb-6">
          この内容で探索を開始しますか？
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-300 text-gray-700 font-bold py-2.5 rounded-md hover:bg-gray-400 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-gray-600 text-white font-bold py-2.5 rounded-md hover:bg-gray-700 transition-colors"
          >
            探索開始
          </button>
        </div>
      </div>
    </div>
  )
}