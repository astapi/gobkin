import { useState } from 'react'
import type { Goblin } from '../shared/types'
import { useGoblinRepository } from '../hooks/useGoblinRepository.ts'
import { GoblinCard } from './GoblinCard.tsx'
import { GoblinDetailModal } from './GoblinDetailModal.tsx'

interface GoblinListScreenProps {}

export const GoblinListScreen = ({}: GoblinListScreenProps) => {
  const [selectedGoblin, setSelectedGoblin] = useState<Goblin | null>(null)
  const { goblinRepository, isLoading } = useGoblinRepository()

  const goblins = goblinRepository.getGoblins()

  const handleGoblinClick = (goblin: Goblin) => {
    setSelectedGoblin(goblin)
  }

  const closeDetail = () => {
    setSelectedGoblin(null)
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    )
  }

  return (
  <div className="h-full overflow-y-auto">
    <div className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">
      王国のゴブリン達
    </div>
    <div className="flex flex-col gap-3">
      {goblins.map(goblin => (
        <GoblinCard
          key={goblin.id}
          goblin={goblin}
          onClick={() => handleGoblinClick(goblin)}
        />
      ))}
    </div>

    {/* Detail Modal */}
    {selectedGoblin && (
      <GoblinDetailModal
        goblin={selectedGoblin}
        onClose={closeDetail}
        goblinRepository={goblinRepository}
      />
    )}
  </div>
  )
}