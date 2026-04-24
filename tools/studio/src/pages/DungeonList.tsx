import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import type { DungeonSummary } from '../lib/schema'

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; data: DungeonSummary[] }
  | { kind: 'error'; message: string }

export function DungeonList() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/dungeons')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as DungeonSummary[]
        if (!cancelled) setState({ kind: 'ready', data })
      } catch (err) {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: err instanceof Error ? err.message : String(err),
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (state.kind === 'loading') return <p className="state-msg">読み込み中…</p>
  if (state.kind === 'error') {
    return <p className="state-msg error">読み込みに失敗しました: {state.message}</p>
  }

  return (
    <table className="dungeon-table">
      <thead>
        <tr>
          <th>areaId</th>
          <th>名前</th>
          <th className="num">Lv</th>
          <th className="num">階層</th>
          <th className="num">所要時間(s)</th>
          <th className="num">敵種類</th>
          <th className="num">パターン</th>
        </tr>
      </thead>
      <tbody>
        {state.data.map((d) => (
          <tr key={d.areaId}>
            <td>
              <Link to={`/dungeons/${d.areaId}`}>{d.areaId}</Link>
            </td>
            <td>{d.name}</td>
            <td className="num">{d.areaLevel}</td>
            <td className="num">{d.floors}</td>
            <td className="num">{d.baseDurationSec}</td>
            <td className="num">{d.enemyCount}</td>
            <td className="num">{d.patternCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
