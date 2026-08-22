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
import { backupGoblinToGoblin } from '../lib/runExpedition'
import type { BackupGoblin } from '../lib/goblinMapper'
import {
  buildPartyFromStrategistBuild,
  memberLabel,
  resolveLoadout,
  type StrategistBuild,
  type StrategistBuildFile,
} from '../lib/strategistParty'
import { usePartyStore } from '../stores/partyStore'
import { SimulationResultView } from '../components/SimulationResultView'
import { ExpeditionReplayView } from '../components/ExpeditionReplayView'
import type { Goblin } from '@app/shared/types'

type PartySource =
  | 'draft'
  | `preset:${string}`
  | `library:${number}`
  | `strategist:${string}`
type RunMode = 'batch' | 'single'

const TRIAL_OPTIONS = [50, 200, 500, 1000, 3000]
/** 戦略PTを試すレベル。measureArea のレベルグリッドに合わせている */
const STRATEGIST_LEVEL_OPTIONS = [
  3, 5, 8, 10, 13, 16, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 150, 180, 200,
]

const strategistKey = (build: StrategistBuild) => `${build.areaId}|${build.tier}`

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
  const [strategistFile, setStrategistFile] = useState<StrategistBuildFile | null>(null)
  const [strategistLevel, setStrategistLevel] = useState<number>(50)

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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/strategist-builds')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as StrategistBuildFile
        if (!cancelled) setStrategistFile(data)
      } catch {
        if (!cancelled) setStrategistFile({ generatedAt: '', partySize: 6, builds: [] })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const strategistBuilds = strategistFile?.builds ?? []

  // 戦略ビルドを選んだら、そのビルドが探索されたエリア・Tierへ必ず合わせる。
  // ここがズレると「別エリア用に組んだPT」で測ってしまう。
  const selectStrategistBuild = useCallback((build: StrategistBuild) => {
    setPartySource(`strategist:${strategistKey(build)}`)
    setAreaId(build.areaId)
    setTier(build.tier)
  }, [])

  const changePartySource = useCallback(
    (value: string) => {
      if (value.startsWith('strategist:')) {
        const key = value.slice('strategist:'.length)
        const build = (strategistFile?.builds ?? []).find((b) => strategistKey(b) === key)
        if (build) {
          selectStrategistBuild(build)
          return
        }
      }
      setPartySource(value as PartySource)
    },
    [strategistFile, selectStrategistBuild],
  )

  // バックアップ未取込でも戦略ビルドがあれば使えるよう、初期選択を寄せる
  useEffect(() => {
    if (hasCharacters || strategistBuilds.length === 0) return
    if (partySource !== 'draft') return
    const first = strategistBuilds[0]
    setPartySource(`strategist:${strategistKey(first)}`)
    setAreaId(first.areaId)
    setTier(first.tier)
  }, [hasCharacters, strategistBuilds, partySource])

  const selectedStrategistBuild = useMemo<StrategistBuild | null>(() => {
    if (!partySource.startsWith('strategist:')) return null
    const key = partySource.slice('strategist:'.length)
    return strategistBuilds.find((b) => strategistKey(b) === key) ?? null
  }, [partySource, strategistBuilds])

  const resolvedBackupParty = useMemo<BackupGoblin[]>(() => {
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

  // 戦略ビルドが選ばれているときは保存されたビルドから組み立て、
  // それ以外はバックアップ由来のPTを Goblin に変換する。
  const resolvedParty = useMemo<Goblin[]>(() => {
    if (selectedStrategistBuild) {
      return buildPartyFromStrategistBuild(selectedStrategistBuild, strategistLevel)
    }
    return resolvedBackupParty.map(backupGoblinToGoblin)
  }, [selectedStrategistBuild, strategistLevel, resolvedBackupParty])

  const canRun =
    !running &&
    areaId !== '' &&
    resolvedParty.length > 0 &&
    (runMode === 'single' || trials > 0) &&
    (hasCharacters || selectedStrategistBuild !== null)

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


  if (!hasCharacters && strategistBuilds.length === 0) {
    return (
      <div className="panel-stack">
        <section className="card">
          <h2>シミュレーション</h2>
          <p className="subtle">
            自分のPTで試すには、まず <Link to="/party">PT編成</Link> 画面でバックアップ JSON
            を取り込んでください。一度取り込めばローカルに保存され、以降はバックアップ無しで利用できます。
          </p>
          <p className="subtle">
            バックアップ無しでも、バランス調整で使った戦略PTなら実行できます。
            <code>goblin_native</code> で{' '}
            <code>node scripts/balance/exportStrategistBuilds.js --all</code>{' '}
            を実行してビルドを書き出してください。
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
                onChange={(e) => changePartySource(e.target.value)}
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
                {strategistBuilds.map((b) => (
                  <option key={strategistKey(b)} value={`strategist:${strategistKey(b)}`}>
                    [戦略] {b.areaId} Tier{b.tier}
                  </option>
                ))}
              </select>
            </span>
          </label>
          {selectedStrategistBuild && (
            <label className="field">
              <span className="field-label">戦略PTのレベル</span>
              <span className="field-input">
                <select
                  value={strategistLevel}
                  onChange={(e) => setStrategistLevel(Number(e.target.value))}
                >
                  {STRATEGIST_LEVEL_OPTIONS.map((lv) => (
                    <option key={lv} value={lv}>
                      Lv{lv}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          )}
        </div>
        {selectedStrategistBuild ? (
          <StrategistBuildPreview
            build={selectedStrategistBuild}
            level={strategistLevel}
            generatedAt={strategistFile?.generatedAt ?? null}
          />
        ) : (
          <PartyPreview party={resolvedParty} />
        )}
        {strategistBuilds.length > 0 && !selectedStrategistBuild && (
          <div className="strategist-shortcuts">
            <span className="subtle">バランス調整で使った戦略PTで測る:</span>
            {strategistBuilds
              .filter((b) => b.areaId === areaId)
              .map((b) => (
                <button
                  key={strategistKey(b)}
                  className="btn"
                  onClick={() => selectStrategistBuild(b)}
                >
                  このエリアの戦略PT（Tier{b.tier}）
                </button>
              ))}
          </div>
        )}
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

function PartyPreview({ party }: { party: Goblin[] }) {
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

function StrategistBuildPreview({
  build,
  level,
  generatedAt,
}: {
  build: StrategistBuild
  level: number
  generatedAt: string | null
}) {
  return (
    <div className="strategist-preview">
      <p className="subtle">
        {build.areaId} / Tier{build.tier} の戦略ビルド（探索Lv{build.searchLevel} · score{' '}
        {build.score}
        {generatedAt ? ` · ${generatedAt.slice(0, 10)} 出力` : ''}）
      </p>
      <table className="strategist-preview-table">
        <thead>
          <tr>
            <th>隊列</th>
            <th>構成</th>
            <th>装備（Lv{level} で{' '}
              {resolveLoadout(build, build.members[0] ?? { kind: 'job', jobId: null, raceId: null, variant: null, loadout: [] }, level).length}
              枠）
            </th>
          </tr>
        </thead>
        <tbody>
          {build.members.map((m, i) => (
            <tr key={i}>
              <td>{i < build.frontCount ? '前列' : '後列'}</td>
              <td>
                <strong>{memberLabel(m)}</strong>
                <span className="subtle">{m.kind === 'variant' ? '（亜種）' : '（ジョブ）'}</span>
              </td>
              <td className="strategist-loadout">
                {resolveLoadout(build, m, level).join(', ') || '装備なし'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
