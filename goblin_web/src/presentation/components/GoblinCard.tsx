import type { Goblin } from '../../shared/types'

interface GoblinCardProps {
  goblin: Goblin
  onClick?: () => void
}

export const GoblinCard = ({ goblin, onClick }: GoblinCardProps) => (
  <div
    className="bg-white border-2 border-gray-200 rounded-lg p-3 flex items-center gap-3 shadow-sm hover:border-gray-400 hover:shadow-md transition-all cursor-pointer"
    onClick={onClick}
  >
    <div className="w-12 h-12 flex items-center justify-center">
      <img src={goblin.avatar} alt={goblin.name} className="w-full h-full object-contain" />
    </div>
    <div className="flex-1">
      <div className="font-bold text-gray-800 text-sm">{goblin.name}</div>
      <div className="text-gray-600 text-xs mt-0.5">{goblin.race}</div>
      <div className="text-gray-600 text-xs font-bold">Lv.{goblin.level}</div>
    </div>
  </div>
)