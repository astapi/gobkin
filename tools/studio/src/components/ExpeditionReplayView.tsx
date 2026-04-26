import { useState } from 'react'

import type {
  BattleLogEntry,
  CombatReplay,
  ExpeditionReplay,
  TimelineEvent,
} from '@app/shared/types'

import type { SingleRunResult } from '../lib/runExpedition'

export function ExpeditionReplayView({ result }: { result: SingleRunResult }) {
  const { replay, seed } = result
  const summary = replay.summary
  const lastEvent = replay.events[replay.events.length - 1]
  const endReason =
    lastEvent && lastEvent.type === 'return' ? lastEvent.reason : null

  return (
    <section className="card">
      <h2>単発シミュレーション結果</h2>
      <p className="subtle">
        seed: <code>{seed}</code> / 所要時間 {Math.round(replay.durationSec)}s /
        到達 {summary.maxFloorReached}F /
        XP {summary.xpGained} / Gold {summary.goldGained}
        {endReason ? ` / 終了理由: ${endReason}` : ''}
        {summary.casualties.length > 0
          ? ` / 戦闘不能: ${summary.casualties.join(', ')}`
          : ''}
      </p>

      <h3>タイムライン ({replay.events.length} 件)</h3>
      <ul className="replay-timeline">
        {replay.events.map((event, idx) => (
          <TimelineEventRow key={idx} event={event} index={idx} />
        ))}
      </ul>
    </section>
  )
}

function TimelineEventRow({
  event,
  index,
}: {
  event: TimelineEvent
  index: number
}) {
  const at = `${Math.round(event.at)}s`
  switch (event.type) {
    case 'move_start':
      return (
        <li className="replay-row">
          <span className="replay-time">{at}</span>
          <span className="replay-tag">出発</span>
          <span>{event.floor}F に向かう</span>
        </li>
      )
    case 'floor_up':
      return (
        <li className="replay-row">
          <span className="replay-time">{at}</span>
          <span className="replay-tag">階移動</span>
          <span>
            {event.from}F → {event.to}F
          </span>
        </li>
      )
    case 'exploring':
      return (
        <li className="replay-row">
          <span className="replay-time">{at}</span>
          <span className="replay-tag">探索</span>
          <span>{event.floor}F</span>
        </li>
      )
    case 'treasure':
      return (
        <li className="replay-row">
          <span className="replay-time">{at}</span>
          <span className="replay-tag">宝箱</span>
          <span>
            {event.floor}F /{' '}
            {event.items
              .map((it) =>
                it.titleId ? `${it.titleId}/${it.templateId}` : it.templateId,
              )
              .join(', ')}
          </span>
        </li>
      )
    case 'return':
      return (
        <li className="replay-row">
          <span className="replay-time">{at}</span>
          <span className="replay-tag end">帰還</span>
          <span>{event.reason}</span>
        </li>
      )
    case 'battle':
    case 'boss':
      return (
        <BattleEventRow event={event} at={at} index={index} />
      )
  }
}

function BattleEventRow({
  event,
  at,
  index,
}: {
  event: Extract<TimelineEvent, { type: 'battle' | 'boss' }>
  at: string
  index: number
}) {
  const [open, setOpen] = useState(false)
  const tag = event.type === 'boss' ? 'BOSS' : '戦闘'
  const outcome = event.combat.outcome
  const enemy = event.enemy
  const log = event.combat.detailedLog ?? []

  return (
    <li className={`replay-row battle ${outcome}`}>
      <div className="replay-summary" onClick={() => setOpen((o) => !o)}>
        <span className="replay-time">{at}</span>
        <span className={`replay-tag ${event.type}`}>{tag}</span>
        <span className="replay-battle-summary">
          {event.floor}F / vs <strong>{enemy.name}</strong> Lv{enemy.lvl} ×
          {enemy.count} ／ 結果:{' '}
          <strong className={`outcome ${outcome}`}>{outcome}</strong> ／{' '}
          {event.combat.rounds}ラウンド ／ XP +{event.xp}
        </span>
        <button
          className="btn ghost small"
          onClick={(e) => {
            e.stopPropagation()
            setOpen((o) => !o)
          }}
        >
          {open ? 'ログを閉じる' : `ログを開く (${log.length})`}
        </button>
      </div>
      {open && (
        <CombatLogTable
          log={log}
          combat={event.combat}
          eventIndex={index}
        />
      )}
    </li>
  )
}

function CombatLogTable({
  log,
  combat,
  eventIndex,
}: {
  log: BattleLogEntry[]
  combat: CombatReplay
  eventIndex: number
}) {
  if (log.length === 0) {
    return (
      <div className="replay-combat-empty subtle">
        詳細ログが記録されていません（ラウンド数: {combat.rounds}）
      </div>
    )
  }

  let lastTurn = -1
  return (
    <div className="replay-combat-log">
      <table className="enemy-table replay-combat-table">
        <thead>
          <tr>
            <th className="num">T</th>
            <th>行動者</th>
            <th>行動</th>
            <th>ターゲット / 結果</th>
            <th className="num">HP</th>
          </tr>
        </thead>
        <tbody>
          {log.map((entry, i) => {
            const newTurn = entry.turn !== lastTurn
            lastTurn = entry.turn
            return (
              <tr
                key={`${eventIndex}-${i}`}
                className={`${entry.isAlly ? 'ally' : 'enemy'} ${
                  newTurn ? 'turn-start' : ''
                } ${entry.isCritical ? 'critical' : ''}`}
              >
                <td className="num">{entry.turn}</td>
                <td>
                  <span
                    className={`replay-actor-row r${entry.actorRow}`}
                    title={`row ${entry.actorRow}`}
                  >
                    {entry.actorName}
                  </span>
                </td>
                <td>
                  {entry.action}
                  {entry.isCritical ? ' ★' : ''}
                  {entry.actionEffect ? ` (${entry.actionEffect})` : ''}
                </td>
                <td>
                  {entry.targets.length === 0 ? (
                    <span className="subtle">—</span>
                  ) : (
                    <ul className="replay-targets">
                      {entry.targets.map((t, ti) => (
                        <li key={ti}>
                          <span>{t.targetName}</span>
                          <span className="subtle">
                            {' '}
                            ({t.hitCount}/{entry.attackCount} 命中)
                          </span>{' '}
                          <strong
                            className={
                              t.totalDamage > 0
                                ? 'damage'
                                : t.totalDamage < 0
                                ? 'heal'
                                : 'subtle'
                            }
                          >
                            {t.totalDamage > 0
                              ? `${t.totalDamage} dmg`
                              : t.totalDamage < 0
                              ? `+${-t.totalDamage} heal`
                              : '0'}
                          </strong>
                          {t.defeated && (
                            <span className="badge danger"> 撃破</span>
                          )}
                          <span className="subtle"> HP {t.targetHP}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="num">
                  {entry.actorHP}/{entry.actorMaxHP}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export type { ExpeditionReplay }
