import { useMemo, useState } from 'react'
import type { ExpeditionRecord, ExpeditionRequest } from '../../shared/types'
import { PartyEditScreen } from './PartyEditScreen.tsx'
import { FormationScreen } from './FormationScreen.tsx'
import { ExpeditionLogScreen } from './ExpeditionLogScreen.tsx'
import { ExpeditionResultScreen } from './ExpeditionResultScreen.tsx'
import { ExpeditionPreparationScreen } from './ExpeditionPreparationScreen.tsx'
import { usePartyService } from '../hooks/usePartyService.ts'
import { useGoblinService } from '../hooks/useGoblinService.ts'
import { useExpeditionState } from '../contexts/ExpeditionStateContextValue.ts'
import { areasData } from '../../shared/data'
import { ExpeditionEngine } from '../../core/services'
import { StartExpeditionUseCase } from '../../core/usecases'
import { useExpeditionFlow } from '../hooks/useExpeditionFlow.ts'

type ViewMode = 'list' | 'preparation' | 'edit' | 'log' | 'result'

export const FormationTabScreen = () => {
  const {
    partyRepository,
    parties,
    isLoading: isPartyLoading,
    getPartyById,
    updateMembers,
    markExpedition,
    markIdle,
    setDungeon,
    setTargetFloor,
    setReturnPolicy,
  } = usePartyService()
  const {
    goblinRepository,
    goblins,
    isLoading: isGoblinLoading,
  } = useGoblinService()
  const {
    getExpeditionByPartyId,
    setPartyExpeditionStatus,
    getPartyExpeditionHistory,
    expeditionRepository,
    clearExpedition,
  } = useExpeditionState()
  const [editingPartyId, setEditingPartyId] = useState<number | null>(null)
  const [selectedHistoryReplay, setSelectedHistoryReplay] = useState<ExpeditionRecord | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  const expeditionEngine = useMemo(() => new ExpeditionEngine(), [])
  const startExpeditionUseCase = useMemo(
    () => new StartExpeditionUseCase(partyRepository, goblinRepository, expeditionEngine),
    [partyRepository, goblinRepository, expeditionEngine]
  )
  const { startExpedition, estimateExplorationTime } = useExpeditionFlow({
    startExpeditionUseCase,
    expeditionRepository,
    setPartyExpeditionStatus,
    clearExpedition,
    getPartyById,
    markPartyAsOnExpedition: markExpedition,
    markPartyAsIdle: markIdle,
  })
  const isLoading = isPartyLoading || isGoblinLoading

  const handlePartySelect = (partyId: number) => {
    setEditingPartyId(partyId)
    setViewMode('preparation')
  }

  const handleBackToFormation = () => {
    setEditingPartyId(null)
    setViewMode('list')
  }

  const handleExpeditionPartyClick = async (partyId: number) => {
    try {
      const expeditionRecord = await getExpeditionByPartyId(partyId)

      if (!expeditionRecord) {
        return
      }

      // returnTimeで遠征中かどうかを判定
      const now = new Date()
      const isStillOngoing = expeditionRecord.returnTime > now

      if (isStillOngoing) {
        // まだ帰還時刻前なら情報を表示
        alert(`${expeditionRecord.partyName}は現在遠征中です。\n帰還予定時刻: ${expeditionRecord.returnTime.toLocaleString()}`)
      } else if (expeditionRecord.replay) {
        // 帰還済みでリプレイデータがある場合はログ画面へ
        setSelectedHistoryReplay(expeditionRecord)
        setViewMode('log')
      }
    } catch (error) {
      console.error('遠征データ取得エラー:', error)
      alert('遠征データの取得に失敗しました')
    }
  }

  const handleHistoryClick = (expeditionRecord: ExpeditionRecord) => {
    if (expeditionRecord.replay) {
      // 履歴クリック時は結果画面を表示
      setSelectedHistoryReplay(expeditionRecord)
      setViewMode('result')
    }
  }

  const handleLogClick = (expeditionRecord: ExpeditionRecord) => {
    if (expeditionRecord.replay) {
      // ログアイコンクリック時はログ画面を表示
      setSelectedHistoryReplay(expeditionRecord)
      setViewMode('log')
    }
  }

  const handleBackToFormationList = () => {
    setSelectedHistoryReplay(null)
    setViewMode('list')
  }

  const handleEditParty = () => {
    setViewMode('edit')
  }

  const handleBackToPreparation = () => {
    setViewMode('preparation')
  }

  const handleStartExpedition = async (request: ExpeditionRequest) => {
    const partyId = Number.parseInt(request.partyId, 10)
    if (Number.isNaN(partyId)) {
      alert('パーティIDが不正です')
      return
    }

    try {
      const party = getPartyById(partyId)
      if (!party.dungeonId) {
        alert('探索先が設定されていません')
        return
      }

      const dungeon = areasData.find(d => d.id.toString() === party.dungeonId)
      if (!dungeon) {
        alert('ダンジョン情報が取得できません')
        return
      }

      await startExpedition(request, dungeon)
      handleBackToFormation()
    } catch (error) {
      console.error('遠征エラー:', error)
      alert('遠征中にエラーが発生しました')
    }
  }

  // 結果画面表示中
  if (viewMode === 'result' && selectedHistoryReplay?.replay) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center px-4 py-2 bg-gray-100 border-b border-gray-300">
          <div className="flex gap-2 items-center">
            <button
              onClick={handleBackToFormationList}
              className="text-gray-600 transition-colors hover:text-gray-800"
            >
              ← 戻る
            </button>
            <span className="text-sm font-medium text-gray-700">
              遠征結果
            </span>
          </div>
        </div>
        <div className="overflow-hidden flex-1">
          <ExpeditionResultScreen
            expeditionReplay={selectedHistoryReplay.replay}
            goblins={goblins}
            dungeonName={selectedHistoryReplay.dungeonName}
            onBackToMenu={handleBackToFormationList}
          />
        </div>
      </div>
    )
  }

  // ログ画面表示中
  if (viewMode === 'log' && selectedHistoryReplay?.replay) {
    const dungeon = areasData.find(d => d.id === selectedHistoryReplay.dungeonId)
    return (
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center px-4 py-2 bg-gray-100 border-b border-gray-300">
          <div className="flex gap-2 items-center">
            <button
              onClick={handleBackToFormationList}
              className="text-gray-600 transition-colors hover:text-gray-800"
            >
              ← 戻る
            </button>
            <span className="text-sm font-medium text-gray-700">
              {dungeon?.name || '遠征'} - ログ閲覧
            </span>
          </div>
        </div>
        <div className="overflow-hidden flex-1">
          <ExpeditionLogScreen
            expeditionReplay={selectedHistoryReplay.replay}
            goblins={goblins}
            startTime={selectedHistoryReplay.startTime}
          />
        </div>
      </div>
    )
  }

  // 冒険準備画面
  if (viewMode === 'preparation' && editingPartyId !== null) {
    return (
      <ExpeditionPreparationScreen
        partyId={editingPartyId}
        getPartyById={getPartyById}
        goblins={goblins}
        dungeons={areasData}
        onSetDungeon={setDungeon}
        onSetTargetFloor={setTargetFloor}
        onSetReturnPolicy={setReturnPolicy}
        onBack={handleBackToFormation}
        onEditParty={handleEditParty}
        onStartExpedition={handleStartExpedition}
        estimateExplorationTime={estimateExplorationTime}
      />
    )
  }

  // パーティ編集画面
  if (viewMode === 'edit' && editingPartyId !== null) {
    return (
      <PartyEditScreen
        partyId={editingPartyId}
        goblins={goblins}
        getPartyById={getPartyById}
        updateMembers={updateMembers}
        onBack={handleBackToPreparation}
      />
    )
  }

  // パーティ一覧画面
  return (
    <FormationScreen
      parties={parties}
      goblins={goblins}
      onPartySelect={handlePartySelect}
      onExpeditionPartyClick={handleExpeditionPartyClick}
      onHistoryClick={handleHistoryClick}
      onLogClick={handleLogClick}
      isLoading={isLoading}
      getPartyExpeditionHistory={getPartyExpeditionHistory}
      onMarkPartyIdle={markIdle}
      onClearExpedition={clearExpedition}
    />
  )
}
