import type { Dungeon } from '../types/index.ts'

interface DungeonScreenProps {
  dungeons: Dungeon[]
}

export const DungeonScreen = ({ dungeons }: DungeonScreenProps) => (
  <div className="h-full overflow-y-auto">
    <div className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">
      ダンジョン選択
    </div>
    <div className="flex flex-col gap-4">
      {dungeons.map(dungeon => (
        <div key={dungeon.id} className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden shadow-md">
          <div className="bg-gray-700 text-white p-4 text-center">
            <div className="font-bold text-base mb-1">
              {dungeon.icon} {dungeon.name}
            </div>
            <div className="text-xs opacity-90">難易度: {dungeon.difficulty}</div>
          </div>
          <div className="p-4">
            <div className="flex justify-between text-xs text-gray-600 mb-3">
              <span>💰 ゴールド: {dungeon.rewards.gold}</span>
              <span>{dungeon.rewards.item}</span>
            </div>
            <button
              className={`w-full font-bold py-2.5 rounded-md transition-colors ${
                dungeon.disabled
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
              disabled={dungeon.disabled}
              onClick={() => !dungeon.disabled && alert(`${dungeon.name}への探索を開始します！`)}
            >
              {dungeon.disabled ? 'パーティが不足' : '探索開始'}
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
)