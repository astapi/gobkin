import type { Dungeon } from '../types/index.ts'

interface DungeonSelectionModalProps {
  dungeons: Dungeon[]
  onSelect: (dungeon: Dungeon) => void
  onClose: () => void
}

const formatTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}秒`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (remainingSeconds === 0) {
    return `${minutes}分`
  }
  return `${minutes}分${remainingSeconds}秒`
}

export const DungeonSelectionModal = ({ dungeons, onSelect, onClose }: DungeonSelectionModalProps) => {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-[414px] w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">遠征先を選択</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-3">
            {dungeons.map(dungeon => (
              <div
                key={dungeon.id}
                className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden shadow-md cursor-pointer hover:border-gray-400 hover:shadow-lg transition-all"
                onClick={() => onSelect(dungeon)}
              >
                <div className="bg-gray-700 text-white p-3">
                  <div className="font-bold text-sm mb-1">
                    {dungeon.name}
                  </div>
                  <div className="text-xs opacity-90">{dungeon.description}</div>
                </div>
                <div className="p-3">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>🏰 階層数: {dungeon.floors}階</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>⏱️ 探索時間: {formatTime(dungeon.cleared ? dungeon.exploration_time_sec : dungeon.exploration_time_sec_first)}</span>
                    {dungeon.cleared && <span className="text-green-600 font-bold">✓ 攻略済み</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
