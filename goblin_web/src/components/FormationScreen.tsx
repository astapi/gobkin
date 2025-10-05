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
  onLogClick?: (expeditionRecord: ExpeditionRecord) => void
  isLoading?: boolean
}

export const FormationScreen = ({
  partyRepository,
  goblins,
  onPartySelect,
  onExpeditionPartyClick,
  onHistoryClick,
  onLogClick,
  isLoading = false
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

  const formatFullDateTime = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`
  }

  const formatTime = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
  }

  const getRemainingMinutes = (returnTime: Date) => {
    const now = new Date()
    const diff = returnTime.getTime() - now.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    return Math.max(0, minutes)
  }

  const isExpeditionOngoing = (record: ExpeditionRecord) => {
    return record.returnTime > new Date()
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="pb-2 mb-4 text-lg font-bold text-gray-800 border-b-2 border-gray-200">
        パーティ選択
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-32">
          <div className="text-center">
            <div className="mb-2 text-xl">⚡</div>
            <div className="text-gray-600">パーティデータを読み込み中...</div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {parties.map(party => {
          const partyMembers = party.memberIds
            .map(id => goblins.find(g => g.id === id))
            .filter((g): g is Goblin => g !== undefined)

          const history = partyHistories[party.id] || []
          // 最新の遠征レコードのreturnTimeで遠征中かどうかを判定
          const latestExpedition = history[0]
          const isExpedition = latestExpedition ? isExpeditionOngoing(latestExpedition) : false

          return (
            <div key={party.id} className="bg-white rounded-lg border-2 border-gray-300 shadow-sm transition-all">
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
                    <span className="px-2 py-1 text-xs font-bold text-white bg-orange-500 rounded-full">
                      遠征中
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {[...Array(6)].map((_, i) => {
                    const member = partyMembers[i]
                    return (
                      <div key={i} className="flex flex-col gap-1 justify-center items-center">
                        {member ? (
                          <>
                            <div className="text-xs text-gray-600">Lv{member.level}</div>
                            <div className="overflow-hidden w-8 h-8 rounded-full">
                              <img src={member.avatar} alt={member.name} className="object-cover w-full h-full" />
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
                <div className="p-2 bg-gray-50 border-t border-gray-200">
                  <div className="mb-1 text-xs text-gray-600">遠征履歴</div>
                  <div className="space-y-1">
                    {history.map(record => {
                      const ongoing = isExpeditionOngoing(record)
                      const floorReached = record.replay?.summary.maxFloorReached || 0
                      const remainingMinutes = ongoing ? getRemainingMinutes(record.returnTime) : 0

                      return (
                        <div
                          key={record.id}
                          className={`px-2 py-1 rounded text-xs transition-colors ${
                            ongoing
                              ? 'text-orange-800 bg-orange-100 hover:bg-orange-200'
                              : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div
                              className="flex-1 cursor-pointer"
                              onClick={() => {
                                if (ongoing && onExpeditionPartyClick) {
                                  onExpeditionPartyClick(party.id)
                                } else if (record.replay && onHistoryClick) {
                                  onHistoryClick(record)
                                }
                              }}
                            >
                              <div>
                                {ongoing ? (
                                  <span className="font-mono">
                                    [{floorReached}F]: 帰還予定 {formatTime(record.returnTime)} 残り{remainingMinutes}分
                                  </span>
                                ) : (
                                  <span className="font-mono">
                                    [{floorReached}F]: {formatFullDateTime(record.startTime)}
                                  </span>
                                )}
                              </div>
                              <div className="text-gray-600 mt-0.5">
                                {record.dungeonName}
                              </div>
                            </div>
                            <div
                              className="flex-shrink-0 p-1 ml-2 rounded cursor-pointer hover:bg-gray-300"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (ongoing && onExpeditionPartyClick) {
                                  onExpeditionPartyClick(party.id)
                                } else if (record.replay && onLogClick) {
                                  onLogClick(record)
                                }
                              }}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
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