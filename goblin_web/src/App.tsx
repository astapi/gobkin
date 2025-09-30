import { useState, useMemo } from 'react'
import type { Goblin, Dungeon, ExpeditionRequest, ExpeditionReplay } from './types/index.ts'
import { goblinsData, dungeonsData } from './data/index.ts'
import { GoblinListScreen } from './components/GoblinListScreen.tsx'
import { FormationScreen } from './components/FormationScreen.tsx'
import { PartyEditScreen } from './components/PartyEditScreen.tsx'
import { DungeonScreen } from './components/DungeonScreen.tsx'
import { ExpeditionSetupScreen } from './components/ExpeditionSetupScreen.tsx'
import { ExpeditionPlaybackScreen } from './components/ExpeditionPlaybackScreen.tsx'
import { ExpeditionResultScreen } from './components/ExpeditionResultScreen.tsx'
import { GoblinDetailModal } from './components/GoblinDetailModal.tsx'
import { TabMenu } from './components/TabMenu.tsx'
import { JsonPartyRepositoryImpl } from './repositories/JsonPartyRepositoryImpl.ts'
import { FirestorePartyRepositoryAdapter } from './repositories/FirestorePartyRepositoryImpl.ts'
import { ExpeditionEngine } from './services/ExpeditionEngine.ts'
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx'

function AppContent() {
  const { loading } = useAuth()
  const [activeTab, setActiveTab] = useState('list')
  const [selectedGoblin, setSelectedGoblin] = useState<Goblin | null>(null)
  const [editingPartyId, setEditingPartyId] = useState<number | null>(null)
  const [selectedDungeon, setSelectedDungeon] = useState<Dungeon | null>(null)
  const [isExpeditionSetup, setIsExpeditionSetup] = useState(false)
  const [currentExpeditionReplay, setCurrentExpeditionReplay] = useState<ExpeditionReplay | null>(null)
  const [showExpeditionResult, setShowExpeditionResult] = useState(false)
  const [repositoryInitialized, setRepositoryInitialized] = useState(false)

  // 環境変数でFirestoreの使用を制御
  const useFirestore = import.meta.env.VITE_USE_FIRESTORE === 'true'
  const partyRepository = useMemo(() => {
    const repo = useFirestore ? new FirestorePartyRepositoryAdapter() : new JsonPartyRepositoryImpl()

    if (useFirestore && repo instanceof FirestorePartyRepositoryAdapter) {
      repo.setOnDataChange(() => {
        setRepositoryInitialized(true)
      })
    } else {
      setRepositoryInitialized(true)
    }

    return repo
  }, [useFirestore])
  const expeditionEngine = useMemo(() => new ExpeditionEngine(), [])

  if (loading) {
    return (
      <div className="h-screen flex flex-col max-w-[414px] mx-auto border-2 border-gray-300 overflow-hidden bg-gray-50 relative">
        <div className="bg-gray-800 text-white p-5 text-center shadow-lg">
          <h1 className="text-lg font-bold tracking-wide">🏰 ゴブリン王国</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-xl mb-2">⚡</div>
            <div className="text-gray-600">認証中...</div>
          </div>
        </div>
      </div>
    )
  }

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

      // 遠征を実行してリプレイデータを生成
      const result = expeditionEngine.generateExpedition(request, partyMembers)

      // 再生画面へ遷移
      setCurrentExpeditionReplay(result)
      setIsExpeditionSetup(false)
    } catch (error) {
      console.error('遠征エラー:', error)
      alert('遠征中にエラーが発生しました')
    }
  }

  const handleExpeditionComplete = () => {
    // 結果画面を表示
    setShowExpeditionResult(true)
  }

  const handleBackToMenu = () => {
    // 画面をリセット
    setCurrentExpeditionReplay(null)
    setSelectedDungeon(null)
    setIsExpeditionSetup(false)
    setShowExpeditionResult(false)
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
              isLoading={useFirestore && !repositoryInitialized}
            />
          )
        )}
        {activeTab === 'cave' && (
          selectedDungeon && currentExpeditionReplay && showExpeditionResult ? (
            <ExpeditionResultScreen
              expeditionReplay={currentExpeditionReplay}
              goblins={goblinsData}
              onBackToMenu={handleBackToMenu}
            />
          ) : selectedDungeon && currentExpeditionReplay ? (
            <ExpeditionPlaybackScreen
              expeditionReplay={currentExpeditionReplay}
              goblins={goblinsData}
              onComplete={handleExpeditionComplete}
            />
          ) : selectedDungeon && isExpeditionSetup ? (
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

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App