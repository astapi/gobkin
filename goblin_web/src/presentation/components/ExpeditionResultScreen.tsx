import type { ExpeditionReplay, Goblin } from '../../shared/types'
import { areasData } from '../../shared/data'

interface ExpeditionResultScreenProps {
  expeditionReplay: ExpeditionReplay
  goblins: Goblin[]
  dungeonName: string
  onBackToMenu: () => void
}

export const ExpeditionResultScreen = ({
  expeditionReplay,
  goblins,
  dungeonName,
  onBackToMenu
}: ExpeditionResultScreenProps) => {
  const { summary, meta } = expeditionReplay
  const isSuccess = summary.success
  const area = areasData.find(a => a.id === meta.areaId)

  const getPartyMember = (memberId: string) => {
    return goblins.find(g => g.id === parseInt(memberId))
  }

  const isInjured = (memberId: string) => summary.injuries.includes(memberId)
  const isDead = (memberId: string) => summary.casualties.includes(memberId)

  const getResultText = () => {
    if (summary.casualties.length === meta.party.length) {
      return '全滅しました。'
    }
    if (isSuccess && summary.maxFloorReached === area?.floors) {
      return 'ダンジョンを踏破しました。'
    }
    if (isSuccess) {
      return '目標階層を突破しました。'
    }
    return '帰還しました。'
  }

  const getPartyMemberHp = (memberId: string) => {
    const goblin = getPartyMember(memberId)
    if (!goblin) return { current: 0, max: 0 }

    if (isDead(memberId)) {
      return { current: 0, max: goblin.stats.hp }
    }

    // 負傷している場合はHPを減らす（仮の実装）
    if (isInjured(memberId)) {
      return { current: Math.floor(goblin.stats.hp * 0.5), max: goblin.stats.hp }
    }

    return { current: goblin.stats.hp, max: goblin.stats.hp }
  }

  return (
    <div className="flex overflow-y-auto flex-col h-full bg-white">
      {/* 結果ヘッダー */}
      <div className="p-6 border-b border-gray-300">
        <h2 className="mb-2 text-xl font-bold text-gray-900">
          {dungeonName}: {getResultText()}
        </h2>
      </div>

      {/* パーティ状態 */}
      <div className="p-6 border-b border-gray-300">
        <div className="space-y-3">
          {meta.party.map((memberId) => {
            const goblin = getPartyMember(memberId)
            const hp = getPartyMemberHp(memberId)
            const dead = isDead(memberId)

            return (
              <div
                key={memberId}
                className="flex gap-3 items-center"
              >
                <div className="flex overflow-hidden flex-shrink-0 justify-center items-center w-10 h-10 bg-gray-200 rounded">
                  <img
                    src={goblin?.avatar}
                    alt={goblin?.name}
                    className={`w-full h-full object-cover ${dead ? 'grayscale' : ''}`}
                  />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {goblin?.name || `ID:${memberId}`}
                  </div>
                  <div className="text-xs text-gray-600">
                    ({hp.current}/{hp.max})
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 経験値・ゴールド */}
      <div className="p-6 border-b border-gray-300">
        <div className="space-y-2">
          <div className="text-sm text-gray-900">
            経験値 {summary.xpGained.toLocaleString()} XP
          </div>
          <div className="text-sm text-gray-900">
            {summary.goldGained?.toLocaleString() || 0} Gold を獲得
          </div>
        </div>
      </div>

      {/* 獲得アイテム */}
      {summary.loot.length > 0 && (
        <div className="p-6 border-b border-gray-300">
          <h3 className="mb-3 text-sm font-medium text-gray-900">
            獲得アイテム
          </h3>
          <div className="space-y-2">
            {summary.loot.map((item, index) => (
              <div
                key={index}
                className="text-sm text-gray-700"
              >
                {item.id} × {item.qty}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 捕獲 */}
      {summary.captures.length > 0 && (
        <div className="p-6 border-b border-gray-300">
          <h3 className="mb-3 text-sm font-medium text-gray-900">
            捕獲
          </h3>
          <div className="space-y-2">
            {summary.captures.map((capture, index) => (
              <div
                key={index}
                className="text-sm text-gray-700"
              >
                {capture.id} × {capture.qty}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 次回解放エリア */}
      {isSuccess && area?.unlockNext && (
        <div className="p-6 border-b border-gray-300">
          <div className="text-sm text-gray-900">
            次のエリア「{areasData.find(a => a.id === area.unlockNext)?.name || area.unlockNext}」が解放されました
          </div>
        </div>
      )}

      {/* 戻るボタン */}
      <div className="p-6 mt-auto">
        <button
          onClick={onBackToMenu}
          className="py-3 w-full font-medium text-white bg-gray-800 rounded transition-colors hover:bg-gray-700"
        >
          メニューに戻る
        </button>
      </div>
    </div>
  )
}