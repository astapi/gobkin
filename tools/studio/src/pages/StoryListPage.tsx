import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import type { StorySummary } from '../lib/schema'

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; data: StorySummary[] }
  | { kind: 'error'; message: string }

export function StoryListPage() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/stories')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as StorySummary[]
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
    <div className="panel-stack">
      <div className="list-header">
        <div>
          <h2 className="page-title">ストーリー</h2>
          <p className="subtle">`stories.json` を一覧・編集します。</p>
        </div>
        <Link to="/stories/new" className="btn primary">
          新規ストーリー
        </Link>
      </div>

      <table className="dungeon-table">
        <thead>
          <tr>
            <th>id</th>
            <th>タイトル</th>
            <th>種別</th>
            <th className="num">order</th>
            <th>解放条件</th>
            <th className="num">章数</th>
            <th className="num">報酬数</th>
          </tr>
        </thead>
        <tbody>
          {state.data.map((story) => (
            <tr key={story.id}>
              <td>
                <Link to={`/stories/${story.id}`}>{story.id}</Link>
              </td>
              <td>{story.title}</td>
              <td>{story.category}</td>
              <td className="num">{story.order}</td>
              <td>{story.unlockLabel}</td>
              <td className="num">{story.chapterCount}</td>
              <td className="num">{story.rewardCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
