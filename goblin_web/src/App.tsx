import { useState, useMemo } from 'react'
import type { Goblin, Dungeon, ExpeditionRequest } from './types/index.ts'
import { goblinsData, dungeonsData } from './data/index.ts'
import { GoblinListScreen } from './components/GoblinListScreen.tsx'
import { FormationScreen } from './components/FormationScreen.tsx'
import { PartyEditScreen } from './components/PartyEditScreen.tsx'
import { DungeonScreen } from './components/DungeonScreen.tsx'
import { ExpeditionSetupScreen } from './components/ExpeditionSetupScreen.tsx'
import { GoblinDetailModal } from './components/GoblinDetailModal.tsx'
import { TabMenu } from './components/TabMenu.tsx'
import { JsonPartyRepositoryImpl } from './repositories/JsonPartyRepositoryImpl.ts'
import { ExpeditionEngine } from './services/ExpeditionEngine.ts'

function App() {
  const [activeTab, setActiveTab] = useState('list')
  const [selectedGoblin, setSelectedGoblin] = useState<Goblin | null>(null)
  const [editingPartyId, setEditingPartyId] = useState<number | null>(null)
  const [selectedDungeon, setSelectedDungeon] = useState<Dungeon | null>(null)
  const [isExpeditionSetup, setIsExpeditionSetup] = useState(false)

  const partyRepository = useMemo(() => new JsonPartyRepositoryImpl(), [])
  const expeditionEngine = useMemo(() => new ExpeditionEngine(), [])

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

  const handleStartExplore = (dungeon: Dungeon) => {
    setSelectedDungeon(dungeon)
    setIsExpeditionSetup(true)
  }

  const handleBackToDungeon = () => {
    setSelectedDungeon(null)
    setIsExpeditionSetup(false)
  }

  const handleStartExpedition = (request: ExpeditionRequest) => {
    try {
      // パーティメンバーを取得
      const party = partyRepository.getParty(parseInt(request.partyId))
      if (!party) {
        alert('パーティが見つかりません')
        return
      }

      const partyMembers = party.memberIds
        .map(id => goblinsData.find(g => g.id === id))
        .filter((g): g is Goblin => g !== undefined)

      if (partyMembers.length === 0) {
        alert('有効なパーティメンバーがいません')
        return
      }

      // 遠征を実行
      const result = expeditionEngine.generateExpedition(request, partyMembers)

      // 結果を表示（簡易版）
      alert(`遠征完了！\n成功: ${result.summary.success ? 'はい' : 'いいえ'}\n到達階層: ${result.summary.maxFloorReached}\n獲得XP: ${result.summary.xpGained}\n戦利品: ${result.summary.loot.length}個`)

      // 画面をリセット
      setSelectedDungeon(null)
      setIsExpeditionSetup(false)
    } catch (error) {
      console.error('遠征エラー:', error)
      alert('遠征中にエラーが発生しました')
    }
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
          selectedDungeon && isExpeditionSetup ? (
            <ExpeditionSetupScreen
              parties={partyRepository.getParties()}
              goblins={goblinsData}
              dungeon={selectedDungeon}
              onStartExpedition={handleStartExpedition}
              onBack={handleBackToDungeon}
            />
          ) : (
            <DungeonScreen
              dungeons={dungeonsData}
              onStartExplore={handleStartExplore}
            />
          )
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