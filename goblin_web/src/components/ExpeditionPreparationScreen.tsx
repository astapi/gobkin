import { useState } from 'react'
import type { Goblin, Dungeon, ExpeditionRequest } from '../types/index.ts'
import type { PartyRepository } from '../repositories/PartyRepository.ts'
import { DungeonSelectionModal } from './DungeonSelectionModal.tsx'
import { FloorTargetSelectionModal } from './FloorTargetSelectionModal.tsx'
import { ReturnPolicySelectionModal } from './ReturnPolicySelectionModal.tsx'

interface ExpeditionPreparationScreenProps {
  partyId: number
  partyRepository: PartyRepository
  goblins: Goblin[]
  dungeons: Dungeon[]
  onBack: () => void
  onEditParty: () => void
}

export const ExpeditionPreparationScreen = ({
  partyId,
  partyRepository,
  goblins,
  dungeons,
  onBack,
  onEditParty
}: ExpeditionPreparationScreenProps) => {
  const [showDungeonModal, setShowDungeonModal] = useState(false)
  const [showFloorModal, setShowFloorModal] = useState(false)
  const [showReturnPolicyModal, setShowReturnPolicyModal] = useState(false)
  const party = partyRepository.getParty(partyId)
  const selectedDungeon = party?.dungeonId ? dungeons.find(d => d.id === party.dungeonId) : null

  const handleDungeonSelect = (dungeon: Dungeon) => {
    partyRepository.updateDungeonSettings(partyId, dungeon.id)
    setShowDungeonModal(false)
  }

  const handleFloorTargetSelect = (floor: number | null) => {
    partyRepository.updateFloorTarget(partyId, floor)
    setShowFloorModal(false)
  }

  const handleReturnPolicySelect = (policy: ExpeditionRequest["returnPolicy"]) => {
    partyRepository.updateReturnPolicy(partyId, policy)
    setShowReturnPolicyModal(false)
  }

  const getReturnPolicyLabel = (policy?: ExpeditionRequest["returnPolicy"]): string => {
    switch (policy) {
      case "if_any_ko":
        return "1人でも死亡したら帰還"
      case "if_two_ko":
        return "2人が死亡したら帰還"
      case "last_one":
        return "最後の1人になったら帰還"
      case "never":
        return "帰還しない"
      default:
        return "帰還しない"
    }
  }

  if (!party) {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-gray-100 px-4 py-2 border-b border-gray-300 flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-800 transition-colors"
          >
            ← 戻る
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-600">パーティが見つかりません</div>
        </div>
      </div>
    )
  }

  const partyMembers = party.memberIds
    .map(id => goblins.find(g => g.id === id))
    .filter((g): g is Goblin => g !== undefined)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-gray-100 px-4 py-2 border-b border-gray-300 flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-gray-600 hover:text-gray-800 transition-colors"
        >
          ← 戻る
        </button>
        <span className="text-sm font-medium text-gray-700">
          冒険準備
        </span>
        <div className="w-12"></div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          {/* パーティ表示 */}
          <div>
            <div className="pb-2 mb-3 text-base font-bold text-gray-800 border-b-2 border-gray-200">
              パーティ
            </div>
            <div className="bg-white rounded-lg border-2 border-gray-300 shadow-sm p-3">
              <div className="text-lg font-bold text-gray-800 mb-3">{party.name}</div>
              <div className="grid grid-cols-6 gap-2 mb-3">
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
              <button
                onClick={onEditParty}
                className="w-full py-2 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
              >
                メンバーを変更する
              </button>
            </div>
          </div>

          {/* 遠征設定 */}
          <div>
            <div className="pb-2 mb-3 text-base font-bold text-gray-800 border-b-2 border-gray-200">
              遠征
            </div>
            <div className="bg-white rounded-lg border-2 border-gray-300 shadow-sm p-3 space-y-3">
              {/* 遠征先 */}
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-2">遠征先</div>
                <button
                  onClick={() => setShowDungeonModal(true)}
                  className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm transition-colors text-left"
                >
                  {selectedDungeon ? (
                    <div>
                      <div className="font-semibold text-gray-800">{selectedDungeon.name}</div>
                      <div className="text-xs text-gray-600 mt-1">{selectedDungeon.description}</div>
                    </div>
                  ) : (
                    <div className="text-gray-600">遠征先が未設定です</div>
                  )}
                </button>
              </div>

              {/* 目標階数 */}
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-2">目標階数</div>
                <button
                  onClick={() => setShowFloorModal(true)}
                  disabled={!selectedDungeon}
                  className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {!selectedDungeon ? (
                    <div className="text-gray-600">遠征先を選択してください</div>
                  ) : party.targetFloor ? (
                    <div className="text-gray-800">{party.targetFloor}階まで</div>
                  ) : (
                    <div className="text-gray-800">どこまでも進む</div>
                  )}
                </button>
              </div>

              {/* 帰還条件 */}
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-2">帰還条件</div>
                <button
                  onClick={() => setShowReturnPolicyModal(true)}
                  className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm transition-colors text-left"
                >
                  <div className="text-gray-800">
                    {getReturnPolicyLabel(party.returnPolicy)}
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ダンジョン選択モーダル */}
      {showDungeonModal && (
        <DungeonSelectionModal
          dungeons={dungeons}
          onSelect={handleDungeonSelect}
          onClose={() => setShowDungeonModal(false)}
        />
      )}

      {/* 目標階数選択モーダル */}
      {showFloorModal && selectedDungeon && (
        <FloorTargetSelectionModal
          maxFloor={selectedDungeon.floors}
          onSelect={handleFloorTargetSelect}
          onClose={() => setShowFloorModal(false)}
        />
      )}

      {/* 帰還条件選択モーダル */}
      {showReturnPolicyModal && (
        <ReturnPolicySelectionModal
          onSelect={handleReturnPolicySelect}
          onClose={() => setShowReturnPolicyModal(false)}
        />
      )}
    </div>
  )
}
