import { useState } from 'react'
import type { Goblin } from '../../shared/types'
import type { IGoblinRepository } from '../../core/repositories'
import { getExpForNextLevel, getExpProgress } from '../../core/services/ExperienceSystem'
import { getFactor } from '../../shared/data/factors'

interface GoblinDetailModalProps {
  goblin: Goblin | null
  onClose: () => void
  goblinRepository: IGoblinRepository
}

export const GoblinDetailModal = ({
  goblin,
  onClose,
  goblinRepository,
}: GoblinDetailModalProps) => {
  const [showBanishConfirm, setShowBanishConfirm] = useState(false)

  const handleBanish = () => {
    if (!goblin) return
    goblinRepository.deleteGoblin(goblin.id)
    setShowBanishConfirm(false)
    onClose()
  }

  if (!goblin) return null

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col max-w-[414px] mx-auto">
      <div className="flex gap-4 items-center p-5 text-white bg-gray-800 shadow-lg">
        <button
          onClick={onClose}
          className="p-2 text-xl rounded transition-colors hover:bg-white/20"
        >
          ←
        </button>
        <h2 className="text-lg font-bold tracking-wide">ゴブリン詳細</h2>
      </div>

      <div className="overflow-y-auto flex-1 p-2">
        <div className="p-6 bg-white rounded-xl border-2 border-gray-200 shadow-md">
          <div className="flex gap-4 items-center pb-4 mb-6 border-b-2 border-gray-100">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center border-[3px] border-gray-400 overflow-hidden">
              <img src={goblin.avatar} alt={goblin.name} className="object-cover w-full h-full" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-800">{goblin.name}</h3>
              <div className="mt-1 text-base text-gray-600">{goblin.race}</div>
              <div className="text-lg font-bold text-gray-800">Lv.{goblin.level}</div>
            </div>
          </div>

          <div className="mt-2">
            <div className="pb-2 mb-3 text-lg font-bold text-gray-800 border-b border-gray-200">
              ステータス
            </div>
            <div className="flex flex-col gap-2">
              {(['hp', 'atk', 'def', 'spd', 'sp'] as const).map((key) => {
                const value = goblin.stats[key]
                return (
                  <div key={key} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-300">
                    <div className="text-sm font-bold text-gray-700">
                      {key.toUpperCase()}
                    </div>
                    <div className="text-base font-bold text-gray-600">
                      {value}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-6">
            <div className="pb-2 mb-3 text-lg font-bold text-gray-800 border-b border-gray-200">
              経験値
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-300">
              <div className="flex justify-between mb-2 text-sm">
                <span className="font-bold text-gray-700">EXP</span>
                <span className="text-gray-600">
                  {goblin.experience} / {getExpForNextLevel(goblin.level)}
                </span>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gray-600 transition-all"
                  style={{ width: `${getExpProgress(goblin.level, goblin.experience) * 100}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-gray-500 text-right">
                次のレベルまで: {Math.max(0, getExpForNextLevel(goblin.level) - goblin.experience)}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="pb-2 mb-3 text-lg font-bold text-gray-800 border-b border-gray-200">
              因子
            </div>
            {goblin.factors && goblin.factors.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {goblin.factors.map((factorId) => {
                  const factor = getFactor(factorId)
                  return (
                    <div
                      key={factorId}
                      className="px-3 py-2 bg-gray-100 rounded-lg border border-gray-300"
                      title={factor?.description}
                    >
                      <span className="text-sm font-medium text-gray-700">
                        {factor?.name || factorId}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-3 text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-300">
                因子を持っていません
              </div>
            )}
          </div>

          <div className="mt-6">
            <button
              onClick={() => setShowBanishConfirm(true)}
              className="py-3 w-full font-bold text-white bg-gray-700 rounded-lg transition-colors hover:bg-gray-800"
            >
              このゴブリンを追放する
            </button>
          </div>
        </div>
      </div>

      {showBanishConfirm && (
        <div className="flex fixed inset-0 z-50 justify-center items-center bg-black/50">
          <div className="p-6 mx-4 max-w-sm bg-white rounded-xl shadow-2xl">
            <h3 className="mb-4 text-xl font-bold text-gray-800">追放の確認</h3>
            <p className="mb-6 text-gray-600">
              本当に <span className="font-bold text-gray-800">{goblin.name}</span> を追放しますか？
              <br />
              この操作は取り消せません。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBanishConfirm(false)}
                className="flex-1 py-2 font-bold text-gray-700 bg-gray-200 rounded-lg transition-colors hover:bg-gray-300"
              >
                キャンセル
              </button>
              <button
                onClick={handleBanish}
                className="flex-1 py-2 font-bold text-white bg-gray-700 rounded-lg transition-colors hover:bg-gray-800"
              >
                追放する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
