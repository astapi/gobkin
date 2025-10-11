import { useState, useEffect, useRef, useCallback } from 'react'
import type { ExpeditionReplay, TimelineEvent, Goblin } from '../shared/types'

interface ExpeditionPlaybackScreenProps {
  expeditionReplay: ExpeditionReplay
  goblins: Goblin[]
  onComplete: () => void
  startTime?: Date
}

type PlaybackSpeed = 1 | 2 | 4

interface ProcessedEvent {
  event: TimelineEvent
  processed: boolean
}

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
  const [processedEvents, setProcessedEvents] = useState<ProcessedEvent[]>(() =>
    expeditionReplay.events.map(event => ({ event, processed: event.at <= initialTime }))
  )
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
      case 'move_start':
        addLog(`🚶 ${event.floor}階の探索を開始`)
        break
      case 'floor_up':
        setCurrentFloor(event.to)
        addLog(`⬆️ ${event.from}階から${event.to}階へ移動`)
        break
      case 'battle':
      case 'boss':
        const battleType = event.type === 'boss' ? '👹 ボス' : '⚔️'
        const result = event.combat.outcome === 'win' ? '勝利' : '敗北'
        addLog(`${battleType} ${event.enemy.name} Lv${event.enemy.lvl} ×${event.enemy.count}体と遭遇 → ${result}`)

        if (event.combat.allyHPDelta) {
          const newHp = [...partyHp]
          event.combat.allyHPDelta.forEach((delta, idx) => {
            newHp[idx] = Math.max(0, newHp[idx] + delta)
          })
          setPartyHp(newHp)
        }

        if (event.xp > 0) {
          addLog(`✨ ${event.xp}XP獲得`)
        }

        if (event.combat.capture?.success) {
          addLog(`🎯 ${event.combat.capture.captured?.id}を捕獲！`)
        }
        break
      case 'resource':
        if (event.loot && event.loot.length > 0) {
          const items = event.loot.map(drop => `${drop.id} x${drop.qty}`).join(', ')
          addLog(`📦 資源発見: ${items}`)
        }
        break
      case 'trap':
        addLog(`⚠️ 罠にかかった: ${event.trapId}`)
        break
      case 'return':
        let reason = '探索完了'
        switch (event.reason) {
          case 'boss_clear':
            reason = 'ボス撃破により帰還'
            break
          case 'if_any_ko':
            reason = '仲間が倒れたため帰還'
            break
          case 'last_one':
            reason = '最後の1人になったため帰還'
            break
          case 'until_floorN':
            reason = '目標階層到達により帰還'
            break
          case 'lose':
            reason = '全滅により撤退'
            break
          case 'abort':
            reason = '緊急帰還'
            break
        }
        addLog(`🏠 ${reason}`)
        break
    }
  }, [addLog, partyHp])

  // 初期化時に経過済みイベントを即座に処理
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true
      isCompletedRef.current = false
      processedEventIdsRef.current.clear()

      // initialTime以前のイベントを即座に処理
      const pastEvents = expeditionReplay.events.filter(event => event.at <= initialTime)

      let tempPartyHp = [...partyHp]
      let tempFloor = 1
      const tempLogs: string[] = []

      pastEvents.forEach((event, index) => {
        const eventId = `${index}-${event.type}-${event.at}`
        processedEventIdsRef.current.add(eventId)

        const formatTimeLocal = (seconds: number): string => {
          const mins = Math.floor(seconds / 60)
          const secs = Math.floor(seconds % 60)
          return `${mins}:${secs.toString().padStart(2, '0')}`
        }

        switch (event.type) {
          case 'move_start':
            tempLogs.push(`[${formatTimeLocal(event.at)}] 🚶 ${event.floor}階の探索を開始`)
            break
          case 'floor_up':
            tempFloor = event.to
            tempLogs.push(`[${formatTimeLocal(event.at)}] ⬆️ ${event.from}階から${event.to}階へ移動`)
            break
          case 'battle':
          case 'boss':
            const battleType = event.type === 'boss' ? '👹 ボス' : '⚔️'
            const result = event.combat.outcome === 'win' ? '勝利' : '敗北'
            tempLogs.push(`[${formatTimeLocal(event.at)}] ${battleType} ${event.enemy.name} Lv${event.enemy.lvl} ×${event.enemy.count}体と遭遇 → ${result}`)

            if (event.combat.allyHPDelta) {
              event.combat.allyHPDelta.forEach((delta, idx) => {
                tempPartyHp[idx] = Math.max(0, tempPartyHp[idx] + delta)
              })
            }

            if (event.xp > 0) {
              tempLogs.push(`[${formatTimeLocal(event.at)}] ✨ ${event.xp}XP獲得`)
            }

            if (event.combat.capture?.success) {
              tempLogs.push(`[${formatTimeLocal(event.at)}] 🎯 ${event.combat.capture.captured?.id}を捕獲！`)
            }
            break
          case 'resource':
            if (event.loot && event.loot.length > 0) {
              const items = event.loot.map(drop => `${drop.id} x${drop.qty}`).join(', ')
              tempLogs.push(`[${formatTimeLocal(event.at)}] 📦 資源発見: ${items}`)
            }
            break
          case 'trap':
            tempLogs.push(`[${formatTimeLocal(event.at)}] ⚠️ 罠にかかった: ${event.trapId}`)
            break
          case 'return':
            let reason = '探索完了'
            switch (event.reason) {
              case 'boss_clear':
                reason = 'ボス撃破により帰還'
                break
              case 'if_any_ko':
                reason = '仲間が倒れたため帰還'
                break
              case 'last_one':
                reason = '最後の1人になったため帰還'
                break
              case 'until_floorN':
                reason = '目標階層到達により帰還'
                break
              case 'lose':
                reason = '全滅により撤退'
                break
              case 'abort':
                reason = '緊急帰還'
                break
            }
            tempLogs.push(`[${formatTimeLocal(event.at)}] 🏠 ${reason}`)
            break
        }
      })

      setPartyHp(tempPartyHp)
      setCurrentFloor(tempFloor)
      setEventLog(tempLogs)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // アニメーションループ（初期化後に実行）
    if (!isInitializedRef.current) return

    if (!isPlaying) return

    const animate = (currentTimeStamp: number) => {
      const deltaTime = (currentTimeStamp - lastTimeRef.current) / 1000
      lastTimeRef.current = currentTimeStamp

      setCurrentTime(prevTime => {
        const newTime = Math.min(prevTime + deltaTime * speed, expeditionReplay.durationSec)

        // イベント処理
        setProcessedEvents(prevEvents => {
          const updated = [...prevEvents]
          let hasChanges = false

          for (let i = 0; i < updated.length; i++) {
            if (!updated[i].processed && updated[i].event.at <= newTime) {
              const eventId = `${i}-${updated[i].event.type}-${updated[i].event.at}`
              processEvent(updated[i].event, eventId)
              updated[i] = { ...updated[i], processed: true }
              hasChanges = true
            }
          }

          return hasChanges ? updated : prevEvents
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
  }, [isPlaying, speed, processEvent, onComplete, expeditionReplay.durationSec])

  const handleSpeedChange = (newSpeed: PlaybackSpeed) => {
    setSpeed(newSpeed)
  }

  const handleSkip = () => {
    setCurrentTime(expeditionReplay.durationSec)
    setIsPlaying(false)

    processedEvents.forEach(({ event, processed }, index) => {
      if (!processed) {
        const eventId = `${index}-${event.type}-${event.at}`
        processEvent(event, eventId)
      }
    })

    setProcessedEvents(prev => prev.map(item => ({ ...item, processed: true })))
    setTimeout(() => onComplete(), 500)
  }

  const handleAbort = () => {
    setIsPlaying(false)
    const abortEvent: TimelineEvent = {
      type: 'return',
      at: currentTime,
      reason: 'abort'
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
            🏰 {expeditionReplay.meta.areaName} - {currentFloor}階
          </div>
          <div className="text-xs">
            {formatTime(currentTime)} / {formatTime(expeditionReplay.durationSec)}
          </div>
        </div>

        {/* プログレスバー */}
        <div className="mt-2 bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-100 ease-linear"
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
                className={`bg-white rounded-lg p-2 border ${isKO ? 'border-red-400 opacity-50' : 'border-gray-300'}`}
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
                    className={`h-full transition-all duration-300 ${isKO ? 'bg-red-500' : hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
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
                    ? 'bg-blue-600 text-white'
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
            スキップ ≫
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
                ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            {isPlaying ? '⏸ 一時停止' : '▶ 再開'}
          </button>

          <button
            onClick={handleAbort}
            disabled={!isPlaying}
            className={`px-6 py-2 rounded font-bold transition-colors ${
              isPlaying
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            🚨 緊急帰還
          </button>
        </div>
      </div>
    </div>
  )
}