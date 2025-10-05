import { useState, useEffect, useRef, useCallback } from 'react'
import type { ExpeditionReplay, TimelineEvent, Goblin, BattleLogEntry } from '../types/index.ts'

interface ExpeditionLogScreenProps {
  expeditionReplay: ExpeditionReplay
  goblins: Goblin[]
  startTime?: Date
}

type PlaybackSpeed = 1 | 2 | 4

interface ProcessedEvent {
  event: TimelineEvent
  processed: boolean
}

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
  const [processedEvents, setProcessedEvents] = useState<ProcessedEvent[]>(() =>
    expeditionReplay.events.map(event => ({ event, processed: event.at <= initialTime }))
  )
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
  const processedEventIdsRef = useRef<Set<string>>(new Set())
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
        addLog(
          `${battleType} ${event.enemy.name} Lv${event.enemy.lvl} ×${event.enemy.count}体と遭遇 → ${result}`,
          event.combat.detailedLog,
          'battle'
        )

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
      processedEventIdsRef.current.clear()

      // initialTime以前のイベントを即座に処理
      const pastEvents = expeditionReplay.events.filter(event => event.at <= initialTime)

      let tempPartyHp = [...partyHp]
      let tempFloor = 1
      const tempLogs: LogEntry[] = []

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
            tempLogs.push({ message: `[${formatTimeLocal(event.at)}] 🚶 ${event.floor}階の探索を開始` })
            break
          case 'floor_up':
            tempFloor = event.to
            tempLogs.push({ message: `[${formatTimeLocal(event.at)}] ⬆️ ${event.from}階から${event.to}階へ移動` })
            break
          case 'battle':
          case 'boss':
            const battleType = event.type === 'boss' ? '👹 ボス' : '⚔️'
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
              tempLogs.push({ message: `[${formatTimeLocal(event.at)}] ✨ ${event.xp}XP獲得` })
            }

            if (event.combat.capture?.success) {
              tempLogs.push({ message: `[${formatTimeLocal(event.at)}] 🎯 ${event.combat.capture.captured?.id}を捕獲！` })
            }
            break
          case 'resource':
            if (event.loot && event.loot.length > 0) {
              const items = event.loot.map(drop => `${drop.id} x${drop.qty}`).join(', ')
              tempLogs.push({ message: `[${formatTimeLocal(event.at)}] 📦 資源発見: ${items}` })
            }
            break
          case 'trap':
            tempLogs.push({ message: `[${formatTimeLocal(event.at)}] ⚠️ 罠にかかった: ${event.trapId}` })
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
            tempLogs.push({ message: `[${formatTimeLocal(event.at)}] 🏠 ${reason}` })
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
  }, [isPlaying, speed, processEvent, expeditionReplay.durationSec])

  const progress = (currentTime / expeditionReplay.durationSec) * 100

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div className="p-3 text-white bg-gray-800 shadow-lg">
        <div className="flex justify-between items-center">
          <div className="text-sm font-bold">
            🏰 {expeditionReplay.meta.areaName} - {currentFloor}階
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
                <span className="ml-2 text-xs text-blue-500">📋 詳細</span>
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
              <h3 className="font-bold">⚔️ 戦闘ログ</h3>
              <button
                onClick={() => setSelectedBattleLog(null)}
                className="text-white hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {selectedBattleLog.map((entry, idx) => (
                <div
                  key={idx}
                  className={`text-sm p-2 rounded ${
                    entry.isAlly ? 'bg-blue-50' : 'bg-red-50'
                  }`}
                >
                  <div className="font-mono">
                    <span className="font-bold text-gray-600">Turn {entry.turn}:</span>
                    {' '}
                    <span className={entry.isAlly ? 'text-blue-700' : 'text-red-700'}>
                      {entry.actorName}
                    </span>
                    {' → '}
                    <span className={entry.isAlly ? 'text-red-700' : 'text-blue-700'}>
                      {entry.targetName}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    {entry.action}
                    {entry.damage && ` | ${entry.damage}ダメージ`}
                    {entry.healing && ` | ${entry.healing}回復`}
                    {entry.targetDefeated && ' | 撃破！'}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {entry.actorName}: {entry.actorHP}HP
                    {entry.targetHP !== undefined && ` | ${entry.targetName}: ${entry.targetHP}HP`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
