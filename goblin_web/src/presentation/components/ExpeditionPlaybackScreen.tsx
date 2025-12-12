import { useState, useEffect, useRef, useCallback } from 'react'
import type { ExpeditionReplay, TimelineEvent, Goblin } from '../../shared/types'

interface ExpeditionPlaybackScreenProps {
  expeditionReplay: ExpeditionReplay
  goblins: Goblin[]
  onComplete: () => void
  startTime?: Date
}

type PlaybackSpeed = 1 | 2 | 4

export const ExpeditionPlaybackScreen = ({
  expeditionReplay,
  goblins,
  onComplete,
  startTime
}: ExpeditionPlaybackScreenProps) => {
  // 初期currentTimeを計算（startTimeがある場合は経過時間を算出）
  const initialTime = startTime
    ? Math.min((Date.now() - startTime.getTime()) / 1000, expeditionReplay.durationSec)
    : 0

  const [currentTime, setCurrentTime] = useState(initialTime)
  const [isPlaying, setIsPlaying] = useState(true)
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [currentFloor, setCurrentFloor] = useState(1)
  const [eventLog, setEventLog] = useState<string[]>([])
  const [partyHp, setPartyHp] = useState<number[]>(() => {
    return expeditionReplay.meta.party.map(memberId => {
      const goblin = goblins.find(g => g.id === parseInt(memberId))
      return goblin?.stats.hp || 100
    })
  })
  const animationFrameRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(performance.now())
  const logContainerRef = useRef<HTMLDivElement>(null)
  const isCompletedRef = useRef<boolean>(false)
  const processedEventIdsRef = useRef<Set<string>>(new Set())
  const isInitializedRef = useRef<boolean>(false)

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getEventId = (index: number, event: TimelineEvent): string =>
    `${index}-${event.type}-${event.at}`

  const addLog = useCallback((message: string) => {
    setEventLog(prev => [...prev, `[${formatTime(currentTime)}] ${message}`])
    setTimeout(() => {
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
      }
    }, 50)
  }, [currentTime])

  const processEvent = useCallback((event: TimelineEvent, eventId: string) => {
    if (processedEventIdsRef.current.has(eventId)) {
      return // すでに処理済み
    }

    processedEventIdsRef.current.add(eventId)

    switch (event.type) {
      case 'move_start': {
        addLog(`[探索] ${event.floor}階の探索を開始`)
        break
      }
      case 'floor_up': {
        setCurrentFloor(event.to)
        addLog(`[移動] ${event.from}階から${event.to}階へ移動`)
        break
      }
      case 'battle':
      case 'boss': {
        const battleType = event.type === 'boss' ? '[BOSS]' : '[戦闘]'
        const result = event.combat.outcome === 'win' ? '勝利' : '敗北'
        addLog(`${battleType} ${event.enemy.name} Lv${event.enemy.lvl} ×${event.enemy.count}体と遭遇 → ${result}`)

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
          addLog(`[経験値] ${event.xp}XP獲得`)
        }

        if (event.combat.capture?.success) {
          addLog(`[捕獲] ${event.combat.capture.captured?.id}を捕獲！`)
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
        addLog(`[帰還] ${reason}`)
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
    isCompletedRef.current = false
    processedEventIdsRef.current.clear()

    const tempLogs: string[] = []
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

      processedEventIdsRef.current.add(getEventId(index, event))

      switch (event.type) {
        case 'move_start': {
          tempLogs.push(`[${formatTimeLocal(event.at)}] [探索] ${event.floor}階の探索を開始`)
          break
        }
        case 'floor_up': {
          tempFloor = event.to
          tempLogs.push(`[${formatTimeLocal(event.at)}] [移動] ${event.from}階から${event.to}階へ移動`)
          break
        }
        case 'battle':
        case 'boss': {
          const battleType = event.type === 'boss' ? '[BOSS]' : '[戦闘]'
          const result = event.combat.outcome === 'win' ? '勝利' : '敗北'
          tempLogs.push(`[${formatTimeLocal(event.at)}] ${battleType} ${event.enemy.name} Lv${event.enemy.lvl} ×${event.enemy.count}体と遭遇 → ${result}`)

          if (event.combat.allyHPDelta) {
            event.combat.allyHPDelta.forEach((delta, idx) => {
              tempPartyHp[idx] = Math.max(0, tempPartyHp[idx] + delta)
            })
          }

          if (event.xp > 0) {
            tempLogs.push(`[${formatTimeLocal(event.at)}] [経験値] ${event.xp}XP獲得`)
          }

          if (event.combat.capture?.success) {
            tempLogs.push(`[${formatTimeLocal(event.at)}] [捕獲] ${event.combat.capture.captured?.id}を捕獲！`)
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
          tempLogs.push(`[${formatTimeLocal(event.at)}] [帰還] ${reason}`)
          break
        }
      }
    })

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
          const eventId = getEventId(index, event)
          if (!processedEventIdsRef.current.has(eventId) && event.at <= newTime) {
            processEvent(event, eventId)
          }
        })

        // 完了判定
        if (newTime >= expeditionReplay.durationSec && !isCompletedRef.current) {
          isCompletedRef.current = true
          setIsPlaying(false)
          setTimeout(() => onComplete(), 1000)
        }

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
  }, [isPlaying, speed, processEvent, onComplete, expeditionReplay.durationSec, expeditionReplay.events])

  const handleSpeedChange = (newSpeed: PlaybackSpeed) => {
    setSpeed(newSpeed)
  }

  const handleSkip = () => {
    setCurrentTime(expeditionReplay.durationSec)
    setIsPlaying(false)

    expeditionReplay.events.forEach((event, index) => {
      const eventId = getEventId(index, event)
      if (!processedEventIdsRef.current.has(eventId)) {
        processEvent(event, eventId)
      }
    })

    setTimeout(() => onComplete(), 500)
  }

  const handleAbort = () => {
    setIsPlaying(false)
    const abortEvent: TimelineEvent = {
      type: 'return',
      at: currentTime,
      reason: 'abort' as const
    }
    const eventId = `abort-${currentTime}`
    processEvent(abortEvent, eventId)
    setTimeout(() => onComplete(), 500)
  }

  const progress = (currentTime / expeditionReplay.durationSec) * 100

  return (
    <div className="h-full flex flex-col">
      {/* ヘッダー */}
      <div className="bg-gray-800 text-white p-3 shadow-lg">
        <div className="flex justify-between items-center">
          <div className="text-sm font-bold">
            {expeditionReplay.meta.areaName} - {currentFloor}階
          </div>
          <div className="text-xs">
            {formatTime(currentTime)} / {formatTime(expeditionReplay.durationSec)}
          </div>
        </div>

        {/* プログレスバー */}
        <div className="mt-2 bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gray-400 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* パーティ状態 */}
      <div className="bg-gray-100 border-b-2 border-gray-300 p-3">
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
                className={`bg-white rounded-lg p-2 border ${isKO ? 'border-gray-500 opacity-50' : 'border-gray-300'}`}
              >
                <div className="flex items-center gap-1 mb-1">
                  <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                    <img src={goblin?.avatar} alt={goblin?.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="text-xs font-medium truncate flex-1">
                    {goblin?.name || `ID:${memberId}`}
                  </div>
                </div>
                <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${isKO ? 'bg-gray-400' : hpPercent > 50 ? 'bg-gray-700' : hpPercent > 25 ? 'bg-gray-500' : 'bg-gray-400'}`}
                    style={{ width: `${hpPercent}%` }}
                  />
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  HP: {currentHp}/{maxHp}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* イベントログ */}
      <div className="flex-1 overflow-hidden bg-white">
        <div
          ref={logContainerRef}
          className="h-full overflow-y-auto p-4 space-y-1"
        >
          {eventLog.map((log, idx) => (
            <div key={idx} className="text-sm text-gray-700 font-mono">
              {log}
            </div>
          ))}
        </div>
      </div>

      {/* コントロールボタン */}
      <div className="bg-gray-100 border-t-2 border-gray-300 p-3">
        <div className="flex justify-between items-center mb-2">
          <div className="flex gap-2">
            {([1, 2, 4] as const).map(s => (
              <button
                key={s}
                onClick={() => handleSpeedChange(s)}
                disabled={!isPlaying}
                className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
                  speed === s && isPlaying
                    ? 'bg-gray-700 text-white'
                    : isPlaying
                    ? 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                ×{s}
              </button>
            ))}
          </div>

          <button
            onClick={handleSkip}
            disabled={!isPlaying}
            className={`px-4 py-1 rounded text-sm font-bold transition-colors ${
              isPlaying
                ? 'bg-gray-600 text-white hover:bg-gray-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            スキップ
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={currentTime >= expeditionReplay.durationSec}
            className={`flex-1 py-2 rounded font-bold transition-colors ${
              currentTime >= expeditionReplay.durationSec
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : isPlaying
                ? 'bg-gray-500 text-white hover:bg-gray-600'
                : 'bg-gray-700 text-white hover:bg-gray-800'
            }`}
          >
            {isPlaying ? '一時停止' : '再開'}
          </button>

          <button
            onClick={handleAbort}
            disabled={!isPlaying}
            className={`px-6 py-2 rounded font-bold transition-colors ${
              isPlaying
                ? 'bg-gray-800 text-white hover:bg-gray-900'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            緊急帰還
          </button>
        </div>
      </div>
    </div>
  )
}
