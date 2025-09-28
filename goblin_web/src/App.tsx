import { useState, useMemo } from 'react'
import type { Goblin } from './types/index.ts'
import { goblinsData, dungeonsData } from './data/index.ts'
import { GoblinListScreen } from './components/GoblinListScreen.tsx'
import { FormationScreen } from './components/FormationScreen.tsx'
import { PartyEditScreen } from './components/PartyEditScreen.tsx'
import { DungeonScreen } from './components/DungeonScreen.tsx'
import { GoblinDetailModal } from './components/GoblinDetailModal.tsx'
import { TabMenu } from './components/TabMenu.tsx'
import { JsonPartyRepositoryImpl } from './repositories/JsonPartyRepositoryImpl.ts'

function App() {
  const [activeTab, setActiveTab] = useState('list')
  const [selectedGoblin, setSelectedGoblin] = useState<Goblin | null>(null)
  const [editingPartyId, setEditingPartyId] = useState<number | null>(null)

  const partyRepository = useMemo(() => new JsonPartyRepositoryImpl(), [])

  const handleGoblinClick = (goblin: Goblin) => {
    setSelectedGoblin(goblin)
  }

  const closeDetail = () => {
    setSelectedGoblin(null)
  }

  const handlePartySelect = (partyId: number) => {
    setEditingPartyId(partyId)
  }

  const handleBackToFormation = () => {
    setEditingPartyId(null)
  }

  return (
    <div className="h-screen flex flex-col max-w-[414px] mx-auto border-2 border-gray-300 overflow-hidden bg-gray-50 relative">
      {/* Header */}
      <div className="bg-gray-800 text-white p-5 text-center shadow-lg">
        <h1 className="text-lg font-bold tracking-wide">🏰 ゴブリン王国</h1>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 bg-gray-50 overflow-hidden">
        {activeTab === 'list' && (
          <GoblinListScreen goblins={goblinsData} onGoblinClick={handleGoblinClick} />
        )}
        {activeTab === 'hensei' && (
          editingPartyId !== null ? (
            <PartyEditScreen
              partyId={editingPartyId}
              goblins={goblinsData}
              partyRepository={partyRepository}
              onBack={handleBackToFormation}
            />
          ) : (
            <FormationScreen
              partyRepository={partyRepository}
              goblins={goblinsData}
              onPartySelect={handlePartySelect}
            />
          )
        )}
        {activeTab === 'cave' && (
          <DungeonScreen dungeons={dungeonsData} />
        )}
      </div>

      {/* Tab Menu */}
      <TabMenu activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Detail Modal */}
      {selectedGoblin && (
        <GoblinDetailModal goblin={selectedGoblin} onClose={closeDetail} />
      )}
    </div>
  )
}

export default App