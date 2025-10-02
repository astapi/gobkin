import { useState, useEffect } from 'react'
import type { Goblin, ExpeditionRecord } from '../types/index.ts'
import type { PartyRepository } from '../repositories/PartyRepository.ts'
import { useExpeditionState } from '../contexts/ExpeditionStateContext.tsx'

interface FormationScreenProps {
  partyRepository: PartyRepository
  goblins: Goblin[]
  onPartySelect: (partyId: number) => void
  onExpeditionPartyClick?: (partyId: number) => void
  onHistoryClick?: (expeditionRecord: ExpeditionRecord) => void
  isLoading?: boolean
  isPartyInExpedition: (partyId: number) => boolean
}

export const FormationScreen = ({
  partyRepository,
  goblins,
  onPartySelect,
  onExpeditionPartyClick,
  onHistoryClick,
  isLoading = false,
  isPartyInExpedition
}: FormationScreenProps) => {
  const parties = partyRepository.getParties()
  const { getPartyExpeditionHistory } = useExpeditionState()
  const [partyHistories, setPartyHistories] = useState<Record<number, ExpeditionRecord[]>>({})

  // 各パーティの履歴を取得
  useEffect(() => {
    const loadHistories = async () => {
      const histories: Record<number, ExpeditionRecord[]> = {}
      for (const party of parties) {
        const history = await getPartyExpeditionHistory(party.id)
        if (history.length > 0) {
          histories[party.id] = history
        }
      }
      setPartyHistories(histories)
    }
    loadHistories()
  }, [parties.length]) // parties.lengthを依存配列に使用

  const formatDate = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}日前`
    if (hours > 0) return `${hours}時間前`
    const minutes = Math.floor(diff / (1000 * 60))
    return minutes > 0 ? `${minutes}分前` : '今'
  }

  const isExpeditionOngoing = (record: ExpeditionRecord) => {
    return record.returnTime > new Date()
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">
        パーティ選択
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <div className="text-xl mb-2">⚡</div>
            <div className="text-gray-600">パーティデータを読み込み中...</div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {parties.map(party => {
          const partyMembers = party.memberIds
            .map(id => goblins.find(g => g.id === id))
            .filter((g): g is Goblin => g !== undefined)

          const isExpedition = party.status === 'expedition' || isPartyInExpedition(party.id)
          const history = partyHistories[party.id] || []

          return (
            <div key={party.id} className="border-2 rounded-lg transition-all shadow-sm border-gray-300 bg-white">
              {/* パーティ本体 */}
              <div
                onClick={() => {
                  if (isExpedition && onExpeditionPartyClick) {
                    onExpeditionPartyClick(party.id)
                  } else if (!isExpedition) {
                    onPartySelect(party.id)
                  }
                }}
                className={`p-2 cursor-pointer transition-colors ${
                  isExpedition
                    ? 'bg-orange-50 hover:bg-orange-100'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="text-lg font-bold text-gray-800">{party.name}</div>
                  {isExpedition && (
                    <span className="text-xs bg-orange-500 text-white px-2 py-1 rounded-full font-bold">
                      🏚️ 遠征中
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {[...Array(6)].map((_, i) => {
                    const member = partyMembers[i]
                    return (
                      <div key={i} className="flex flex-col items-center justify-center gap-1">
                        {member ? (
                          <>
                            <div className="text-xs text-gray-600">Lv{member.level}</div>
                            <div className="w-8 h-8 rounded-full overflow-hidden">
                              <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="text-xs text-gray-600">HP{member.stats.hp}</div>
                          </>
                        ) : (
                          <div className="text-xl text-gray-300">+</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 遠征履歴 */}
              {history.length > 0 && (
                <div className="border-t border-gray-200 bg-gray-50 p-2">
                  <div className="text-xs text-gray-600 mb-1">遠征履歴</div>
                  <div className="space-y-1">
                    {history.map(record => {
                      const ongoing = isExpeditionOngoing(record)
                      return (
                        <div
                          key={record.id}
                          onClick={() => {
                            if (ongoing && onExpeditionPartyClick) {
                              onExpeditionPartyClick(party.id)
                            } else if (record.replay && onHistoryClick) {
                              onHistoryClick(record)
                            }
                          }}
                          className={`flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                            ongoing
                              ? 'bg-orange-100 hover:bg-orange-200 text-orange-800'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span>{ongoing ? '🏃 進行中' : '📜'}</span>
                            <span className="font-medium">{record.dungeonName}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-500">
                            {ongoing ? (
                              <span className="text-orange-600 font-medium">
                                帰還: {new Date(record.returnTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ) : (
                              <>
                                {record.replay && (
                                  <span className="text-blue-600">▶️</span>
                                )}
                                <span>{formatDate(record.startTime)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
          })}
        </div>
      )}
    </div>
  )
}