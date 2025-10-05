import { useState } from 'react'
import type { ExpeditionRecord } from '../types/index.ts'
import { PartyEditScreen } from './PartyEditScreen.tsx'
import { FormationScreen } from './FormationScreen.tsx'
import { ExpeditionLogScreen } from './ExpeditionLogScreen.tsx'
import { ExpeditionResultScreen } from './ExpeditionResultScreen.tsx'
import { usePartyRepository } from '../hooks/usePartyRepository.ts'
import { useExpeditionState } from '../contexts/ExpeditionStateContext.tsx'
import { goblinsData, dungeonsData } from '../data/index.ts'

type ViewMode = 'list' | 'edit' | 'log' | 'result'

export const FormationTabScreen = () => {
  const { partyRepository, isLoading } = usePartyRepository()
  const { getExpeditionByPartyId } = useExpeditionState()
  const [editingPartyId, setEditingPartyId] = useState<number | null>(null)
  const [selectedHistoryReplay, setSelectedHistoryReplay] = useState<ExpeditionRecord | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  const handlePartySelect = (partyId: number) => {
    setEditingPartyId(partyId)
    setViewMode('edit')
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

  // 結果画面表示中
  if (viewMode === 'result' && selectedHistoryReplay?.replay) {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-gray-100 px-4 py-2 border-b border-gray-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleBackToFormationList}
              className="text-gray-600 hover:text-gray-800 transition-colors"
            >
              ← 戻る
            </button>
            <span className="text-sm font-medium text-gray-700">
              遠征結果
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <ExpeditionResultScreen
            expeditionReplay={selectedHistoryReplay.replay}
            goblins={goblinsData}
            dungeonName={selectedHistoryReplay.dungeonName}
            onBackToMenu={handleBackToFormationList}
          />
        </div>
      </div>
    )
  }

  // ログ画面表示中
  if (viewMode === 'log' && selectedHistoryReplay?.replay) {
    const dungeon = dungeonsData.find(d => d.id === selectedHistoryReplay.dungeonId)
    return (
      <div className="h-full flex flex-col">
        <div className="bg-gray-100 px-4 py-2 border-b border-gray-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleBackToFormationList}
              className="text-gray-600 hover:text-gray-800 transition-colors"
            >
              ← 戻る
            </button>
            <span className="text-sm font-medium text-gray-700">
              {dungeon?.name || '遠征'} - ログ閲覧
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <ExpeditionLogScreen
            expeditionReplay={selectedHistoryReplay.replay}
            goblins={goblinsData}
            startTime={selectedHistoryReplay.startTime}
          />
        </div>
      </div>
    )
  }

  // パーティ編集画面
  if (viewMode === 'edit' && editingPartyId !== null) {
    return (
      <PartyEditScreen
        partyId={editingPartyId}
        goblins={goblinsData}
        partyRepository={partyRepository}
        onBack={handleBackToFormation}
      />
    )
  }

  // パーティ一覧画面
  return (
    <FormationScreen
      partyRepository={partyRepository}
      goblins={goblinsData}
      onPartySelect={handlePartySelect}
      onExpeditionPartyClick={handleExpeditionPartyClick}
      onHistoryClick={handleHistoryClick}
      onLogClick={handleLogClick}
      isLoading={isLoading}
    />
  )
}