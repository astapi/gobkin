import type { Dungeon } from '../../shared/types'

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
      className="flex fixed inset-0 z-50 justify-center items-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-[414px] h-full w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800">遠征先を選択</h2>
            <button
              onClick={onClose}
              className="text-2xl leading-none text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-4">
          <div className="flex flex-col gap-3">
            {dungeons.map(dungeon => (
              <div
                key={dungeon.id}
                className="overflow-hidden bg-white rounded-xl border-2 border-gray-200 shadow-md transition-all cursor-pointer hover:border-gray-400 hover:shadow-lg"
                onClick={() => onSelect(dungeon)}
              >
                <div className="p-3 text-white bg-gray-700">
                  <div className="mb-1 text-sm font-bold">
                    {dungeon.name}
                  </div>
                  <div className="text-xs opacity-90">{dungeon.description}</div>
                </div>
                <div className="p-3">
                  <div className="flex justify-between mb-1 text-xs text-gray-600">
                    <span>🏰 階層数: {dungeon.floors}階</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>⏱️ 探索時間: {formatTime(dungeon.cleared ? dungeon.exploration_time_sec : dungeon.exploration_time_sec_first)}</span>
                    {dungeon.cleared && <span className="font-bold text-green-600">✓ 攻略済み</span>}
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
