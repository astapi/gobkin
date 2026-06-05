import { useEffect, useMemo, useState } from 'react'

interface ProgressionReportSummary {
  reportId: string
  through: string
  createdAt?: string
  stepCount: number
  challengeCount: number
  clearLevel80Count: number
  fileSizeBytes: number
}

interface CompactCountEntry {
  id: string
  count: number
}

interface CompactStep {
  index: number
  areaId: string
  areaName?: string
  baseRank?: number
  maxNormalDropRank?: number
  equipmentCount: number
  rareEquipmentCount: number
  newRareEquipment: Array<{ templateId: string; name?: string }>
  challenge: null | {
    level: number | null
    clearLevel80: number | null
    clearLevel95: number | null
    lowestWinningLevel: number | null
    winRate: number | null
    avgRoundsPerBattle: number | null
    usedRareEquipment: string[]
    jobs: string[]
    variants: string[]
    frequentJobs: CompactCountEntry[]
    frequentVariants: CompactCountEntry[]
    frequentEquipment: CompactCountEntry[]
    levelSweep: Array<{
      level: number
      winRate: number | null
      avgRoundsPerBattle: number | null
    }> | null
  }
}

interface CompactReport {
  version: number
  createdAt?: string
  through: string
  config: {
    levelMode?: string
    levelSweep?: { min: number; max: number; step: number } | null
  }
  steps: CompactStep[]
}

