import { useState, useMemo } from 'react'
import type { Dungeon, ExpeditionRequest, ExpeditionReplay, Goblin } from '../types/index.ts'
import { goblinsData, areasData } from '../data/index.ts'
import { DungeonScreen } from './DungeonScreen.tsx'
import { ExpeditionSetupScreen } from './ExpeditionSetupScreen.tsx'
import { ExpeditionPlaybackScreen } from './ExpeditionPlaybackScreen.tsx'
import { ExpeditionResultScreen } from './ExpeditionResultScreen.tsx'
import { FirestoreExpeditionRepositoryAdapter } from '../repositories/FirestoreExpeditionRepositoryImpl.ts'
import { ExpeditionEngine } from '../core/ExpeditionEngine.ts'
import { useExpeditionState } from '../contexts/ExpeditionStateContext.tsx'
import { usePartyRepository } from '../hooks/usePartyRepository.ts'

export function ExpeditionTabScreen() {
  const { setPartyExpeditionStatus, clearExpedition } = useExpeditionState()
  const [selectedDungeon, setSelectedDungeon] = useState<Dungeon | null>(null)
  const [isExpeditionSetup, setIsExpeditionSetup] = useState(false)
  const [currentExpeditionReplay, setCurrentExpeditionReplay] = useState<ExpeditionReplay | null>(null)
  const [showExpeditionResult, setShowExpeditionResult] = useState(false)
  const [currentExpeditionPartyId, setCurrentExpeditionPartyId] = useState<number | null>(null)

  const { partyRepository } = usePartyRepository()

  const useFirestore = import.meta.env.VITE_USE_FIRESTORE === 'true'
  const expeditionEngine = useMemo(() => new ExpeditionEngine(), [])
  const expeditionRepository = useMemo(() =>
    useFirestore ? new FirestoreExpeditionRepositoryAdapter() : null, [useFirestore]
  )

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

      const dungeon = selectedDungeon
      if (!dungeon) {
        alert('ダンジョン情報が取得できません')
        return
      }

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

      let expeditionRecord = null
      console.log('expeditionRepository', expeditionRepository)
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

      setPartyExpeditionStatus(partyId, 'expedition')
      partyRepository.updatePartyStatus(partyId, 'expedition')
      setCurrentExpeditionPartyId(partyId)

      const result = await expeditionEngine.generateExpedition(request, partyMembers)

      if (expeditionRecord && expeditionRepository) {
        await expeditionRepository.updateExpeditionReplay(expeditionRecord.id, result)
      }

      setCurrentExpeditionReplay(result)
      setIsExpeditionSetup(false)
    } catch (error) {
      console.error('遠征エラー:', error)
      alert('遠征中にエラーが発生しました')
    }
  }

  const handleExpeditionComplete = () => {
    if (currentExpeditionPartyId !== null) {
      clearExpedition(currentExpeditionPartyId)
      partyRepository.updatePartyStatus(currentExpeditionPartyId, 'idle')
    }

    setShowExpeditionResult(true)
  }

  const handleBackToMenu = () => {
    setCurrentExpeditionReplay(null)
    setSelectedDungeon(null)
    setIsExpeditionSetup(false)
    setShowExpeditionResult(false)
    setCurrentExpeditionPartyId(null)
  }

  if (selectedDungeon && currentExpeditionReplay && showExpeditionResult) {
    return (
      <ExpeditionResultScreen
        expeditionReplay={currentExpeditionReplay}
        goblins={goblinsData}
        dungeonName={selectedDungeon.name}
        onBackToMenu={handleBackToMenu}
      />
    )
  }

  if (selectedDungeon && currentExpeditionReplay) {
    return (
      <ExpeditionPlaybackScreen
        expeditionReplay={currentExpeditionReplay}
        goblins={goblinsData}
        onComplete={handleExpeditionComplete}
      />
    )
  }

  if (selectedDungeon && isExpeditionSetup) {
    return (
      <ExpeditionSetupScreen
        parties={partyRepository.getParties()}
        goblins={goblinsData}
        dungeon={selectedDungeon}
        onStartExpedition={handleStartExpedition}
        onBack={handleBackToDungeon}
      />
    )
  }

  return (
    <DungeonScreen
      dungeons={areasData}
      onStartExplore={handleStartExplore}
    />
  )
}