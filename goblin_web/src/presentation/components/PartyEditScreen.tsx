import { useEffect, useMemo, useState } from 'react'
import type { Goblin, Party } from '../../shared/types'
import { GoblinCard } from './GoblinCard.tsx'

interface PartyEditScreenProps {
  partyId: number
  goblins: Goblin[]
  getPartyById: (partyId: number) => Party
  updateMembers: (partyId: number, memberIds: number[]) => Party
  onBack: () => void
}

export const PartyEditScreen = ({
  partyId,
  goblins,
  getPartyById,
  updateMembers,
  onBack,
}: PartyEditScreenProps) => {
  const [partyMemberIds, setPartyMemberIds] = useState<number[]>([])
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [isExpedition, setIsExpedition] = useState(false)

  const party = useMemo(() => {
    try {
      return getPartyById(partyId)
    } catch {
      return null
    }
  }, [getPartyById, partyId])

  useEffect(() => {
    if (!party) return
    setPartyMemberIds(party.memberIds)
    setIsExpedition(party.status === 'expedition')
  }, [party])

  if (!party) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center mb-4 pb-2 border-b-2 border-gray-200">
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-800 mr-3 text-xl"
          >
            ←
          </button>
          <div className="text-lg font-bold text-gray-800">
            PT{partyId} 編成
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-600">
          パーティが見つかりません
        </div>
      </div>
    )
  }

  const partyMembers = partyMemberIds
    .map(id => goblins.find(g => g.id === id))
    .filter((g): g is Goblin => g !== undefined)

  const handleSlotClick = (index: number) => {
    if (!isExpedition && index >= partyMembers.length) {
      setSelectedSlot(index)
    }
  }

  const persistMembers = (members: number[]) => {
    const updated = updateMembers(partyId, members)
    setPartyMemberIds(updated.memberIds)
  }

  const handleMemberRemove = (index: number) => {
    if (isExpedition) return
    const newMemberIds = partyMemberIds.filter((_, i) => i !== index)
    persistMembers(newMemberIds)
  }

  const handleGoblinSelect = (goblin: Goblin) => {
    if (isExpedition || selectedSlot === null) return

    const newMemberIds = [...partyMemberIds]
    if (selectedSlot < newMemberIds.length) {
      newMemberIds[selectedSlot] = goblin.id
    } else {
      newMemberIds.push(goblin.id)
    }
    persistMembers(newMemberIds)
    setSelectedSlot(null)
  }

  const availableGoblins = goblins.filter(
    goblin => !partyMemberIds.includes(goblin.id)
  )

  return (
    <div className="h-full overflow-y-auto flex flex-col">
      <div className="flex items-center mb-4 pb-2 border-b-2 border-gray-200">
        <button
          onClick={onBack}
          className="text-gray-600 hover:text-gray-800 mr-3 text-xl"
        >
          ←
        </button>
        <div className="flex items-center gap-2">
          <div className="text-lg font-bold text-gray-800">
            PT{partyId} 編成
          </div>
          {isExpedition && (
            <span className="text-xs bg-gray-700 text-white px-2 py-1 rounded-full font-bold">
              遠征中
            </span>
          )}
        </div>
      </div>

      {isExpedition && (
        <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 mb-4 text-sm text-gray-700">
          遠征中のパーティは編成できません
        </div>
      )}

      <div className="text-sm font-bold text-gray-700 mb-2">
        パーティメンバー (最大6人)
      </div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[...Array(6)].map((_, i) => {
          const member = partyMembers[i]
          return (
            <div
              key={`slot-${i}`}
              onClick={() => handleSlotClick(i)}
              className={`aspect-square border-2 rounded-lg flex flex-col items-center justify-center transition-all relative ${
                member
                  ? 'border-gray-600 bg-gray-50'
                  : selectedSlot === i
                    ? 'border-gray-700 bg-gray-100 cursor-pointer'
                    : 'border-dashed border-gray-300 bg-white cursor-pointer hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              {member ? (
                <>
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mb-1 border border-gray-400 overflow-hidden">
                    <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="text-[10px] text-gray-600 text-center">{member.name}</div>
                  {!isExpedition && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMemberRemove(i)
                      }}
                      className="absolute top-0 right-0 w-4 h-4 bg-gray-600 text-white text-xs rounded-full flex items-center justify-center hover:bg-gray-700"
                    >
                      ×
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className={`text-2xl ${selectedSlot === i ? 'text-gray-700' : 'text-gray-300'}`}>+</div>
                  <div className={`text-[10px] ${selectedSlot === i ? 'text-gray-700' : 'text-gray-600'}`}>
                    {selectedSlot === i ? '選択中' : '空き'}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {!isExpedition && (
        <>
          <div className="text-sm font-bold text-gray-700 mb-2 pb-2 border-b-2 border-gray-200">
            利用可能なゴブリン
            {selectedSlot !== null && <span className="text-gray-600 ml-2">（選択してください）</span>}
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-3">
              {availableGoblins.map(goblin => (
                <div
                  key={goblin.id}
                  onClick={() => handleGoblinSelect(goblin)}
                  className={selectedSlot !== null ? 'cursor-pointer' : ''}
                >
                  <GoblinCard goblin={goblin} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
