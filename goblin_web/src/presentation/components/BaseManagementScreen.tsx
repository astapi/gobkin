import { useEffect, useMemo, useState } from 'react'
import type { Goblin, BaseState, ModStat } from '../../shared/types'
import type { IPendingGoblinRepository, IBaseStateRepository } from '../../core/repositories'
import { useGoblinService } from '../hooks/useGoblinService.ts'
import { FirestorePendingGoblinRepositoryAdapter } from '../../infrastructure/repositories/FirestorePendingGoblinRepositoryImpl'
import { FirestoreBaseStateRepositoryAdapter } from '../../infrastructure/repositories/FirestoreBaseStateRepositoryImpl'
import { JsonPendingGoblinRepositoryImpl } from '../../infrastructure/repositories/JsonPendingGoblinRepositoryImpl'
import { JsonBaseStateRepositoryImpl } from '../../infrastructure/repositories/JsonBaseStateRepositoryImpl'
import { getModTemplate } from '../../shared/data/modPoolLoader'
import { ModStatCalculator } from '../../core/services/ModStatCalculator'
import { FactorBadgeList } from './FactorBadge'
import { getGoblinAvatar } from '../../shared/utils/goblinAvatar'

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

const USE_FIRESTORE = import.meta.env.VITE_USE_FIRESTORE === 'true'

type BaseConfig = Pick<BaseState, 'capacity' | 'rank' | 'nextGoblinId'>

const createDefaultConfig = (): BaseConfig => {
  return {
    capacity: 8,
    rank: 1,
  }
}

