import { useState } from 'react'
import type { ExpeditionRecord } from '../types/index.ts'
import { PartyEditScreen } from './PartyEditScreen.tsx'
import { FormationScreen } from './FormationScreen.tsx'
import { ExpeditionPlaybackScreen } from './ExpeditionPlaybackScreen.tsx'
import { usePartyRepository } from '../hooks/usePartyRepository.ts'
import { useExpeditionState } from '../contexts/ExpeditionStateContext.tsx'
import { goblinsData, dungeonsData } from '../data/index.ts'

export const FormationTabScreen = () => {
  const { partyRepository, isLoading } = usePartyRepository()
  const { isPartyInExpedition, getExpeditionByPartyId } = useExpeditionState()
  const [editingPartyId, setEditingPartyId] = useState<number | null>(null)
  const [selectedHistoryReplay, setSelectedHistoryReplay] = useState<ExpeditionRecord | null>(null)

  const handlePartySelect = (partyId: number) => {
    setEditingPartyId(partyId)
  }

  const handleBackToFormation = () => {
    setEditingPartyId(null)
  }

  const handleExpeditionPartyClick = async (partyId: number) => {
    try {
      const expeditionRecord = await getExpeditionByPartyId(partyId)

      if (expeditionRecord && expeditionRecord.replay) {
        // リプレイデータがある場合はFormationタブ内で再生
        setSelectedHistoryReplay(expeditionRecord)
      } else {
        // リプレイデータがない場合は情報を表示
        alert(`${expeditionRecord?.partyName || 'PT'}は現在遠征中です。\n帰還予定時刻: ${expeditionRecord?.returnTime.toLocaleString() || '不明'}`)
      }
    } catch (error) {
      console.error('遠征データ取得エラー:', error)
      alert('遠征データの取得に失敗しました')
    }
  }

  const handleHistoryClick = (expeditionRecord: ExpeditionRecord) => {
    if (expeditionRecord.replay) {
      // 履歴のリプレイをFormationタブ内で再生
      setSelectedHistoryReplay(expeditionRecord)
    }
  }

  const handleReplayComplete = () => {
    setSelectedHistoryReplay(null)
  }

  // リプレイ表示中
  if (selectedHistoryReplay?.replay) {
    const dungeon = dungeonsData.find(d => d.id === selectedHistoryReplay.dungeonId)
    return (
      <div className="h-full flex flex-col">
        <div className="bg-gray-100 px-4 py-2 border-b border-gray-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleReplayComplete}
              className="text-gray-600 hover:text-gray-800 transition-colors"
            >
              ← 戻る
            </button>
            <span className="text-sm font-medium text-gray-700">
              {dungeon?.name || '遠征'} - リプレイ再生
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <ExpeditionPlaybackScreen
            expeditionReplay={selectedHistoryReplay.replay}
            goblins={goblinsData}
            onComplete={handleReplayComplete}
          />
        </div>
      </div>
    )
  }

  // パーティ編集画面
  if (editingPartyId !== null) {
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
      isLoading={isLoading}
      isPartyInExpedition={isPartyInExpedition}
    />
  )
}