import { useState } from 'react'
import type { Party, Goblin, Dungeon, ExpeditionRequest } from '../../shared/types'

interface ExpeditionSetupScreenProps {
  parties: Party[]
  goblins: Goblin[]
  dungeon: Dungeon
  onStartExpedition: (request: ExpeditionRequest) => void
  onBack: () => void
  estimateExplorationTime?: (dungeon: Dungeon, returnPolicy: ExpeditionRequest['returnPolicy']) => number
}

export const ExpeditionSetupScreen = ({
  parties,
  goblins,
  dungeon,
  onStartExpedition,
  onBack,
  estimateExplorationTime
}: ExpeditionSetupScreenProps) => {
  const [selectedPartyId, setSelectedPartyId] = useState<number | null>(null)
  const [returnPolicy, setReturnPolicy] = useState<ExpeditionRequest["returnPolicy"]>("never")

  const validParties = parties.filter(party =>
    party.memberIds.length > 0 && party.status !== 'expedition'
  )
  const selectedParty = selectedPartyId ? parties.find(p => p.id === selectedPartyId) : null

  const handleStart = () => {
    if (selectedPartyId) {
      const request: ExpeditionRequest = {
        partyId: selectedPartyId.toString(),
        areaId: dungeon.id.toString(),
        returnPolicy,
        clientVersion: "1.0.0"
      }
      onStartExpedition(request)
    }
  }

  const getReturnPolicyDescription = (policy: ExpeditionRequest["returnPolicy"]): string => {
    switch (policy) {
      case "never":
        return "最後まで探索する（最も危険だが報酬が多い）"
      case "until_floor2":
        return "2階まで探索したら帰還（安全な選択）"
      case "until_floor3":
        return "3階まで探索したら帰還（バランス型）"
      case "if_any_ko":
        return "誰か1人でも戦闘不能になったら帰還（保守的）"
      case "last_one":
        return "最後の1人になったら帰還（リスク承知）"
      default:
        return ""
    }
  }

  const getEstimatedTime = (): string => {
    const defaultEstimate = (() => {
      const baseTime = dungeon.exploration_time_sec_first || dungeon.exploration_time_sec
      const multiplierMap: Record<ExpeditionRequest['returnPolicy'], number> = {
        never: 1.0,
        until_floor2: 0.4,
        until_floor3: 0.6,
        if_any_ko: 0.7,
        if_two_ko: 0.75,
        last_one: 0.9
      }
      const multiplier = multiplierMap[returnPolicy] ?? 1.0
      return Math.floor(baseTime * multiplier)
    })()

    const estimatedTime = estimateExplorationTime
      ? estimateExplorationTime(dungeon, returnPolicy)
      : defaultEstimate
    return estimatedTime < 60 ? `${estimatedTime}秒` : `${Math.floor(estimatedTime / 60)}分${estimatedTime % 60}秒`
  }

  const getSelectedPartyMembers = () => {
    if (!selectedParty) return []
    return selectedParty.memberIds
      .map(id => goblins.find(g => g.id === id))
      .filter((g): g is Goblin => g !== undefined)
  }

  const calculatePartyPower = () => {
    const members = getSelectedPartyMembers()
    return members.reduce((total, member) => total + member.stats.atk + member.stats.def, 0)
  }

  const getDifficultyColor = () => {
    if (!selectedParty) return "text-gray-500"

    const partyPower = calculatePartyPower()
    const dungeonDifficulty = dungeon.floors * 50 // 仮の難易度計算

    if (partyPower >= dungeonDifficulty * 1.2) return "text-green-600"
    if (partyPower >= dungeonDifficulty * 0.8) return "text-yellow-600"
    return "text-red-600"
  }

  return (
    <div className="h-full overflow-y-auto flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-center mb-4 pb-2 border-b-2 border-gray-200">
        <button
          onClick={onBack}
          className="text-gray-600 hover:text-gray-800 mr-3 text-xl"
        >
          ←
        </button>
        <div className="text-lg font-bold text-gray-800">
          遠征設定
        </div>
      </div>

      {/* ダンジョン情報 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4 border-2 border-gray-200">
        <div className="text-sm text-gray-600 mb-2">探索先</div>
        <div className="font-bold text-gray-800 mb-1">
          {dungeon.icon || '🏰'} {dungeon.name}
        </div>
        <div className="text-xs text-gray-600 mb-2">{dungeon.description}</div>
        <div className="flex justify-between text-xs text-gray-600">
          <span>🏰 階層数: {dungeon.floors}階</span>
          <span className={getDifficultyColor()}>
            {selectedParty ? '⚔️ 推奨戦力チェック' : '❓ パーティを選択してください'}
          </span>
        </div>
      </div>

      {/* パーティ選択 */}
      <div className="mb-4">
        <div className="text-sm font-bold text-gray-700 mb-3">
          1. パーティを選択
        </div>
        {validParties.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-600">
            <div className="text-xl mb-2">📝</div>
            <div className="text-sm">利用可能なパーティがありません</div>
            <div className="text-xs mt-1">編成済みで遠征中でないパーティが必要です</div>
          </div>
        ) : (
        <div className="grid gap-2">
          {validParties.map(party => {
            const members = party.memberIds
              .map(id => goblins.find(g => g.id === id))
              .filter((g): g is Goblin => g !== undefined)

            const isSelected = selectedPartyId === party.id

            return (
              <button
                key={party.id}
                onClick={() => setSelectedPartyId(party.id)}
                className={`border-2 rounded-lg p-3 text-left transition-colors ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 bg-white hover:border-gray-400'
                }`}
              >
                <div className="font-bold text-gray-800 mb-2">{party.name}</div>
                <div className="flex gap-1 flex-wrap">
                  {members.map(member => (
                    <div key={member.id} className="flex items-center gap-1 text-xs bg-gray-100 rounded px-2 py-1">
                      <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center border overflow-hidden">
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
        )}
      </div>

      {/* 帰還条件設定 */}
      {selectedPartyId && (
        <div className="mb-4">
          <div className="text-sm font-bold text-gray-700 mb-3">
            2. 帰還条件を選択
          </div>
          <div className="space-y-2">
            {([
              "never",
              "until_floor2",
              "until_floor3",
              "if_any_ko",
              "last_one"
            ] as const).map(policy => (
              <label key={policy} className="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="returnPolicy"
                  value={policy}
                  checked={returnPolicy === policy}
                  onChange={(e) => setReturnPolicy(e.target.value as ExpeditionRequest["returnPolicy"])}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-800 mb-1">
                    {policy === "never" && "🏆 最後まで探索"}
                    {policy === "until_floor2" && "🛡️ 2階で帰還"}
                    {policy === "until_floor3" && "⚖️ 3階で帰還"}
                    {policy === "if_any_ko" && "💚 誰か倒れたら帰還"}
                    {policy === "last_one" && "⚠️ 最後の1人になったら帰還"}
                  </div>
                  <div className="text-xs text-gray-600">
                    {getReturnPolicyDescription(policy)}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 推定情報 */}
      {selectedPartyId && (
        <div className="bg-blue-50 rounded-lg p-4 mb-4 border-2 border-blue-200">
          <div className="text-sm font-bold text-blue-800 mb-2">📊 探索予測</div>
          <div className="text-xs text-blue-700 space-y-1">
            <div>⏱️ 予想探索時間: {getEstimatedTime()}</div>
            <div>💪 パーティ戦力: {calculatePartyPower()}</div>
            <div>🎯 選択した戦略: {getReturnPolicyDescription(returnPolicy)}</div>
          </div>
        </div>
      )}

      {/* 開始ボタン */}
      <div className="mt-auto pt-4">
        <button
          onClick={handleStart}
          disabled={!selectedPartyId}
          className={`w-full py-3 rounded-lg font-bold transition-colors ${
            selectedPartyId
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          🚀 遠征開始
        </button>
      </div>
    </div>
  )
}
