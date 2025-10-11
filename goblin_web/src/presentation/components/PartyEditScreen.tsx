import { useState, useEffect } from 'react'
import type { Goblin } from '../../shared/types'
import type { IPartyRepository } from '../../core/repositories'
import { GoblinCard } from './GoblinCard.tsx'

interface PartyEditScreenProps {
  partyId: number
  goblins: Goblin[]
  partyRepository: IPartyRepository
  onBack: () => void
}

export const PartyEditScreen = ({ partyId, goblins, partyRepository, onBack }: PartyEditScreenProps) => {
  const [partyMemberIds, setPartyMemberIds] = useState<number[]>([])
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [isExpedition, setIsExpedition] = useState(false)

  useEffect(() => {
    const party = partyRepository.getParty(partyId)
    if (party) {
      setPartyMemberIds(party.memberIds)
      setIsExpedition(party.status === 'expedition')
    }
  }, [partyId, partyRepository])

  const partyMembers = partyMemberIds
    .map(id => goblins.find(g => g.id === id))
    .filter((g): g is Goblin => g !== undefined)

  const handleSlotClick = (index: number) => {
    if (!isExpedition && index >= partyMembers.length) {
      setSelectedSlot(index)
    }
  }

  const handleMemberRemove = (index: number) => {
    if (isExpedition) return

    const newMemberIds = partyMemberIds.filter((_, i) => i !== index)
    setPartyMemberIds(newMemberIds)

    if (newMemberIds.length > 0) {
      const party = partyRepository.getParty(partyId)
      if (party) {
        partyRepository.saveParty({ ...party, memberIds: newMemberIds })
      }
    }
  }

  const handleGoblinSelect = (goblin: Goblin) => {
    if (isExpedition || selectedSlot === null) return

    if (selectedSlot !== null) {
      const newMemberIds = [...partyMemberIds]
      if (selectedSlot < newMemberIds.length) {
        newMemberIds[selectedSlot] = goblin.id
      } else {
        newMemberIds.push(goblin.id)
      }
      setPartyMemberIds(newMemberIds)

      if (newMemberIds.length > 0) {
        const party = partyRepository.getParty(partyId)
        if (party) {
          partyRepository.saveParty({ ...party, memberIds: newMemberIds })
        }
      }

      setSelectedSlot(null)
    }
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
            <span className="text-xs bg-orange-500 text-white px-2 py-1 rounded-full font-bold">
              🏚️ 遠征中
            </span>
          )}
        </div>
      </div>

      {isExpedition && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4 text-sm text-orange-800">
          ⚠️ 遠征中のパーティは編成できません
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
                    ? 'border-blue-500 bg-blue-50 cursor-pointer'
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
                      className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center hover:bg-red-600"
                    >
                      ×
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className={`text-2xl ${selectedSlot === i ? 'text-blue-500' : 'text-gray-300'}`}>+</div>
                  <div className={`text-[10px] ${selectedSlot === i ? 'text-blue-600' : 'text-gray-600'}`}>
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
            {selectedSlot !== null && <span className="text-blue-600 ml-2">（選択してください）</span>}
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