export const BaseManagementScreen = () => {
  const { goblinRepository, goblins, refreshGoblins, isLoading } = useGoblinService()
  const pendingGoblinRepository = useMemo<IPendingGoblinRepository>(
    () => USE_FIRESTORE
      ? new FirestorePendingGoblinRepositoryAdapter()
      : new JsonPendingGoblinRepositoryImpl(),
    []
  )
  const baseStateRepository = useMemo<IBaseStateRepository>(
    () => USE_FIRESTORE
      ? new FirestoreBaseStateRepositoryAdapter()
      : new JsonBaseStateRepositoryImpl(),
    []
  )
  const [config, setConfig] = useState<BaseConfig>(createDefaultConfig())
  const [pendingGoblins, setPendingGoblins] = useState<Goblin[]>([])
  const [selectedGoblinIds, setSelectedGoblinIds] = useState<Set<number>>(new Set())
  const [isPendingRepoReady, setIsPendingRepoReady] = useState(false)
  const [isBaseStateReady, setIsBaseStateReady] = useState(false)

  // baseStateRepositoryを初期化
  useEffect(() => {
    const initBaseStateRepo = async () => {
      await baseStateRepository.initialize()
      const state = baseStateRepository.getBaseState()
      if (state) {
        setConfig(state)
      }
      setIsBaseStateReady(true)
    }
    initBaseStateRepo()
  }, [baseStateRepository])

  // pendingGoblinRepositoryを初期化
  useEffect(() => {
    const initPendingRepo = async () => {
      await pendingGoblinRepository.initialize()
      setPendingGoblins(pendingGoblinRepository.getPendingGoblins())
      setIsPendingRepoReady(true)
    }
    initPendingRepo()
  }, [pendingGoblinRepository])

  // configが変更されたときにFirestoreに保存
  useEffect(() => {
    if (isBaseStateReady) {
      baseStateRepository.saveBaseState(config)
    }
  }, [config, isBaseStateReady, baseStateRepository])

  // 拠点ランクに応じた保留リストの上限を取得
  const getPendingListLimit = (rank: number): number => {
    return rank * 5 // ランク1=5体、ランク2=10体、ランク3=15体...
  }


  const toggleGoblinSelection = (goblinId: number) => {
    setSelectedGoblinIds(prev => {
      const next = new Set(prev)
      if (next.has(goblinId)) {
        next.delete(goblinId)
      } else {
        next.add(goblinId)
      }
      return next
    })
  }

  const addSelectedGoblins = async () => {
    const selectedGoblins = pendingGoblins.filter(g => selectedGoblinIds.has(g.id))
    for (const goblin of selectedGoblins) {
      // 拠点に追加
      await goblinRepository.saveGoblin(goblin)
      // pendingGoblinsから削除
      pendingGoblinRepository.removePendingGoblin(goblin.id)
    }
    await refreshGoblins()

    // ローカル状態を更新
    setPendingGoblins(prev => prev.filter(g => !selectedGoblinIds.has(g.id)))
    setSelectedGoblinIds(new Set())
  }

  const dismissSelectedGoblins = async () => {
    const selectedGoblins = pendingGoblins.filter(g => selectedGoblinIds.has(g.id))
    for (const goblin of selectedGoblins) {
      // pendingGoblinsから削除（拠点には追加しない）
      pendingGoblinRepository.removePendingGoblin(goblin.id)
    }

    // ローカル状態を更新
    setPendingGoblins(prev => prev.filter(g => !selectedGoblinIds.has(g.id)))
    setSelectedGoblinIds(new Set())
  }

  const availableSlots = Math.max(0, config.capacity - goblins.length)
  const maxPendingGoblins = getPendingListLimit(config.rank)

  if (isLoading || !isBaseStateReady || !isPendingRepoReady) {
    return (
      <div className="h-full flex items-center justify-center text-gray-600">
        拠点情報を読み込み中...
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto flex flex-col gap-4">
      <div className="text-lg font-bold text-gray-800 pb-2 border-b-2 border-gray-200">
        拠点管理
      </div>

      <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
        <div className="text-sm font-semibold text-gray-700 mb-3">拠点ステータス</div>
        <div className="grid grid-cols-2 gap-3 text-sm text-gray-700">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">拠点ランク</span>
            <div className="text-base font-semibold px-2 py-1 bg-gray-50 rounded-md border border-gray-200">
              {config.rank}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">収容数</span>
            <div className="text-base font-semibold px-2 py-1 bg-gray-50 rounded-md border border-gray-200">
              {config.capacity}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">現在のゴブリン</span>
            <span className="text-base font-semibold">{goblins.length} / {config.capacity}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">空き枠</span>
            <span className="text-base font-semibold text-gray-700">{availableSlots}</span>
          </div>
        </div>

      </div>

      {pendingGoblins.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4 border border-gray-100 flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-gray-700">追加されたゴブリン</div>
              <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-700">
                {pendingGoblins.length} / {maxPendingGoblins}体
              </span>
            </div>
            {selectedGoblinIds.size > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={dismissSelectedGoblins}
                  className="flex-1 px-3 py-2 bg-gray-500 text-white text-xs font-semibold rounded-md hover:bg-gray-600 transition-colors"
                >
                  解雇する ({selectedGoblinIds.size})
                </button>
                <button
                  type="button"
                  onClick={addSelectedGoblins}
                  className="flex-1 px-3 py-2 bg-gray-700 text-white text-xs font-semibold rounded-md hover:bg-gray-800 transition-colors"
                >
                  拠点に加える ({selectedGoblinIds.size})
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            遠征成功により新しいゴブリンが見つかりました。拠点に加えるか、解雇するゴブリンを選択してください。
          </p>

          <div className="flex flex-col gap-2">
            {pendingGoblins.map(goblin => {
              const isSelected = selectedGoblinIds.has(goblin.id)
              const effectiveStats = ModStatCalculator.calculate(goblin)
              const hasMods = goblin.mods && goblin.mods.length > 0
              const hasFactors = goblin.factors && goblin.factors.length > 0
              return (
                <div
                  key={goblin.id}
                  onClick={() => toggleGoblinSelection(goblin.id)}
                  className={`p-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-gray-100 border-gray-500'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isSelected
                            ? 'bg-gray-600 border-gray-600'
                            : 'bg-white border-gray-300'
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                      <img src={getGoblinAvatar(goblin)} alt={goblin.name} className="w-full h-full object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-800 text-sm truncate">{goblin.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        HP{effectiveStats.hp} / A{effectiveStats.atk} / D{effectiveStats.def} / S{effectiveStats.spd} / SP{effectiveStats.sp}
                      </div>
                    </div>
                  </div>
                  {(hasMods || hasFactors) && (
                    <div className="mt-2 pt-2 border-t border-gray-200 flex flex-col gap-1">
                      {hasFactors && (
                        <FactorBadgeList factorIds={goblin.factors!} size="sm" />
                      )}
                      {hasMods && (
                        <div className="flex flex-wrap gap-1">
                          {goblin.mods!.map((mod, index) => {
                            const template = getModTemplate(mod.templateId)
                            if (!template) return null
                            const isPercent = template.stat.includes('percent') || template.stat === 'damage_reduction'
                            return (
                              <span
                                key={index}
                                className={`text-xs px-1.5 py-0.5 rounded ${
                                  template.type === 'prefix'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-purple-50 text-purple-700 border border-purple-200'
                                }`}
                              >
                                {getStatLabel(template.stat)}+{mod.value}{isPercent ? '%' : ''}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <div className="text-xs text-gray-600 leading-relaxed space-y-2">
          <p>• 遠征成功時にゴブリンが1体追加されます</p>
          <p>• 追加されたゴブリンのリストは拠点ランク × 5体まで保持されます（現在: 最大{maxPendingGoblins}体）</p>
        </div>
      </div>
    </div>
  )
}
