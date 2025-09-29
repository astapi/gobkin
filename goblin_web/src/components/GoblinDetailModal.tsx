import type { Goblin } from '../types/index.ts'

interface GoblinDetailModalProps {
  goblin: Goblin | null
  onClose: () => void
}

export const GoblinDetailModal = ({ goblin, onClose }: GoblinDetailModalProps) => {
  if (!goblin) return null

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col max-w-[414px] mx-auto">
      <div className="bg-gray-800 text-white p-5 flex items-center gap-4 shadow-lg">
        <button
          onClick={onClose}
          className="text-xl p-2 rounded hover:bg-white/20 transition-colors"
        >
          ←
        </button>
        <h2 className="text-lg font-bold tracking-wide">ゴブリン詳細</h2>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md">
          <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-gray-100">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center border-[3px] border-gray-400 overflow-hidden">
              <img src={goblin.avatar} alt={goblin.name} className="w-full h-full object-cover" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-800">{goblin.name}</h3>
              <div className="text-gray-600 text-base mt-1">{goblin.race}</div>
              <div className="text-gray-800 text-lg font-bold">Lv.{goblin.level}</div>
            </div>
          </div>

          <div className="mt-2">
            <div className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">
              ステータス
            </div>
            <div className="flex flex-col gap-3">
              {Object.entries(goblin.stats).map(([key, value]) => (
                <div key={key} className="bg-gray-50 border border-gray-300 rounded-lg p-4 flex justify-between items-center">
                  <div className="text-base font-bold text-gray-800">
                    {key.toUpperCase()}
                  </div>
                  <div className="text-lg font-bold text-gray-600">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}