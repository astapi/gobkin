import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import type { DungeonSummary } from '../lib/schema'
import {
  RETURN_POLICIES,
  runSimulationBatch,
  runSingleExpedition,
  type ReturnPolicy,
  type SimulationResult,
  type SingleRunResult,
} from '../lib/runExpedition'
import type { BackupGoblin } from '../lib/goblinMapper'
import { usePartyStore } from '../stores/partyStore'
import { SimulationResultView } from '../components/SimulationResultView'
import { ExpeditionReplayView } from '../components/ExpeditionReplayView'

type PartySource = 'draft' | `preset:${string}` | `library:${number}`
type RunMode = 'batch' | 'single'

const TRIAL_OPTIONS = [50, 200, 500, 1000, 3000]

export function SimulatePage() {
  const { library, draft, presets } = usePartyStore()
  const hasCharacters = library.goblins.length > 0

  const [dungeons, setDungeons] = useState<DungeonSummary[]>([])
  const [dungeonsError, setDungeonsError] = useState<string | null>(null)
  const [areaId, setAreaId] = useState<string>('')
  const [tier, setTier] = useState<number>(0)
  const [returnPolicy, setReturnPolicy] = useState<ReturnPolicy>('never')
  const [trials, setTrials] = useState<number>(200)
  const [seedMode, setSeedMode] = useState<'random' | 'fixed'>('random')
  const [fixedSeed, setFixedSeed] = useState<number>(1)
  const [partySource, setPartySource] = useState<PartySource>('draft')
  const [runMode, setRunMode] = useState<RunMode>('batch')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null)
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [singleResult, setSingleResult] = useState<SingleRunResult | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/dungeons')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as DungeonSummary[]
        if (cancelled) return
        setDungeons(data)
        if (data.length > 0 && !areaId) setAreaId(data[0].areaId)
      } catch (err) {
        if (!cancelled) {
          setDungeonsError(err instanceof Error ? err.message : String(err))
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resolvedParty = useMemo<BackupGoblin[]>(() => {
    let ids: number[] = []
    if (partySource === 'draft') {
      ids = draft.members.filter((m): m is number => m !== null)
    } else if (partySource.startsWith('preset:')) {
      ids =
        presets.find((p) => p.id === partySource.slice('preset:'.length))
          ?.memberIds ?? []
    } else if (partySource.startsWith('library:')) {
      const partyId = Number(partySource.slice('library:'.length))
      ids = library.parties.find((p) => p.id === partyId)?.memberIds ?? []
    }
    return ids
      .map((id) => library.goblins.find((g) => g.id === id))
      .filter((g): g is BackupGoblin => g !== undefined)
  }, [library, draft, presets, partySource])

  const canRun =
    !running &&
    areaId !== '' &&
    resolvedParty.length > 0 &&
    (runMode === 'single' || trials > 0) &&
    hasCharacters

  const runSimulation = useCallback(async () => {
    setRunning(true)
    setResult(null)
    setSingleResult(null)
    setRunError(null)
    try {
      if (runMode === 'single') {
        const single = await runSingleExpedition({
          areaId,
          party: resolvedParty,
          tier: tier as never,
          returnPolicy,
          seed: seedMode === 'fixed' ? fixedSeed : undefined,
        })
        setSingleResult(single)
      } else {
        setProgress({ completed: 0, total: trials })
        const res = await runSimulationBatch({
          areaId,
          party: resolvedParty,
          trials,
          tier: tier as never,
          returnPolicy,
          seed: seedMode === 'fixed' ? fixedSeed : undefined,
          onProgress: (completed, total) => setProgress({ completed, total }),
        })
        setResult(res)
      }
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }, [
    runMode,
    areaId,
    resolvedParty,
    trials,
    tier,
    returnPolicy,
    seedMode,
    fixedSeed,
  ])

  if (!hasCharacters) {
    return (
      <div className="panel-stack">
        <section className="card">
          <h2>シミュレーション</h2>
          <p className="subtle">
            シミュレーションにはキャラクター情報が必要です。まず{' '}
            <Link to="/party">PT編成</Link> 画面でバックアップ JSON を取り込んでください。
            一度取り込めばローカルに保存され、以降はバックアップ無しで利用できます。
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="simulate-layout">
      <section className="card simulate-controls">
        <h2>シミュレーション設定</h2>
        <div className="field-group" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <label className="field">
            <span className="field-label">ダンジョン</span>
            <span className="field-input">
              <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                {dungeons.map((d) => (
                  <option key={d.areaId} value={d.areaId}>
                    Lv{d.areaLevel} · {d.name}（{d.areaId}）
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label className="field">
            <span className="field-label">Tier</span>
            <span className="field-input">
              <select value={tier} onChange={(e) => setTier(Number(e.target.value))}>
                {[0, 1, 2, 3].map((t) => (
                  <option key={t} value={t}>
                    Tier {t}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label className="field">
            <span className="field-label">帰還ポリシー</span>
            <span className="field-input">
              <select
                value={returnPolicy}
                onChange={(e) => setReturnPolicy(e.target.value as ReturnPolicy)}
              >
                {RETURN_POLICIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label className="field">
            <span className="field-label">実行モード</span>
            <span className="field-input">
              <select
                value={runMode}
                onChange={(e) => setRunMode(e.target.value as RunMode)}
              >
                <option value="batch">バッチ（統計を取る）</option>
                <option value="single">単発（戦闘ログを見る）</option>
              </select>
            </span>
          </label>
          <label className="field">
            <span className="field-label">試行回数</span>
            <span className="field-input">
              <select
                value={trials}
                onChange={(e) => setTrials(Number(e.target.value))}
                disabled={runMode === 'single'}
                title={runMode === 'single' ? '単発モードでは1回固定です' : undefined}
              >
                {TRIAL_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label className="field">
            <span className="field-label">シード</span>
            <span className="field-input">
              <select
                value={seedMode}
                onChange={(e) => setSeedMode(e.target.value as 'random' | 'fixed')}
              >
                <option value="random">ランダム</option>
                <option value="fixed">固定</option>
              </select>
              {seedMode === 'fixed' && (
                <input
                  type="number"
                  value={fixedSeed}
                  min={0}
                  onChange={(e) => setFixedSeed(Number(e.target.value) || 0)}
                />
              )}
            </span>
          </label>
          <label className="field">
            <span className="field-label">PT</span>
            <span className="field-input">
              <select
                value={partySource}
                onChange={(e) => setPartySource(e.target.value as PartySource)}
              >
                <option value="draft">
                  編集中のPT（{draft.members.filter((m) => m !== null).length}体）
                </option>
                {library.parties.map((p) => (
                  <option key={`library-${p.id}`} value={`library:${p.id}`}>
                    [取込PT] {p.name}（{p.memberIds.length}体）
                  </option>
                ))}
                {presets.map((p) => (
                  <option key={p.id} value={`preset:${p.id}`}>
                    [プリセット] {p.name}（{p.memberIds.length}体）
                  </option>
                ))}
              </select>
            </span>
          </label>
        </div>
        <PartyPreview party={resolvedParty} />
        {dungeonsError && <p className="save-error">{dungeonsError}</p>}
        {runError && <p className="save-error">{runError}</p>}
        <div className="simulate-actions">
          {running && runMode === 'batch' && progress && (
            <span className="subtle">
              実行中… {progress.completed} / {progress.total}
            </span>
          )}
          {running && runMode === 'single' && (
            <span className="subtle">実行中…</span>
          )}
          <button
            className="btn primary"
            onClick={runSimulation}
            disabled={!canRun}
          >
            {running
              ? '実行中…'
              : runMode === 'single'
              ? '単発実行（ログ取得）'
              : 'シミュレーション実行'}
          </button>
        </div>
      </section>

      {result && <SimulationResultView result={result} />}
      {singleResult && <ExpeditionReplayView result={singleResult} />}
    </div>
  )
}

function PartyPreview({ party }: { party: BackupGoblin[] }) {
  if (party.length === 0) {
    return <p className="save-error">PTにゴブリンが割り当てられていません</p>
  }
  return (
    <div className="party-preview-list">
      {party.map((g) => (
        <div key={g.id} className="party-preview-chip">
          <strong>{g.name}</strong>
          <span className="subtle"> Lv{g.level} {g.job ? `(${g.job})` : ''}</span>
        </div>
      ))}
    </div>
  )
}
