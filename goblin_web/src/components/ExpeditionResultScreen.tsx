import { useState, useEffect } from 'react'
import type { ExpeditionReplay, Goblin } from '../types/index.ts'
import { areasConfig } from '../data/areas.ts'

interface ExpeditionResultScreenProps {
  expeditionReplay: ExpeditionReplay
  goblins: Goblin[]
  onBackToMenu: () => void
}

export const ExpeditionResultScreen = ({
  expeditionReplay,
  goblins,
  onBackToMenu
}: ExpeditionResultScreenProps) => {
  const [animatedXp, setAnimatedXp] = useState(0)
  const [visibleItems, setVisibleItems] = useState(0)
  const [showCaptureEffect, setShowCaptureEffect] = useState(false)

  const { summary, meta } = expeditionReplay
  const isSuccess = summary.success
  const area = areasConfig.find(a => a.id === meta.areaId)

  // 経験値アニメーション
  useEffect(() => {
    const targetXp = summary.xpGained
    const duration = 1000 // 1秒
    const startTime = Date.now()

    const animateXp = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const currentXp = Math.floor(targetXp * progress)

      setAnimatedXp(currentXp)

      if (progress < 1) {
        requestAnimationFrame(animateXp)
      }
    }

    setTimeout(animateXp, 500) // 0.5秒待ってから開始
  }, [summary.xpGained])

  // アイテム順次表示
  useEffect(() => {
    const totalItems = summary.loot.length
    let currentIndex = 0

    const showNextItem = () => {
      if (currentIndex < totalItems) {
        setVisibleItems(currentIndex + 1)
        currentIndex++
        setTimeout(showNextItem, 200) // 0.2秒間隔
      }
    }

    setTimeout(showNextItem, 1500) // XPアニメーション後に開始
  }, [summary.loot.length])

  // 捕獲エフェクト
  useEffect(() => {
    if (summary.captures.length > 0) {
      setTimeout(() => {
        setShowCaptureEffect(true)
        setTimeout(() => setShowCaptureEffect(false), 2000)
      }, 2000)
    }
  }, [summary.captures.length])

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getPartyMember = (memberId: string) => {
    return goblins.find(g => g.id === parseInt(memberId))
  }

  const isInjured = (memberId: string) => summary.injuries.includes(memberId)
  const isDead = (memberId: string) => summary.casualties.includes(memberId)

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-y-auto">
      {/* 結果ヘッダー */}
      <div className={`p-6 text-center ${isSuccess ? 'bg-green-100' : 'bg-red-100'}`}>
        <div className="text-6xl mb-2">
          {isSuccess ? '🏆' : '💀'}
        </div>
        <h2 className={`text-2xl font-bold mb-2 ${isSuccess ? 'text-green-800' : 'text-red-800'}`}>
          {isSuccess ? '遠征成功！' : '遠征失敗...'}
        </h2>
        <p className="text-gray-600">
          {area?.name} - {summary.maxFloorReached}階到達
        </p>
        <p className="text-sm text-gray-500">
          探索時間: {formatTime(expeditionReplay.durationSec)}
        </p>
      </div>

      {/* 経験値獲得 */}
      <div className="bg-white m-4 rounded-lg p-4 shadow-lg border-2 border-yellow-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✨</span>
            <span className="font-bold text-lg">経験値獲得</span>
          </div>
          <div className="text-2xl font-bold text-yellow-600">
            {animatedXp.toLocaleString()} XP
          </div>
        </div>
      </div>

      {/* 戦利品 */}
      {summary.loot.length > 0 && (
        <div className="bg-white m-4 rounded-lg p-4 shadow-lg">
          <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
            <span className="text-xl">📦</span>
            戦利品
          </h3>
          <div className="space-y-2">
            {summary.loot.slice(0, visibleItems).map((item, index) => (
              <div
                key={index}
                className="flex justify-between items-center p-2 bg-gray-50 rounded animate-fade-in"
                style={{
                  animation: `fadeIn 0.3s ease-in-out ${index * 0.1}s both`
                }}
              >
                <span className="font-medium">{item.id}</span>
                <span className="text-gray-600">× {item.qty}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 捕獲成功 */}
      {summary.captures.length > 0 && (
        <div className={`bg-white m-4 rounded-lg p-4 shadow-lg border-2 border-purple-300 ${showCaptureEffect ? 'animate-pulse' : ''}`}>
          <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
            <span className="text-xl">🎯</span>
            捕獲成功
            {showCaptureEffect && <span className="text-purple-500">✨</span>}
          </h3>
          <div className="space-y-2">
            {summary.captures.map((capture, index) => (
              <div
                key={index}
                className="flex justify-between items-center p-2 bg-purple-50 rounded"
              >
                <span className="font-medium text-purple-700">{capture.id}</span>
                <span className="text-purple-600">× {capture.qty}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* パーティ状態 */}
      <div className="bg-white m-4 rounded-lg p-4 shadow-lg">
        <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
          <span className="text-xl">👥</span>
          パーティ状態
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {meta.party.map((memberId) => {
            const goblin = getPartyMember(memberId)
            const injured = isInjured(memberId)
            const dead = isDead(memberId)

            return (
              <div
                key={memberId}
                className={`p-3 rounded-lg border-2 ${
                  dead
                    ? 'bg-red-50 border-red-300'
                    : injured
                    ? 'bg-yellow-50 border-yellow-300'
                    : 'bg-green-50 border-green-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                    <img
                      src={goblin?.avatar}
                      alt={goblin?.name}
                      className={`w-full h-full object-cover ${dead ? 'grayscale' : ''}`}
                    />
                  </div>
                  <span className="font-medium text-sm">
                    {goblin?.name || `ID:${memberId}`}
                  </span>
                </div>
                <div className="text-xs">
                  {dead ? (
                    <span className="text-red-600 font-bold">💀 戦闘不能</span>
                  ) : injured ? (
                    <span className="text-yellow-600 font-bold">🩹 負傷</span>
                  ) : (
                    <span className="text-green-600 font-bold">✅ 無事</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 次回解放エリア */}
      {isSuccess && area?.unlockNext && (
        <div className="bg-white m-4 rounded-lg p-4 shadow-lg border-2 border-blue-300">
          <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
            <span className="text-xl">🔓</span>
            新エリア解放！
          </h3>
          <p className="text-blue-700">
            次のエリア「{areasConfig.find(a => a.id === area.unlockNext)?.name || area.unlockNext}」が解放されました！
          </p>
        </div>
      )}

      {/* 戻るボタン */}
      <div className="p-4 mt-auto">
        <button
          onClick={onBackToMenu}
          className="w-full bg-gray-600 text-white py-3 rounded-lg font-bold hover:bg-gray-700 transition-colors"
        >
          🏠 メニューに戻る
        </button>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-in-out;
        }
      `}</style>
    </div>
  )
}