import { useState, useMemo } from 'react'
import type { ExpeditionRecord, ExpeditionRequest, Goblin } from '../../shared/types'
import { PartyEditScreen } from './PartyEditScreen.tsx'
import { FormationScreen } from './FormationScreen.tsx'
import { ExpeditionLogScreen } from './ExpeditionLogScreen.tsx'
import { ExpeditionResultScreen } from './ExpeditionResultScreen.tsx'
import { ExpeditionPreparationScreen } from './ExpeditionPreparationScreen.tsx'
import { usePartyRepository } from '../hooks/usePartyRepository.ts'
import { useGoblinRepository } from '../hooks/useGoblinRepository.ts'
import { useExpeditionState } from '../contexts/ExpeditionStateContext.tsx'
import { areasData } from '../../shared/data'
import { ExpeditionEngine } from '../../core/ExpeditionEngine.ts'

type ViewMode = 'list' | 'preparation' | 'edit' | 'log' | 'result'

export const FormationTabScreen = () => {
  const { partyRepository, isLoading: isPartyLoading } = usePartyRepository()
  const { goblinRepository, isLoading: isGoblinLoading } = useGoblinRepository()
  const { getExpeditionByPartyId, setPartyExpeditionStatus, expeditionRepository } = useExpeditionState()
  const [editingPartyId, setEditingPartyId] = useState<number | null>(null)
  const [selectedHistoryReplay, setSelectedHistoryReplay] = useState<ExpeditionRecord | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  const expeditionEngine = useMemo(() => new ExpeditionEngine(), [])
  const goblins = goblinRepository.getGoblins()
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
    try {
      const partyId = parseInt(request.partyId)
      const party = partyRepository.getParty(partyId)
      if (!party) {
        alert('パーティが見つかりません')
        return
      }

      const partyMembers = party.memberIds
        .map(id => goblins.find(g => g.id === id))
        .filter((g): g is Goblin => g !== undefined)

      if (partyMembers.length === 0) {
        alert('有効なパーティメンバーがいません')
        return
      }

      const dungeon = areasData.find(d => d.id === party.dungeonId)
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
        case "if_two_ko":
          timeMultiplier = 0.75
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

      const result = await expeditionEngine.generateExpedition(request, partyMembers)

      if (expeditionRecord && expeditionRepository) {
        await expeditionRepository.updateExpeditionReplay(expeditionRecord.id, result)
      }

      // 遠征開始後、一覧画面に戻る
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
        partyRepository={partyRepository}
        goblins={goblins}
        dungeons={areasData}
        onBack={handleBackToFormation}
        onEditParty={handleEditParty}
        onStartExpedition={handleStartExpedition}
      />
    )
  }

  // パーティ編集画面
  if (viewMode === 'edit' && editingPartyId !== null) {
    return (
      <PartyEditScreen
        partyId={editingPartyId}
        goblins={goblins}
        partyRepository={partyRepository}
        onBack={handleBackToPreparation}
      />
    )
  }

  // パーティ一覧画面
  return (
    <FormationScreen
      partyRepository={partyRepository}
      goblins={goblins}
      onPartySelect={handlePartySelect}
      onExpeditionPartyClick={handleExpeditionPartyClick}
      onHistoryClick={handleHistoryClick}
      onLogClick={handleLogClick}
      isLoading={isLoading}
    />
  )
}