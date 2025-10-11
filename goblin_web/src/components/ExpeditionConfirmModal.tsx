import type { Dungeon, Goblin } from '../shared/types'

interface ExpeditionConfirmModalProps {
  dungeon: Dungeon
  partyName: string
  members: Goblin[]
  targetFloor: number | null
  returnPolicyLabel: string
  onConfirm: () => void
  onClose: () => void
}

export const ExpeditionConfirmModal = ({
  dungeon,
  partyName,
  members,
  targetFloor,
  returnPolicyLabel,
  onConfirm,
  onClose
}: ExpeditionConfirmModalProps) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">出撃確認</h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* パーティ情報 */}
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-2">パーティ</div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="font-bold text-gray-800 mb-2">{partyName}</div>
              <div className="flex gap-2 flex-wrap">
                {members.map(member => (
                  <div key={member.id} className="flex items-center gap-1 text-xs bg-white rounded px-2 py-1 border border-gray-200">
                    <div className="w-5 h-5 rounded-full overflow-hidden">
                      <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-gray-700">{member.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 遠征先情報 */}
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-2">遠征先</div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="font-bold text-gray-800">{dungeon.name}</div>
              <div className="text-xs text-gray-600 mt-1">{dungeon.description}</div>
            </div>
          </div>

          {/* 目標階数 */}
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-2">目標階数</div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-800">
                {targetFloor ? `${targetFloor}階まで` : 'どこまでも進む'}
              </div>
            </div>
          </div>

          {/* 帰還条件 */}
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-2">帰還条件</div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-800">{returnPolicyLabel}</div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              この設定で遠征を開始します。よろしいですか?
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors font-medium"
          >
            出撃する
          </button>
        </div>
      </div>
    </div>
  )
}
