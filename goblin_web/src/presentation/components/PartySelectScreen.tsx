import type { Party, Goblin, Dungeon } from '../../shared/types'

interface PartySelectScreenProps {
  parties: Party[]
  goblins: Goblin[]
  dungeon: Dungeon
  onSelectParty: (partyId: number) => void
  onBack: () => void
}

export const PartySelectScreen = ({ parties, goblins, dungeon, onSelectParty, onBack }: PartySelectScreenProps) => {
  const validParties = parties.filter(party => party.memberIds.length > 0)

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
          パーティ選択
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-4 border-2 border-gray-200">
        <div className="text-sm text-gray-600 mb-2">探索先</div>
        <div className="font-bold text-gray-800">
          {dungeon.icon || '🏰'} {dungeon.name}
        </div>
        <div className="text-xs text-gray-600 mt-1">難易度: {dungeon.difficulty || '不明'}</div>
      </div>

      <div className="text-sm font-bold text-gray-700 mb-3">
        探索するパーティを選択してください
      </div>

      <div className="flex flex-col gap-3">
        {validParties.map(party => {
          const members = party.memberIds
            .map(id => goblins.find(g => g.id === id))
            .filter((g): g is Goblin => g !== undefined)

          return (
            <button
              key={party.id}
              onClick={() => onSelectParty(party.id)}
              className="bg-white border-2 border-gray-300 rounded-lg p-4 hover:border-gray-600 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="font-bold text-gray-800 mb-3">{party.name}</div>
              <div className="flex gap-2 flex-wrap">
                {members.map(member => (
                  <div key={member.id} className="flex items-center gap-1 text-xs bg-gray-50 rounded px-2 py-1 border border-gray-300">
                    <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center border border-gray-400 overflow-hidden">
                      <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-gray-600">{member.name}</span>
                  </div>
                ))}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}