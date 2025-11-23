import { useMemo, useState } from 'react'
import type { Dungeon, ExpeditionRequest, ExpeditionReplay } from '../../shared/types'
import { DungeonScreen } from './DungeonScreen.tsx'
import { ExpeditionSetupScreen } from './ExpeditionSetupScreen.tsx'
import { ExpeditionPlaybackScreen } from './ExpeditionPlaybackScreen.tsx'
import { ExpeditionResultScreen } from './ExpeditionResultScreen.tsx'
import { ExpeditionEngine } from '../../core/services'
import { StartExpeditionUseCase } from '../../core/usecases'
import { useExpeditionState } from '../contexts/ExpeditionStateContextValue.ts'
import { usePartyService } from '../hooks/usePartyService.ts'
import { useGoblinService } from '../hooks/useGoblinService.ts'
import { useExpeditionFlow } from '../hooks/useExpeditionFlow.ts'
import { useDungeonProgress } from '../hooks/useDungeonProgress.ts'

export function ExpeditionTabScreen() {
  const {
    setPartyExpeditionStatus,
    clearExpedition,
    expeditionRepository,
  } = useExpeditionState()
  const [selectedDungeon, setSelectedDungeon] = useState<Dungeon | null>(null)
  const [isExpeditionSetup, setIsExpeditionSetup] = useState(false)
  const [currentExpeditionReplay, setCurrentExpeditionReplay] = useState<ExpeditionReplay | null>(null)
  const [showExpeditionResult, setShowExpeditionResult] = useState(false)
  const [currentExpeditionPartyId, setCurrentExpeditionPartyId] = useState<number | null>(null)

  const {
    partyRepository,
    parties,
    getPartyById,
    markExpedition,
    markIdle,
  } = usePartyService()
  const { goblinRepository, goblins } = useGoblinService()
  const { dungeons, markDungeonCleared } = useDungeonProgress()

  const expeditionEngine = useMemo(() => new ExpeditionEngine(), [])
  const startExpeditionUseCase = useMemo(
    () => new StartExpeditionUseCase(partyRepository, goblinRepository, expeditionEngine),
    [partyRepository, goblinRepository, expeditionEngine]
  )
  const { startExpedition, completeExpedition, estimateExplorationTime } = useExpeditionFlow({
    startExpeditionUseCase,
    expeditionRepository,
    setPartyExpeditionStatus,
    clearExpedition,
    getPartyById,
    markPartyAsOnExpedition: markExpedition,
    markPartyAsIdle: markIdle,
  })

  const handleStartExplore = (dungeon: Dungeon) => {
    if (!dungeon.unlocked) {
      alert('このダンジョンは未解放です')
      return
    }

    setSelectedDungeon(dungeon)
    setIsExpeditionSetup(true)
  }

  const handleBackToDungeon = () => {
    setSelectedDungeon(null)
    setIsExpeditionSetup(false)
  }

  const handleStartExpedition = async (request: ExpeditionRequest) => {
    if (!selectedDungeon) {
      alert('ダンジョン情報が取得できません')
      return
    }

    try {
      const { partyId, replay } = await startExpedition(request, selectedDungeon)
      setCurrentExpeditionPartyId(partyId)
      setCurrentExpeditionReplay(replay)
      setIsExpeditionSetup(false)
    } catch (error) {
      console.error('遠征エラー:', error)
      alert('遠征中にエラーが発生しました')
    }
  }

  const handleExpeditionComplete = () => {
    if (currentExpeditionPartyId !== null) {
      completeExpedition(currentExpeditionPartyId)
    }

    if (selectedDungeon && currentExpeditionReplay?.summary.success) {
      const cleared = currentExpeditionReplay.summary.maxFloorReached >= selectedDungeon.floors
      markDungeonCleared(selectedDungeon, cleared)
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
        goblins={goblins}
        dungeonName={selectedDungeon.name}
        onBackToMenu={handleBackToMenu}
      />
    )
  }

  if (selectedDungeon && currentExpeditionReplay) {
    return (
      <ExpeditionPlaybackScreen
        expeditionReplay={currentExpeditionReplay}
        goblins={goblins}
        onComplete={handleExpeditionComplete}
      />
    )
  }

  if (selectedDungeon && isExpeditionSetup) {
    return (
      <ExpeditionSetupScreen
        parties={parties}
        goblins={goblins}
        dungeon={selectedDungeon}
        onStartExpedition={handleStartExpedition}
        onBack={handleBackToDungeon}
        estimateExplorationTime={estimateExplorationTime}
      />
    )
  }

  return (
    <DungeonScreen
      dungeons={dungeons}
      onStartExplore={handleStartExplore}
    />
  )
}