interface ProgressionReportPayload {
  reportId: string
  compact: CompactReport
  reportText: string
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready' }

export function ProgressionReportsPage() {
  const [reports, setReports] = useState<ProgressionReportSummary[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [payload, setPayload] = useState<ProgressionReportPayload | null>(null)
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [detailError, setDetailError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/progression-reports')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as ProgressionReportSummary[]
        if (cancelled) return
        setReports(data)
        setSelectedId((prev) => prev || data[0]?.reportId || '')
        setState({ kind: 'ready' })
      } catch (err) {
        if (!cancelled) {
          setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setPayload(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        setDetailError(null)
        const res = await fetch(`/api/progression-reports/${selectedId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
        const data = (await res.json()) as ProgressionReportPayload
        if (!cancelled) setPayload(data)
      } catch (err) {
        if (!cancelled) {
          setDetailError(err instanceof Error ? err.message : String(err))
          setPayload(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const selectedSummary = useMemo(
    () => reports.find((report) => report.reportId === selectedId) ?? null,
    [reports, selectedId],
  )

  if (state.kind === 'loading') return <p className="state-msg">読み込み中…</p>
  if (state.kind === 'error') return <p className="state-msg error">読み込みに失敗しました: {state.message}</p>

  return (
    <div className="detail progression-page">
      <div className="detail-head">
        <div>
          <h2>進行レポート</h2>
          <p className="subtle">
            <code>goblin_native/reports/progression-*</code> の compact/report を閲覧します。
          </p>
        </div>
      </div>

      <div className="progression-layout">
        <aside className="card progression-sidebar">
          <h3>レポート</h3>
          {reports.length === 0 && <p className="subtle">progression レポートがありません。</p>}
          <div className="progression-report-list">
            {reports.map((report) => (
              <button
                key={report.reportId}
                className={`progression-report-item ${report.reportId === selectedId ? 'active' : ''}`}
                onClick={() => setSelectedId(report.reportId)}
              >
                <span className="progression-report-title">{report.reportId}</span>
                <span className="subtle">through: {report.through}</span>
                <span className="subtle">
                  steps {report.stepCount} / challenge {report.challengeCount} / {(report.fileSizeBytes / 1024).toFixed(1)}KB
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="progression-main">
          {detailError && <p className="save-error">読み込みエラー: {detailError}</p>}
          {!payload && !detailError && <p className="state-msg">レポートを選択してください。</p>}
          {payload && (
            <ReportDetail
              payload={payload}
              summary={selectedSummary}
            />
          )}
        </section>
      </div>
    </div>
  )
}

function ReportDetail({
  payload,
  summary,
}: {
  payload: ProgressionReportPayload
  summary: ProgressionReportSummary | null
}) {
  const compact = payload.compact
  return (
    <div className="panel-stack">
      <section className="card">
        <div className="section-head">
          <div>
            <h3>{payload.reportId}</h3>
            <p className="subtle">
              through <code>{compact.through}</code>
              {' / '}
              createdAt {compact.createdAt ? formatDate(compact.createdAt) : '-'}
              {' / '}
              levelMode {compact.config?.levelMode ?? '-'}
              {' / '}
              levelSweep {formatLevelSweep(compact.config?.levelSweep)}
            </p>
          </div>
          {summary && (
            <div className="progression-kpis">
              <Kpi label="Steps" value={String(summary.stepCount)} />
              <Kpi label="Challenges" value={String(summary.challengeCount)} />
              <Kpi label="Clear80" value={String(summary.clearLevel80Count)} />
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <h3>進行ステップ</h3>
        <div className="progression-table-wrap">
          <table className="enemy-table progression-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Area</th>
                <th className="num">Equip</th>
                <th className="num">Rare</th>
                <th>New Rare</th>
                <th className="num">Clear80</th>
                <th className="num">Clear95</th>
                <th className="num">Win</th>
                <th>Used Rare</th>
                <th>Jobs / Variants</th>
              </tr>
            </thead>
            <tbody>
              {compact.steps.map((step) => (
                <tr key={`${step.index}-${step.areaId}`}>
                  <td className="num">{step.index}</td>
                  <td>
                    <strong>{step.areaName || step.areaId}</strong>
                    <div className="subtle"><code>{step.areaId}</code></div>
                  </td>
                  <td className="num">{step.equipmentCount}</td>
                  <td className="num">{step.rareEquipmentCount}</td>
                  <td>{renderTags(step.newRareEquipment.map((entry) => entry.templateId), 'rare')}</td>
                  <td className="num">{step.challenge?.clearLevel80 ?? '-'}</td>
                  <td className="num">{step.challenge?.clearLevel95 ?? '-'}</td>
                  <td className="num">{formatRate(step.challenge?.winRate ?? null)}</td>
                  <td>{renderTags(step.challenge?.usedRareEquipment ?? [], 'rare')}</td>
                  <td>
                    <div className="subtle">jobs: {formatList(step.challenge?.jobs)}</div>
                    <div className="subtle">variants: {formatList(step.challenge?.variants)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h3>レベルスイープ</h3>
        <div className="progression-sweep-grid">
          {compact.steps
            .filter((step) => step.challenge?.levelSweep?.length)
            .map((step) => (
              <SweepCard key={step.areaId} step={step} />
            ))}
          {!compact.steps.some((step) => step.challenge?.levelSweep?.length) && (
            <p className="subtle">スイープ結果はありません。</p>
          )}
        </div>
      </section>

      <section className="card">
        <h3>テキストレポート</h3>
        <pre className="progression-report-text">{payload.reportText || 'summary.report.txt がありません。'}</pre>
      </section>
    </div>
  )
}

function SweepCard({ step }: { step: CompactStep }) {
  const sweep = step.challenge?.levelSweep ?? []
  return (
    <div className="progression-sweep-card">
      <div className="progression-sweep-head">
        <strong>{step.areaId}</strong>
        <span className="subtle">clear80 {step.challenge?.clearLevel80 ?? '-'} / clear95 {step.challenge?.clearLevel95 ?? '-'}</span>
      </div>
      <div className="progression-sweep-bars">
        {sweep.map((entry) => (
          <div key={entry.level} className="progression-sweep-row">
            <span className="progression-sweep-level">Lv{entry.level}</span>
            <div className="progression-sweep-bar-track">
              <div
                className="progression-sweep-bar"
                style={{ width: `${Math.max(0, Math.min(1, entry.winRate ?? 0)) * 100}%` }}
              />
            </div>
            <span className="progression-sweep-rate">{formatRate(entry.winRate)}</span>
          </div>
        ))}
      </div>
      <div className="subtle">
        topEquipment: {formatCountEntries(step.challenge?.frequentEquipment)}
      </div>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="progression-kpi">
      <span className="subtle">{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function renderTags(values: string[], tone?: 'rare') {
  if (values.length === 0) return <span className="subtle">-</span>
  return (
    <div className="progression-tags">
      {values.map((value) => (
        <code key={value} className={tone === 'rare' ? 'progression-tag-rare' : undefined}>
          {value}
        </code>
      ))}
    </div>
  )
}

function formatList(values: string[] | undefined) {
  return values?.length ? values.join(', ') : '-'
}

function formatCountEntries(entries: CompactCountEntry[] | undefined) {
  return entries?.length ? entries.slice(0, 6).map((entry) => `${entry.id}:${entry.count}`).join(', ') : '-'
}

function formatRate(value: number | null | undefined) {
  return typeof value === 'number' ? `${(value * 100).toFixed(0)}%` : '-'
}

function formatLevelSweep(value: CompactReport['config']['levelSweep']) {
  return value ? `${value.min}:${value.max}:${value.step}` : '-'
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}
