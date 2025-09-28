import { useState, useEffect } from 'react'
import type { Goblin } from '../types/index.ts'
import type { PartyRepository } from '../repositories/PartyRepository.ts'
import { GoblinCard } from './GoblinCard.tsx'

interface PartyEditScreenProps {
  partyId: number
  goblins: Goblin[]
  partyRepository: PartyRepository
  onBack: () => void
}

export const PartyEditScreen = ({ partyId, goblins, partyRepository, onBack }: PartyEditScreenProps) => {
  const [partyMemberIds, setPartyMemberIds] = useState<number[]>([])
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)

  useEffect(() => {
    const party = partyRepository.getParty(partyId)
    if (party) {
      setPartyMemberIds(party.memberIds)
    }
  }, [partyId, partyRepository])

  const partyMembers = partyMemberIds
    .map(id => goblins.find(g => g.id === id))
    .filter((g): g is Goblin => g !== undefined)

  const handleSlotClick = (index: number) => {
    if (index >= partyMembers.length) {
      setSelectedSlot(index)
    }
  }

  const handleGoblinSelect = (goblin: Goblin) => {
    if (selectedSlot !== null) {
      const newMemberIds = [...partyMemberIds]
      if (selectedSlot < newMemberIds.length) {
        newMemberIds[selectedSlot] = goblin.id
      } else {
        newMemberIds.push(goblin.id)
      }
      setPartyMemberIds(newMemberIds)

      const party = partyRepository.getParty(partyId)
      if (party) {
        partyRepository.saveParty({ ...party, memberIds: newMemberIds })
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
        <div className="text-lg font-bold text-gray-800">
          PT{partyId} 編成
        </div>
      </div>

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
              className={`aspect-square border-2 rounded-lg flex flex-col items-center justify-center transition-all ${
                member
                  ? 'border-gray-600 bg-gray-50'
                  : selectedSlot === i
                    ? 'border-blue-500 bg-blue-50 cursor-pointer'
                    : 'border-dashed border-gray-300 bg-white cursor-pointer hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              {member ? (
                <>
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-base mb-1 border border-gray-400">
                    {member.avatar}
                  </div>
                  <div className="text-[10px] text-gray-600 text-center">{member.name}</div>
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
    </div>
  )
}