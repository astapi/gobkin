import { useMemo } from 'react'

import type { SimulationResult } from '../lib/runExpedition'

export function SimulationResultView({ result }: { result: SimulationResult }) {
  const divisor = Math.max(1, result.trials - result.errors.length)
  const successRate = result.success / divisor
  const defeatedRate = result.defeated / divisor
  const policyRate = result.policyReturned / divisor
  const abortedRate = result.aborted / divisor

  const floorEntries = useMemo(() => {
    return Object.entries(result.floorDistribution)
      .map(([floor, count]) => ({ floor: Number(floor), count }))
      .sort((a, b) => a.floor - b.floor)
  }, [result.floorDistribution])

  const casualtyEntries = useMemo(() => {
    return Object.entries(result.casualtyCounts)
      .map(([name, count]) => ({ name, count, rate: count / divisor }))
      .sort((a, b) => b.count - a.count)
  }, [result.casualtyCounts, divisor])

  const maxFloorCount = Math.max(1, ...floorEntries.map((e) => e.count))

  return (
    <section className="card">
      <h2>シミュレーション結果</h2>
      <p className="subtle">
        試行 {result.trials} 回
        {result.errors.length > 0 ? ` / エラー ${result.errors.length}` : ''}
      </p>
      <div className="result-metrics">
        <Metric label="成功率" value={fmtPct(successRate)} sub={`${result.success} 回`} />
        <Metric label="全滅率" value={fmtPct(defeatedRate)} sub={`${result.defeated} 回`} />
        <Metric label="帰還率" value={fmtPct(policyRate)} sub={`${result.policyReturned} 回`} />
        <Metric label="中断" value={fmtPct(abortedRate)} sub={`${result.aborted} 回`} />
        <Metric label="平均到達階" value={result.avgMaxFloor.toFixed(2)} />
        <Metric label="平均XP" value={Math.round(result.avgXpGained).toString()} />
        <Metric label="平均Gold" value={Math.round(result.avgGoldGained).toString()} />
        <Metric label="平均所要時間" value={`${Math.round(result.avgDurationSec)}s`} />
      </div>

      <h3>到達階層分布</h3>
      <div className="floor-hist">
        {floorEntries.map((entry) => {
          const pct = entry.count / divisor
          const width = (entry.count / maxFloorCount) * 100
          return (
            <div key={entry.floor} className="floor-hist-row">
              <span className="floor-hist-label">{entry.floor}F</span>
              <div className="floor-hist-bar">
                <span className="floor-hist-fill" style={{ width: `${width}%` }} />
              </div>
              <span className="floor-hist-value">
                {entry.count} <span className="subtle">({fmtPct(pct)})</span>
              </span>
            </div>
          )
        })}
      </div>

      {casualtyEntries.length > 0 && (
        <>
          <h3>ゴブリン別死亡回数</h3>
          <table className="enemy-table">
            <thead>
              <tr>
                <th>ゴブリン名</th>
                <th className="num">死亡回数</th>
                <th className="num">死亡率</th>
              </tr>
            </thead>
            <tbody>
              {casualtyEntries.map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td className="num">{c.count}</td>
                  <td className="num">{fmtPct(c.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {result.errors.length > 0 && (
        <>
          <h3>エラー</h3>
          <ul className="error-list">
            {result.errors.slice(0, 5).map((e, i) => (
              <li key={i} className="save-error">{e}</li>
            ))}
            {result.errors.length > 5 && (
              <li className="subtle">… 他 {result.errors.length - 5} 件</li>
            )}
          </ul>
        </>
      )}
    </section>
  )
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {sub && <div className="metric-sub subtle">{sub}</div>}
    </div>
  )
}

function fmtPct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`
}
