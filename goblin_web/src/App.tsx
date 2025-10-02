import { useState, useMemo } from 'react'
import type { Goblin, Dungeon, ExpeditionRequest, ExpeditionReplay } from './types/index.ts'
import { goblinsData, dungeonsData } from './data/index.ts'
import { GoblinListScreen } from './components/GoblinListScreen.tsx'
import { FormationTabScreen } from './components/FormationTabScreen.tsx'
import { DungeonScreen } from './components/DungeonScreen.tsx'
import { ExpeditionSetupScreen } from './components/ExpeditionSetupScreen.tsx'
import { ExpeditionPlaybackScreen } from './components/ExpeditionPlaybackScreen.tsx'
import { ExpeditionResultScreen } from './components/ExpeditionResultScreen.tsx'
import { GoblinDetailModal } from './components/GoblinDetailModal.tsx'
import { TabMenu } from './components/TabMenu.tsx'
import { FirestoreExpeditionRepositoryAdapter } from './repositories/FirestoreExpeditionRepositoryImpl.ts'
import { ExpeditionEngine } from './services/ExpeditionEngine.ts'
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx'
import { ExpeditionStateProvider, useExpeditionState } from './contexts/ExpeditionStateContext.tsx'
import { usePartyRepository } from './hooks/usePartyRepository.ts'

function AppContent() {
  const { loading } = useAuth()
  const { setPartyExpeditionStatus, clearExpedition } = useExpeditionState()
  const [activeTab, setActiveTab] = useState('list')
  const [selectedGoblin, setSelectedGoblin] = useState<Goblin | null>(null)
  const [selectedDungeon, setSelectedDungeon] = useState<Dungeon | null>(null)
  const [isExpeditionSetup, setIsExpeditionSetup] = useState(false)
  const [currentExpeditionReplay, setCurrentExpeditionReplay] = useState<ExpeditionReplay | null>(null)
  const [showExpeditionResult, setShowExpeditionResult] = useState(false)
  const [currentExpeditionPartyId, setCurrentExpeditionPartyId] = useState<number | null>(null)

  // partyRepositoryの初期化をカスタムフックで管理
  const { partyRepository } = usePartyRepository()

  // 環境変数でFirestoreの使用を制御
  const useFirestore = import.meta.env.VITE_USE_FIRESTORE === 'true'
  const expeditionEngine = useMemo(() => new ExpeditionEngine(), [])
  const expeditionRepository = useMemo(() =>
    useFirestore ? new FirestoreExpeditionRepositoryAdapter() : null, [useFirestore]
  )

  if (loading) {
    return (
      <div className="h-screen flex flex-col max-w-[414px] mx-auto border-2 border-gray-300 overflow-hidden bg-gray-50 relative">
        <div className="p-5 text-center text-white bg-gray-800 shadow-lg">
          <h1 className="text-lg font-bold tracking-wide">🏰 ゴブリン王国</h1>
        </div>
        <div className="flex flex-1 justify-center items-center">
          <div className="text-center">
            <div className="mb-2 text-xl">⚡</div>
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


  const handleStartExplore = (dungeon: Dungeon) => {
    setSelectedDungeon(dungeon)
    setIsExpeditionSetup(true)
  }

  const handleBackToDungeon = () => {
    setSelectedDungeon(null)
    setIsExpeditionSetup(false)
  }

  const handleStartExpedition = async (request: ExpeditionRequest) => {
    try {
      // パーティメンバーを取得
      const partyId = parseInt(request.partyId)
      const party = partyRepository.getParty(partyId)
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

      // ダンジョン情報を取得
      const dungeon = selectedDungeon
      if (!dungeon) {
        alert('ダンジョン情報が取得できません')
        return
      }

      // 探索時間を計算（returnPolicyによる補正）
      const baseTime = dungeon.exploration_time_sec_first || dungeon.exploration_time_sec
      let timeMultiplier = 1.0
      switch (request.returnPolicy) {
        case "until_floor2":
          timeMultiplier = 0.4
          break
        case "until_floor3":
          timeMultiplier = 0.6
          break
        case "if_any_ko":
          timeMultiplier = 0.7
          break
        case "last_one":
          timeMultiplier = 0.9
          break
        case "never":
          timeMultiplier = 1.0
          break
      }
      const explorationTimeSec = Math.floor(baseTime * timeMultiplier)

      // Firestoreを使用している場合は遠征データを保存
      let expeditionRecord = null
      if (expeditionRepository) {
        expeditionRecord = await expeditionRepository.createExpedition(
          partyId,
          party.name,
          dungeon.id,
          dungeon.name,
          request.returnPolicy,
          explorationTimeSec
        )
      }

      // パーティの状態を遠征中に更新
      setPartyExpeditionStatus(partyId, 'expedition')
      partyRepository.updatePartyStatus(partyId, 'expedition')
      setCurrentExpeditionPartyId(partyId) // パーティIDを保存

      // 遠征を実行してリプレイデータを生成
      const result = expeditionEngine.generateExpedition(request, partyMembers)

      // Firestoreにリプレイデータを保存
      if (expeditionRecord && expeditionRepository) {
        await expeditionRepository.updateExpeditionReplay(expeditionRecord.id, result)
      }

      // 再生画面へ遷移
      setCurrentExpeditionReplay(result)
      setIsExpeditionSetup(false)
    } catch (error) {
      console.error('遠征エラー:', error)
      alert('遠征中にエラーが発生しました')
    }
  }

  const handleExpeditionComplete = () => {
    // 遠征中のパーティの状態を戻す
    if (currentExpeditionPartyId !== null) {
      clearExpedition(currentExpeditionPartyId)
      partyRepository.updatePartyStatus(currentExpeditionPartyId, 'idle')
    }

    // 結果画面を表示
    setShowExpeditionResult(true)
  }

  const handleBackToMenu = () => {
    // パーティの状態はすでにhandleExpeditionCompleteで処理済み
    // 画面をリセット
    setCurrentExpeditionReplay(null)
    setSelectedDungeon(null)
    setIsExpeditionSetup(false)
    setShowExpeditionResult(false)
    setCurrentExpeditionPartyId(null)
  }

  // FormationTabScreenは内部で遠征とリプレイを処理するため、これらのハンドラーは不要になりました

  return (
    <div className="h-screen flex flex-col max-w-[414px] mx-auto border-2 border-gray-300 overflow-hidden bg-gray-50 relative">
      {/* Header */}
      <div className="p-5 text-center text-white bg-gray-800 shadow-lg">
        <h1 className="text-lg font-bold tracking-wide">🏰 ゴブリン王国</h1>
      </div>

      {/* Main Content */}
      <div className="overflow-hidden flex-1 p-4 bg-gray-50">
        {activeTab === 'list' && (
          <GoblinListScreen goblins={goblinsData} onGoblinClick={handleGoblinClick} />
        )}
        {activeTab === 'formation' && (
          <FormationTabScreen />
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
      <ExpeditionStateProvider>
        <AppContent />
      </ExpeditionStateProvider>
    </AuthProvider>
  )
}

export default App