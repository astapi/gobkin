import type { Goblin } from '../types/index.ts'
import { GoblinCard } from './GoblinCard.tsx'

interface GoblinListScreenProps {
  goblins: Goblin[]
  onGoblinClick: (goblin: Goblin) => void
}

export const GoblinListScreen = ({ goblins, onGoblinClick }: GoblinListScreenProps) => (
  <div className="h-full overflow-y-auto">
    <div className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">
      王国のゴブリン達
    </div>
    <div className="flex flex-col gap-3">
      {goblins.map(goblin => (
        <GoblinCard
          key={goblin.id}
          goblin={goblin}
          onClick={() => onGoblinClick(goblin)}
        />
      ))}
    </div>
  </div>
)