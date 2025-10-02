import { useState } from 'react'
import type { Goblin } from '../types/index.ts'
import { goblinsData } from '../data/index.ts'
import { GoblinCard } from './GoblinCard.tsx'
import { GoblinDetailModal } from './GoblinDetailModal.tsx'

interface GoblinListScreenProps {}

export const GoblinListScreen = ({}: GoblinListScreenProps) => {
  const [selectedGoblin, setSelectedGoblin] = useState<Goblin | null>(null)

  const handleGoblinClick = (goblin: Goblin) => {
    setSelectedGoblin(goblin)
  }

  const closeDetail = () => {
    setSelectedGoblin(null)
  }

  return (
  <div className="h-full overflow-y-auto">
    <div className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">
      王国のゴブリン達
    </div>
    <div className="flex flex-col gap-3">
      {goblinsData.map(goblin => (
        <GoblinCard
          key={goblin.id}
          goblin={goblin}
          onClick={() => handleGoblinClick(goblin)}
        />
      ))}
    </div>

    {/* Detail Modal */}
    {selectedGoblin && (
      <GoblinDetailModal goblin={selectedGoblin} onClose={closeDetail} />
    )}
  </div>
  )
}