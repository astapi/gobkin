import { useState, useEffect, useRef, useCallback } from 'react'
import type { ExpeditionReplay, TimelineEvent, Goblin, BattleLogEntry } from '../../shared/types'

interface ExpeditionLogScreenProps {
  expeditionReplay: ExpeditionReplay
  goblins: Goblin[]
  startTime?: Date
}

type PlaybackSpeed = 1 | 2 | 4

interface LogEntry {
  message: string
  battleLog?: BattleLogEntry[]
  eventType?: string
}

export const ExpeditionLogScreen = ({
  expeditionReplay,
  goblins,
  startTime
}: ExpeditionLogScreenProps) => {
  // 初期currentTimeを計算（startTimeがある場合は経過時間を算出）
  const initialTime = startTime
    ? Math.min((Date.now() - startTime.getTime()) / 1000, expeditionReplay.durationSec)
    : 0

  const [currentTime, setCurrentTime] = useState(initialTime)
  const [isPlaying] = useState(true)
  const [speed] = useState<PlaybackSpeed>(1)
  const [currentFloor, setCurrentFloor] = useState(1)
  const [eventLog, setEventLog] = useState<LogEntry[]>([])
  const [selectedBattleLog, setSelectedBattleLog] = useState<BattleLogEntry[] | null>(null)
  const [partyHp, setPartyHp] = useState<number[]>(() => {
    return expeditionReplay.meta.party.map(memberId => {
      const goblin = goblins.find(g => g.id === parseInt(memberId))
      return goblin?.stats.hp || 100
    })
  })
  const animationFrameRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(performance.now())
  const logContainerRef = useRef<HTMLDivElement>(null)
  const processedEventIndexesRef = useRef<Set<number>>(new Set())
  const isInitializedRef = useRef<boolean>(false)

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const addLog = useCallback((message: string, battleLog?: BattleLogEntry[], eventType?: string) => {
    setEventLog(prev => [...prev, {
      message: `[${formatTime(currentTime)}] ${message}`,
      battleLog,
      eventType
    }])
    setTimeout(() => {
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
      }
    }, 50)
  }, [currentTime])

  const processEvent = useCallback((event: TimelineEvent, eventIndex: number) => {
    if (processedEventIndexesRef.current.has(eventIndex)) {
      return
    }

    processedEventIndexesRef.current.add(eventIndex)

    switch (event.type) {
      case 'move_start': {
        addLog(`${event.floor}階の探索を開始`)
        break
      }
      case 'floor_up': {
        setCurrentFloor(event.to)
        addLog(`${event.from}階から${event.to}階へ移動`)
        break
      }
      case 'battle':
      case 'boss': {
        const battleType = event.type === 'boss' ? 'ボス' : '戦闘'
        const result = event.combat.outcome === 'win' ? '勝利' : '敗北'
        addLog(
          `${battleType} ${event.enemy.name} Lv${event.enemy.lvl} ×${event.enemy.count}体と遭遇 → ${result}`,
          event.combat.detailedLog,
          'battle'
        )

        if (event.combat.allyHPDelta) {
          setPartyHp(prevHp => {
            const updated = [...prevHp]
            event.combat.allyHPDelta.forEach((delta, idx) => {
              updated[idx] = Math.max(0, (updated[idx] ?? 0) + delta)
            })
            return updated
          })
        }

        if (event.xp > 0) {
          addLog(`${event.xp}XP獲得`)
        }

        if (event.combat.capture?.success) {
          addLog(`${event.combat.capture.captured?.id}を捕獲！`)
        }
        break
      }
      case 'return': {
        let reason = '探索完了'
        switch (event.reason) {
          case 'completed':
            reason = 'ダンジョン踏破！'
            break
          case 'defeated':
            reason = '全滅により撤退'
            break
          case 'policy_return':
            reason = '設定した条件により帰還'
            break
          case 'abort':
            reason = '緊急帰還'
            break
        }
        addLog(`${reason}`)
        break
      }
    }
  }, [addLog])

  // 初期化時に経過済みイベントを即座に処理
  useEffect(() => {
    if (isInitializedRef.current) {
      return
    }

    isInitializedRef.current = true

    const processedIndexes = new Set<number>()
    const tempLogs: LogEntry[] = []
    const tempPartyHp = expeditionReplay.meta.party.map(memberId => {
      const goblin = goblins.find(g => g.id === parseInt(memberId))
      return goblin?.stats.hp ?? 100
    })
    let tempFloor = 1

    const formatTimeLocal = (seconds: number): string => {
      const mins = Math.floor(seconds / 60)
      const secs = Math.floor(seconds % 60)
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    expeditionReplay.events.forEach((event, index) => {
      if (event.at > initialTime) {
        return
      }

      processedIndexes.add(index)

      switch (event.type) {
        case 'move_start': {
          tempLogs.push({ message: `[${formatTimeLocal(event.at)}] ${event.floor}階の探索を開始` })
          break
        }
        case 'floor_up': {
          tempFloor = event.to
          tempLogs.push({ message: `[${formatTimeLocal(event.at)}] ${event.from}階から${event.to}階へ移動` })
          break
        }
        case 'battle':
        case 'boss': {
          const battleType = event.type === 'boss' ? 'ボス' : '戦闘'
          const result = event.combat.outcome === 'win' ? '勝利' : '敗北'
          tempLogs.push({
            message: `[${formatTimeLocal(event.at)}] ${battleType} ${event.enemy.name} Lv${event.enemy.lvl} ×${event.enemy.count}体と遭遇 → ${result}`,
            battleLog: event.combat.detailedLog,
            eventType: 'battle'
          })

          if (event.combat.allyHPDelta) {
            event.combat.allyHPDelta.forEach((delta, idx) => {
              tempPartyHp[idx] = Math.max(0, tempPartyHp[idx] + delta)
            })
          }

          if (event.xp > 0) {
            tempLogs.push({ message: `[${formatTimeLocal(event.at)}] ${event.xp}XP獲得` })
          }

          if (event.combat.capture?.success) {
            tempLogs.push({ message: `[${formatTimeLocal(event.at)}] ${event.combat.capture.captured?.id}を捕獲！` })
          }
          break
        }
        case 'return': {
          let reason = '探索完了'
          switch (event.reason) {
            case 'completed':
              reason = 'ダンジョン踏破！'
              break
            case 'defeated':
              reason = '全滅により撤退'
              break
            case 'policy_return':
              reason = '設定した条件により帰還'
              break
            case 'abort':
              reason = '緊急帰還'
              break
          }
          tempLogs.push({ message: `[${formatTimeLocal(event.at)}] ${reason}` })
          break
        }
      }
    })

    processedEventIndexesRef.current = processedIndexes
    setPartyHp(tempPartyHp)
    setCurrentFloor(tempFloor)
    setEventLog(tempLogs)
  }, [expeditionReplay.events, expeditionReplay.meta.party, goblins, initialTime])

  useEffect(() => {
    // アニメーションループ（初期化後に実行）
    if (!isInitializedRef.current) return

    if (!isPlaying) return

    const animate = (currentTimeStamp: number) => {
      const deltaTime = (currentTimeStamp - lastTimeRef.current) / 1000
      lastTimeRef.current = currentTimeStamp

      setCurrentTime(prevTime => {
        const newTime = Math.min(prevTime + deltaTime * speed, expeditionReplay.durationSec)

        expeditionReplay.events.forEach((event, index) => {
          if (!processedEventIndexesRef.current.has(index) && event.at <= newTime) {
            processEvent(event, index)
          }
        })

        return newTime
      })

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isPlaying, speed, processEvent, expeditionReplay.durationSec, expeditionReplay.events])

  const progress = (currentTime / expeditionReplay.durationSec) * 100

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div className="p-3 text-white bg-gray-800 shadow-lg">
        <div className="flex justify-between items-center">
          <div className="text-sm font-bold">
            {expeditionReplay.meta.areaName} - {currentFloor}階
          </div>
          <div className="text-xs">
            {formatTime(currentTime)} / {formatTime(expeditionReplay.durationSec)}
          </div>
        </div>

        {/* プログレスバー */}
        <div className="overflow-hidden mt-2 h-2 bg-gray-700 rounded-full">
          <div
            className="h-full bg-green-500 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* パーティ状態 */}
      <div className="p-3 bg-gray-100 border-b-2 border-gray-300">
        <div className="grid grid-cols-3 gap-2">
          {expeditionReplay.meta.party.map((memberId, idx) => {
            const goblin = goblins.find(g => g.id === parseInt(memberId))
            const maxHp = goblin?.stats.hp || 100
            const currentHp = partyHp[idx]
            const hpPercent = (currentHp / maxHp) * 100
            const isKO = currentHp <= 0

            return (
              <div
                key={memberId}
                className={`bg-white rounded-lg p-2 border ${isKO ? 'border-red-400 opacity-50' : 'border-gray-300'}`}
              >
                <div className="flex gap-1 items-center mb-1">
                  <div className="flex overflow-hidden justify-center items-center w-6 h-6 bg-gray-200 rounded-full">
                    <img src={goblin?.avatar} alt={goblin?.name} className="object-cover w-full h-full" />
                  </div>
                  <div className="flex-1 text-xs font-medium truncate">
                    {goblin?.name || `ID:${memberId}`}
                  </div>
                </div>
                <div className="overflow-hidden h-1 bg-gray-200 rounded-full">
                  <div
                    className={`h-full transition-all duration-300 ${isKO ? 'bg-red-500' : hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${hpPercent}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-gray-600">
                  HP: {currentHp}/{maxHp}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* イベントログ */}
      <div className="overflow-hidden flex-1 bg-white">
        <div
          ref={logContainerRef}
          className="overflow-y-auto p-4 space-y-1 h-full"
        >
          {eventLog.map((log, idx) => (
            <div
              key={idx}
              className={`text-sm text-gray-700 font-mono ${
                log.battleLog && log.battleLog.length > 0
                  ? 'cursor-pointer hover:bg-blue-50 py-1 rounded'
                  : ''
              }`}
              onClick={() => {
                if (log.battleLog && log.battleLog.length > 0) {
                  setSelectedBattleLog(log.battleLog)
                }
              }}
            >
              {log.message}
              {log.battleLog && log.battleLog.length > 0 && (
                <span className="ml-2 text-xs text-blue-500">詳細</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 戦闘詳細ログモーダル */}
      {selectedBattleLog && (
        <div
          className="flex fixed inset-0 z-50 justify-center items-center bg-black bg-opacity-50"
          onClick={() => setSelectedBattleLog(null)}
        >
          <div
            className="bg-white max-w-[414px] w-full h-full overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 text-white bg-gray-800">
              <h3 className="font-bold">戦闘ログ</h3>
              <button
                onClick={() => setSelectedBattleLog(null)}
                className="text-white hover:text-gray-300"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto overflow-x-hidden flex-1 p-4 space-y-2" style={{ WebkitOverflowScrolling: 'touch' }}>
              {selectedBattleLog.map((entry, idx) => {
                // ターン開始ログの場合
                if (entry.action === 'turn_start' && entry.turnState) {
                  return (
                    <div key={idx} className="p-3 bg-gray-100 rounded border border-gray-300">
                      <div className="mb-2 font-bold text-gray-700">
                        Turn {entry.turn} 開始
                      </div>
                      <div className="space-y-2">
                        <div>
                          <div className="mb-1 text-xs font-semibold text-blue-700">味方:</div>
                          <div className="space-y-1">
                            {entry.turnState.allies.map((ally, i) => (
                              <div key={i} className="flex justify-between items-center text-xs">
                                <span className="text-gray-700">{ally.name}</span>
                                <span className={`font-mono ${ally.currentHP <= 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                  {ally.currentHP}/{ally.maxHP} HP
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 text-xs font-semibold text-red-700">敵:</div>
                          <div className="space-y-1">
                            {entry.turnState.enemies.map((enemy, i) => (
                              <div key={i} className="flex justify-between items-center text-xs">
                                <span className="text-gray-700">{enemy.name}</span>
                                <span className={`font-mono ${enemy.currentHP <= 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                  {enemy.currentHP}/{enemy.maxHP} HP
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }

                // 通常の戦闘ログ
                return (
                  <div
                    key={idx}
                    className={`text-sm p-2 rounded ${
                      entry.isAlly ? 'bg-blue-50' : 'bg-red-50'
                    }`}
                  >
                    <div className="font-mono text-xs">
                      <span className={entry.isAlly ? 'text-blue-700 font-semibold' : 'text-red-700 font-semibold'}>
                        {entry.actorName}の攻撃
                      </span>
                      <span className="text-gray-500">
                        ({entry.actorHP}HP)
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-700">
                      {entry.actorName}の{entry.action}!
                    </div>
                    <div className="mt-1 text-xs text-gray-700">
                      {entry.targetName}に{entry.damage}ダメージ{entry.targetDefeated ? 'を与えて倒した！' : ''}
                      {entry.healing && `${entry.healing}回復`}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
