import { useState } from 'react'
import type { Goblin, ModStat } from '../../shared/types'
import type { IGoblinRepository } from '../../core/repositories'
import { getExpForNextLevel, getExpProgress } from '../../core/services/ExperienceSystem'
import { getFactor } from '../../shared/data/factors'
import { getModTemplate } from '../../shared/data/modPoolLoader'
import { ModStatCalculator } from '../../core/services/ModStatCalculator'

const STAT_LABELS: Record<ModStat, string> = {
  hp_percent: 'HP',
  hp_flat: 'HP',
  atk_percent: 'ATK',
  atk_flat: 'ATK',
  def_percent: 'DEF',
  def_flat: 'DEF',
  spd_percent: 'SPD',
  sp_percent: 'SP',
  sp_flat: 'SP',
  damage_reduction: '被ダメ軽減',
}

function getStatLabel(stat: ModStat): string {
  return STAT_LABELS[stat] || stat
}

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
    <div className="flex fixed inset-0 z-50 flex-col mx-auto max-w-full bg-gray-50">
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
            {(() => {
              const effectiveStats = ModStatCalculator.calculate(goblin)
              return (
                <div className="flex flex-col gap-2">
                  {(['hp', 'atk', 'def', 'spd', 'sp'] as const).map((key) => (
                    <div key={key} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-300">
                      <div className="text-sm font-bold text-gray-700">
                        {key.toUpperCase()}
                      </div>
                      <div className="text-base font-bold text-gray-600">
                        {effectiveStats[key]}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
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
              <div className="overflow-hidden w-full h-3 bg-gray-200 rounded-full">
                <div
                  className="h-full bg-gray-600 transition-all"
                  style={{ width: `${getExpProgress(goblin.level, goblin.experience) * 100}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-right text-gray-500">
                次のレベルまで: {Math.max(0, getExpForNextLevel(goblin.level) - goblin.experience)}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="pb-2 mb-3 text-lg font-bold text-gray-800 border-b border-gray-200">
              因子
            </div>
            {goblin.factors && goblin.factors.length > 0 ? (
              <div className="flex flex-col gap-3">
                {goblin.factors.map((factorId) => {
                  const factor = getFactor(factorId)
                  if (!factor) return null
                  return (
                    <div
                      key={factorId}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-300"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">
                          {factorId === 'slime' ? '💧' : factorId === 'forest' ? '🐺' : '✨'}
                        </span>
                        <span className="font-bold text-gray-800">{factor.name}</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{factor.description}</p>
                      {factor.effects && factor.effects.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {factor.effects.map((effect, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded"
                            >
                              {effect.target.toUpperCase()} +{effect.value}
                            </span>
                          ))}
                        </div>
                      )}
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
            <div className="pb-2 mb-3 text-lg font-bold text-gray-800 border-b border-gray-200">
              Mod
            </div>
            {goblin.mods && goblin.mods.length > 0 ? (
              <div className="flex flex-col gap-2">
                {goblin.mods.map((mod, index) => {
                  const template = getModTemplate(mod.templateId)
                  if (!template) return null
                  const isPercent = template.stat.includes('percent') || template.stat === 'damage_reduction'
                  const statLabel = getStatLabel(template.stat)
                  return (
                    <div
                      key={index}
                      className={`flex justify-between items-center p-3 rounded-lg border ${
                        template.type === 'prefix'
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-purple-50 border-purple-200'
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-700">
                        {statLabel}
                      </div>
                      <div className="text-sm font-bold text-gray-600">
                        +{mod.value}{isPercent ? '%' : ''}
                      </div>
                    </div>
                  )
                })}
                {(() => {
                  const damageReduction = ModStatCalculator.getDamageReduction(goblin)
                  if (damageReduction > 0) {
                    return (
                      <div className="p-2 mt-2 text-sm text-purple-700 bg-purple-50 rounded-lg border border-purple-200">
                        被ダメージ軽減: {damageReduction}%
                      </div>
                    )
                  }
                  return null
                })()}
              </div>
            ) : (
              <div className="p-3 text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-300">
                Modを持っていません
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
