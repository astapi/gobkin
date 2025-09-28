import type { Goblin } from '../types/index.ts'
import type { PartyRepository } from '../repositories/PartyRepository.ts'

interface FormationScreenProps {
  partyRepository: PartyRepository
  goblins: Goblin[]
  onPartySelect: (partyId: number) => void
}

export const FormationScreen = ({ partyRepository, goblins, onPartySelect }: FormationScreenProps) => {
  const parties = partyRepository.getParties()

  return (
    <div className="h-full overflow-y-auto">
      <div className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">
        パーティ選択
      </div>

      <div className="flex flex-col gap-4">
        {parties.map(party => {
          const partyMembers = party.memberIds
            .map(id => goblins.find(g => g.id === id))
            .filter((g): g is Goblin => g !== undefined)

          return (
            <div
              key={party.id}
              onClick={() => onPartySelect(party.id)}
              className="border-2 border-gray-300 rounded-lg p-2 bg-white cursor-pointer transition-all hover:border-gray-500 hover:bg-gray-50 shadow-sm"
            >
              <div className="text-lg font-bold text-gray-800 mb-3">{party.name}</div>
              <div className="grid grid-cols-6 gap-2">
                {[...Array(6)].map((_, i) => {
                  const member = partyMembers[i]
                  return (
                    <div key={i} className="flex flex-col items-center justify-center gap-1">
                      {member ? (
                        <>
                          <div className="text-xs text-gray-600">Lv{member.level}</div>
                          <div className="text-2xl">
                            {member.avatar}
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
          )
        })}
      </div>
    </div>
  )
}