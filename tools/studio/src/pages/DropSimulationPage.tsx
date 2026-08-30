import { useEffect, useMemo, useState } from 'react'
import {
  DUNGEON_TIER_LIST,
  DUNGEON_TIER_META,
  type DungeonTier,
  type EquipmentTitleId,
} from '@app/shared/types'
import { getEquipmentModLabel, getEquipmentTitleLabel } from '@app/shared/i18n/entityLocalization'

import type { DungeonSummary } from '../lib/schema'
import {
  runDropSimulation,
  type DropItemAggregate,
  type DropModAggregate,
  type DropSimulationResult,
} from '../lib/runDropSimulation'

const RUN_OPTIONS = [10, 50, 100, 500, 1000]

export function DropSimulationPage() {
  const [dungeons, setDungeons] = useState<DungeonSummary[]>([])
  const [target, setTarget] = useState('all')
  const [runs, setRuns] = useState(100)
  const [tier, setTier] = useState<DungeonTier>(0)
  const [partyLuck, setPartyLuck] = useState(0)
  const [dropMultiplier, setDropMultiplier] = useState(1)
  const [titleMultiplier, setTitleMultiplier] = useState(1)
  const [seedMode, setSeedMode] = useState<'random' | 'fixed'>('random')
  const [fixedSeed, setFixedSeed] = useState(1)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ completed: number; total: number; areaId: string } | null>(null)
  const [result, setResult] = useState<DropSimulationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch('/api/dungeons')
      .then(async response => {
        if (!response.ok) throw new Error(`ダンジョン取得失敗: HTTP ${response.status}`)
        const data = (await response.json()) as DungeonSummary[]
        if (!cancelled) setDungeons(data)
      })
      .catch(reason => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selectedDungeons = useMemo(() => (
    target === 'all'
      ? dungeons
      : dungeons.filter(dungeon => dungeon.areaId === target)
  ), [dungeons, target])
  const normalizedRuns = Math.max(1, Math.min(10_000, Math.floor(runs) || 1))
  const totalRuns = selectedDungeons.length * normalizedRuns

  const execute = async () => {
    if (selectedDungeons.length === 0 || running) return
    setRunning(true)
    setResult(null)
    setError(null)
    setProgress({ completed: 0, total: totalRuns, areaId: selectedDungeons[0].areaId })
    try {
      const simulation = await runDropSimulation({
        dungeons: selectedDungeons.map(dungeon => ({ areaId: dungeon.areaId, name: dungeon.name })),
        runsPerDungeon: normalizedRuns,
        tier,
        partyLuck: Math.max(0, Math.floor(partyLuck) || 0),
        dropMultiplier: Math.max(0.01, dropMultiplier || 1),
        titleMultiplier: Math.max(0.01, titleMultiplier || 1),
        seed: seedMode === 'fixed' ? Math.floor(fixedSeed) || 0 : undefined,
        onProgress: (completed, total, areaId) => setProgress({ completed, total, areaId }),
      })
      setResult(simulation)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="panel-stack">
      <section className="card">
        <h2>ドロップ周回シミュレーション</h2>
        <p className="subtle">
          検証用PTで各ダンジョンを確実に最深部まで踏破し、X周した場合の装備ドロップを集計します。
          通常・レアドロップ、称号、Prefix、Suffixの実際の抽選処理を使用します。
        </p>
        <div className="field-group drop-simulation-controls">
          <label className="field">
            <span className="field-label">対象ダンジョン</span>
            <span className="field-input">
              <select value={target} onChange={event => setTarget(event.target.value)}>
                <option value="all">全ダンジョン</option>
                {dungeons.map(dungeon => (
                  <option key={dungeon.areaId} value={dungeon.areaId}>
                    Lv{dungeon.areaLevel} · {dungeon.name}（{dungeon.areaId}）
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label className="field">
            <span className="field-label">1ダンジョンあたりの周回数</span>
            <span className="field-input drop-runs-input">
              <input
                type="number"
                min={1}
                max={10_000}
                value={runs}
                onChange={event => setRuns(Number(event.target.value))}
              />
              <select value={RUN_OPTIONS.includes(runs) ? runs : ''} onChange={event => setRuns(Number(event.target.value))}>
                <option value="" disabled>プリセット</option>
                {RUN_OPTIONS.map(value => <option key={value} value={value}>{value}周</option>)}
              </select>
            </span>
          </label>
          <label className="field">
            <span className="field-label">ダンジョンTier</span>
            <span className="field-input">
              <select value={tier} onChange={event => setTier(Number(event.target.value) as DungeonTier)}>
                {DUNGEON_TIER_LIST.map(value => (
                  <option key={value} value={value}>
                    Tier {value}{DUNGEON_TIER_META[value].prefix ? ` · ${DUNGEON_TIER_META[value].prefix}` : ' · 通常'}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <NumberField label="PT平均運" value={partyLuck} min={0} step={1} onChange={setPartyLuck} />
          <NumberField label="アイテム獲得率倍率" value={dropMultiplier} min={0.01} step={0.1} onChange={setDropMultiplier} />
          <NumberField label="称号付与率倍率" value={titleMultiplier} min={0.01} step={0.1} onChange={setTitleMultiplier} />
          <label className="field">
            <span className="field-label">シード</span>
            <span className="field-input drop-seed-input">
              <select value={seedMode} onChange={event => setSeedMode(event.target.value as 'random' | 'fixed')}>
                <option value="random">ランダム</option>
                <option value="fixed">固定</option>
              </select>
              {seedMode === 'fixed' && (
                <input type="number" value={fixedSeed} onChange={event => setFixedSeed(Number(event.target.value))} />
              )}
            </span>
          </label>
        </div>
        <p className="subtle">
          実行規模: {selectedDungeons.length}ダンジョン × {normalizedRuns.toLocaleString()}周 = {totalRuns.toLocaleString()}周
        </p>
        {error && <p className="save-error">{error}</p>}
        <div className="simulate-actions">
          {running && progress && (
            <span className="subtle">
              実行中… {progress.completed.toLocaleString()} / {progress.total.toLocaleString()}（{progress.areaId}）
            </span>
          )}
          <button className="btn primary" onClick={() => void execute()} disabled={running || totalRuns === 0}>
            {running ? '集計中…' : 'ドロップをシミュレーション'}
          </button>
        </div>
      </section>

      {result && <DropSimulationResultView result={result} />}
    </div>
  )
}

function NumberField({
  label,
  value,
  min,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  step: number
  onChange: (value: number) => void
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-input">
        <input type="number" value={value} min={min} step={step} onChange={event => onChange(Number(event.target.value))} />
      </span>
    </label>
  )
}

function DropSimulationResultView({ result }: { result: DropSimulationResult }) {
  const runsWithDrops = result.dungeons.reduce((sum, dungeon) => sum + dungeon.runsWithDrops, 0)
  const clears = result.dungeons.reduce((sum, dungeon) => sum + dungeon.clears, 0)

  return (
    <section className="card drop-simulation-result">
      <h2>ドロップ集計結果</h2>
      <div className="result-metrics">
        <Metric label="対象" value={`${result.dungeons.length}ダンジョン`} />
        <Metric label="総周回" value={result.totalRuns.toLocaleString()} />
        <Metric label="踏破率" value={formatPercent(clears / Math.max(1, result.totalRuns))} />
        <Metric label="ドロップ総数" value={result.totalDrops.toLocaleString()} />
        <Metric label="1周平均" value={(result.totalDrops / Math.max(1, result.totalRuns)).toFixed(3)} />
        <Metric label="獲得あり周回" value={formatPercent(runsWithDrops / Math.max(1, result.totalRuns))} />
      </div>

      <table className="enemy-table drop-dungeon-summary-table">
        <thead>
          <tr>
            <th>ダンジョン</th>
            <th className="num">周回</th>
            <th className="num">踏破率</th>
            <th className="num">獲得あり</th>
            <th className="num">装備数</th>
            <th className="num">1周平均</th>
            <th className="num">種類</th>
          </tr>
        </thead>
        <tbody>
          {result.dungeons.map(dungeon => (
            <tr key={dungeon.areaId}>
              <td><strong>{dungeon.areaName}</strong> <span className="subtle"><code>{dungeon.areaId}</code></span></td>
              <td className="num">{dungeon.runs.toLocaleString()}</td>
              <td className="num">{formatPercent(dungeon.clears / dungeon.runs)}</td>
              <td className="num">{formatPercent(dungeon.runsWithDrops / dungeon.runs)}</td>
              <td className="num">{dungeon.totalDrops.toLocaleString()}</td>
              <td className="num">{(dungeon.totalDrops / dungeon.runs).toFixed(3)}</td>
              <td className="num">{dungeon.items.length}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="drop-dungeon-results">
        {result.dungeons.map((dungeon, index) => (
          <details key={dungeon.areaId} className="drop-dungeon-result" open={result.dungeons.length === 1 || index === 0}>
            <summary>
              <strong>{dungeon.areaName}</strong>
              <span className="subtle"> {dungeon.totalDrops}個 / {dungeon.items.length}種類</span>
            </summary>
            {dungeon.errors.length > 0 && (
              <p className="save-error">エラー {dungeon.errors.length}件: {dungeon.errors[0]}</p>
            )}
            {dungeon.items.length === 0 ? (
              <p className="subtle">この条件では装備ドロップがありませんでした。</p>
            ) : (
              <DropItemTable items={dungeon.items} runs={dungeon.runs} />
            )}
          </details>
        ))}
      </div>
    </section>
  )
}

function DropItemTable({ items, runs }: { items: DropItemAggregate[]; runs: number }) {
  return (
    <div className="drop-item-table-wrap">
      <table className="enemy-table drop-item-table">
        <thead>
          <tr>
            <th>アイテム</th>
            <th>種別</th>
            <th className="num">獲得数</th>
            <th className="num">1周平均</th>
            <th className="num">獲得率</th>
            <th>称号分布</th>
            <th>Prefix上位</th>
            <th>Suffix上位</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.templateId}>
              <td><strong>{item.name}</strong><br /><span className="subtle"><code>{item.templateId}</code></span></td>
              <td>{item.isRare ? 'レア' : item.category}</td>
              <td className="num">{item.count.toLocaleString()}</td>
              <td className="num">{(item.count / runs).toFixed(3)}</td>
              <td className="num">{formatPercent(item.count / runs)}</td>
              <td>{formatTitleCounts(item)}</td>
              <td>{formatMods(item.prefixMods, item.count)}</td>
              <td>{formatMods(item.suffixMods, item.count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatTitleCounts(item: DropItemAggregate): string {
  return Object.entries(item.titleCounts)
    .sort(([, countA], [, countB]) => (countB ?? 0) - (countA ?? 0))
    .slice(0, 4)
    .map(([id, count]) => {
      const label = id === 'none' ? 'なし' : getEquipmentTitleLabel(id as EquipmentTitleId)
      return `${label} ${formatPercent((count ?? 0) / item.count)}`
    })
    .join(' / ')
}

function formatMods(mods: DropModAggregate[], total: number): string {
  return mods.slice(0, 4).map(mod => (
    `${getEquipmentModLabel(mod.id)} T${mod.tier} ${formatPercent(mod.count / total)}`
  )).join(' / ')
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  )
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}
