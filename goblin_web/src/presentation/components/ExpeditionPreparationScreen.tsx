import { useMemo, useState } from 'react'
import type { Dungeon, ExpeditionRequest, Goblin, Party } from '../../shared/types'
import { DungeonSelectionModal } from './DungeonSelectionModal.tsx'
import { FloorTargetSelectionModal } from './FloorTargetSelectionModal.tsx'
import { ReturnPolicySelectionModal } from './ReturnPolicySelectionModal.tsx'
import { ExpeditionConfirmModal } from './ExpeditionConfirmModal.tsx'

interface ExpeditionPreparationScreenProps {
  partyId: number
  getPartyById: (partyId: number) => Party
  goblins: Goblin[]
  dungeons: Dungeon[]
  onSetDungeon: (partyId: number, dungeonId: string) => void
  onSetTargetFloor: (partyId: number, floor: number | null) => void
  onSetReturnPolicy: (partyId: number, policy: ExpeditionRequest['returnPolicy']) => void
  onBack: () => void
  onEditParty: () => void
  onStartExpedition: (request: ExpeditionRequest) => void
  estimateExplorationTime?: (
    dungeon: Dungeon,
    returnPolicy: ExpeditionRequest['returnPolicy']
  ) => number
}

export const ExpeditionPreparationScreen = ({
  partyId,
  getPartyById,
  goblins,
  dungeons,
  onSetDungeon,
  onSetTargetFloor,
  onSetReturnPolicy,
  onBack,
  onEditParty,
  onStartExpedition,
  estimateExplorationTime,
}: ExpeditionPreparationScreenProps) => {
  const [showDungeonModal, setShowDungeonModal] = useState(false)
  const [showFloorModal, setShowFloorModal] = useState(false)
  const [showReturnPolicyModal, setShowReturnPolicyModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const party = useMemo(() => {
    try {
      return getPartyById(partyId)
    } catch {
      return null
    }
  }, [getPartyById, partyId])

  const selectedDungeon = useMemo(() => {
    if (!party?.dungeonId) return null
    return dungeons.find(d => d.id.toString() === party.dungeonId) ?? null
  }, [party, dungeons])

  const handleDungeonSelect = (dungeon: Dungeon) => {
    onSetDungeon(partyId, dungeon.id.toString())
    setShowDungeonModal(false)
  }

  const handleFloorTargetSelect = (floor: number | null) => {
    onSetTargetFloor(partyId, floor)
    setShowFloorModal(false)
  }

  const handleReturnPolicySelect = (policy: ExpeditionRequest['returnPolicy']) => {
    onSetReturnPolicy(partyId, policy)
    setShowReturnPolicyModal(false)
  }

  const getReturnPolicyLabel = (policy?: ExpeditionRequest['returnPolicy']): string => {
    switch (policy) {
      case 'if_any_ko':
        return '1人でも死亡したら帰還'
      case 'if_two_ko':
        return '2人が死亡したら帰還'
      case 'last_one':
        return '最後の1人になったら帰還'
      case 'never':
        return '帰還しない'
      default:
        return '帰還しない'
    }
  }

  const handleStartButtonClick = () => {
    if (!party?.dungeonId) return
    setShowConfirmModal(true)
  }

  const handleConfirmExpedition = () => {
    if (!party?.dungeonId) return

    const request: ExpeditionRequest = {
      partyId: partyId.toString(),
      areaId: party.dungeonId.toString(),
      returnPolicy: party.returnPolicy || 'never',
      clientVersion: '1.0.0',
    }

    setShowConfirmModal(false)
    onStartExpedition(request)
  }

  if (!party) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center px-4 py-2 bg-gray-100 border-b border-gray-300">
          <button
            onClick={onBack}
            className="text-gray-600 transition-colors hover:text-gray-800"
          >
            ← 戻る
          </button>
        </div>
        <div className="flex flex-1 justify-center items-center">
          <div className="text-gray-600">パーティが見つかりません</div>
        </div>
      </div>
    )
  }

  const partyMembers = party.memberIds
    .map(id => goblins.find(g => g.id === id))
    .filter((g): g is Goblin => g !== undefined)

  const estimatedTimeLabel = selectedDungeon
    ? (() => {
        const seconds = estimateExplorationTime
          ? estimateExplorationTime(selectedDungeon, party.returnPolicy || 'never')
          : (() => {
              const baseTime =
                selectedDungeon.exploration_time_sec_first || selectedDungeon.exploration_time_sec
              const multiplierMap: Record<ExpeditionRequest['returnPolicy'], number> = {
                never: 1,
                until_floor2: 0.4,
                until_floor3: 0.6,
                if_any_ko: 0.7,
                if_two_ko: 0.75,
                last_one: 0.9,
              }
              const multiplier = multiplierMap[party.returnPolicy || 'never'] ?? 1
              return Math.floor(baseTime * multiplier)
            })()

        if (seconds < 60) {
          return `${seconds}秒`
        }
        const minutes = Math.floor(seconds / 60)
        const remainSeconds = seconds % 60
        return `${minutes}分${remainSeconds}秒`
      })()
    : null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-2 border-b border-gray-300">
        <button
          onClick={onBack}
          className="text-gray-600 transition-colors hover:text-gray-800"
        >
          ← 戻る
        </button>
        <span className="text-sm font-medium text-gray-700">
          冒険準備
        </span>
        <button
          onClick={handleStartButtonClick}
          disabled={!selectedDungeon}
          className={`px-4 py-1 text-sm font-medium rounded transition-colors ${
            selectedDungeon
              ? 'text-white bg-blue-600 hover:bg-blue-700'
              : 'text-gray-500 bg-gray-300 cursor-not-allowed'
          }`}
        >
          出撃
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1 py-4">
        <div className="space-y-6">
          {/* パーティ表示 */}
          <div>
            <div className="pb-2 mb-3 text-base font-bold text-gray-800 border-b-2 border-gray-200">
              パーティ
            </div>
            <div className="p-3 bg-white rounded-lg border-2 border-gray-300 shadow-sm">
              <div className="mb-3 text-lg font-bold text-gray-800">{party.name}</div>
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
                className="py-2 w-full text-sm text-blue-600 bg-blue-50 rounded transition-colors hover:bg-blue-100"
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
            <div className="p-3 space-y-3 bg-white rounded-lg border-2 border-gray-300 shadow-sm">
              {/* 遠征先 */}
              <div>
                <div className="mb-2 text-sm font-semibold text-gray-700">遠征先</div>
                <button
                  onClick={() => setShowDungeonModal(true)}
                  className="px-3 py-2 w-full text-sm text-left bg-gray-100 rounded transition-colors hover:bg-gray-200"
                >
                  {selectedDungeon ? (
                    <div>
                      <div className="font-semibold text-gray-800">{selectedDungeon.name}</div>
                      <div className="mt-1 text-xs text-gray-600">{selectedDungeon.description}</div>
                    </div>
                  ) : (
                    <div className="text-gray-600">遠征先が未設定です</div>
                  )}
                </button>
              </div>

              {/* 目標階数 */}
              <div>
                <div className="mb-2 text-sm font-semibold text-gray-700">目標階数</div>
                <button
                  onClick={() => setShowFloorModal(true)}
                  disabled={!selectedDungeon}
                  className={`px-3 py-2 w-full text-sm text-left rounded transition-colors ${
                    selectedDungeon
                      ? 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {party.targetFloor
                    ? `${party.targetFloor}階まで探索`
                    : '最下層まで探索'}
                </button>
              </div>

              {/* 帰還条件 */}
              <div>
                <div className="mb-2 text-sm font-semibold text-gray-700">帰還条件</div>
                <button
                  onClick={() => setShowReturnPolicyModal(true)}
                  className="px-3 py-2 w-full text-sm text-left bg-gray-100 rounded transition-colors hover:bg-gray-200"
                >
                  {getReturnPolicyLabel(party.returnPolicy)}
                </button>
              </div>

              {/* 推定探索時間 */}
              {estimatedTimeLabel && (
                <div>
                  <div className="mb-2 text-sm font-semibold text-gray-700">推定探索時間</div>
                  <div className="px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded">
                    {estimatedTimeLabel}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showConfirmModal && selectedDungeon && (
        <ExpeditionConfirmModal
          onClose={() => setShowConfirmModal(false)}
          dungeon={selectedDungeon}
          partyName={party.name}
          members={partyMembers}
          targetFloor={party.targetFloor ?? null}
          returnPolicyLabel={getReturnPolicyLabel(party.returnPolicy)}
          onConfirm={handleConfirmExpedition}
        />
      )}

      {showDungeonModal && (
        <DungeonSelectionModal
          onClose={() => setShowDungeonModal(false)}
          dungeons={dungeons}
          onSelect={handleDungeonSelect}
        />
      )}

      {showFloorModal && selectedDungeon && (
        <FloorTargetSelectionModal
          onClose={() => setShowFloorModal(false)}
          maxFloor={selectedDungeon.floors}
          onSelect={handleFloorTargetSelect}
        />
      )}

      {showReturnPolicyModal && (
        <ReturnPolicySelectionModal
          onClose={() => setShowReturnPolicyModal(false)}
          onSelect={handleReturnPolicySelect}
        />
      )}
    </div>
  )
}
