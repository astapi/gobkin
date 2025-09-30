import type { Goblin } from '../types/index.ts'
import type { PartyRepository } from '../repositories/PartyRepository.ts'

interface FormationScreenProps {
  partyRepository: PartyRepository
  goblins: Goblin[]
  onPartySelect: (partyId: number) => void
  isLoading?: boolean
  isPartyInExpedition: (partyId: number) => boolean
}

export const FormationScreen = ({ partyRepository, goblins, onPartySelect, isLoading = false, isPartyInExpedition }: FormationScreenProps) => {
  const parties = partyRepository.getParties()

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

          return (
            <div
              key={party.id}
              onClick={() => !isExpedition && onPartySelect(party.id)}
              className={`border-2 rounded-lg p-2 transition-all shadow-sm ${
                isExpedition
                  ? 'border-orange-300 bg-orange-50 cursor-not-allowed opacity-75'
                  : 'border-gray-300 bg-white cursor-pointer hover:border-gray-500 hover:bg-gray-50'
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
          )
          })}
        </div>
      )}
    </div>
  )
}