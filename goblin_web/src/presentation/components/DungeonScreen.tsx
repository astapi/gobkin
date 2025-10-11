import type { Dungeon } from '../../shared/types'

interface DungeonScreenProps {
  dungeons: Dungeon[]
  onStartExplore: (dungeon: Dungeon) => void
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

export const DungeonScreen = ({ dungeons, onStartExplore }: DungeonScreenProps) => (
  <div className="h-full overflow-y-auto">
    <div className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">
      ダンジョン選択
    </div>
    <div className="flex flex-col gap-4">
      {dungeons.map(dungeon => (
        <div
          key={dungeon.id}
          className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden shadow-md cursor-pointer hover:border-gray-400 hover:shadow-lg transition-all"
          onClick={() => onStartExplore(dungeon)}
        >
          <div className="bg-gray-700 text-white p-4">
            <div className="font-bold text-base mb-1">
              {dungeon.name}
            </div>
            <div className="text-xs opacity-90">{dungeon.description}</div>
          </div>
          <div className="p-4">
            <div className="flex justify-between text-xs text-gray-600 mb-2">
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
)