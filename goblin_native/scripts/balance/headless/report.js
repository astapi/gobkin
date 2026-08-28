'use strict'

/**
 * 集計結果の整形出力（コンソール整形テーブル / CSV）。
 */

// 列定義: key はメトリクス or 行メタから引く。fmt は表示用整形。
const COLUMNS = [
  { key: 'area', label: 'エリア', csv: 'area_id' },
  { key: 'areaLevel', label: 'Lv', csv: 'area_level' },
  { key: 'tier', label: 'T', csv: 'tier' },
  { key: 'effAreaLevel', label: '実効Lv', csv: 'effective_area_level' },
  { key: 'partyLevel', label: 'PT_Lv', csv: 'party_level' },
  { key: 'seeds', label: 'seeds', csv: 'seeds' },
  { key: 'successRate', label: '成功%', csv: 'success_rate', fmt: pct },
  { key: 'battleWinRate', label: '戦勝%', csv: 'battle_win_rate', fmt: pct },
  { key: 'loseAvgRounds', label: '敗北R', csv: 'lose_avg_rounds', fmt: f2 },
  { key: 'enemyDefeatRatio', label: '撃破%', csv: 'enemy_defeat_ratio', fmt: pct },
  { key: 'avgMaxFloor', label: '到達F', csv: 'avg_max_floor', fmt: f2 },
  { key: 'floors', label: '/F', csv: 'floors' },
  { key: 'remainingHpPct', label: '残HP%', csv: 'remaining_hp_pct', fmt: f1 },
  { key: 'avgCasualties', label: '死者', csv: 'avg_casualties', fmt: f2 },
  { key: 'goldPerHour', label: 'gold/h', csv: 'gold_per_hour', fmt: f0 },
  { key: 'xpPerHour', label: 'xp/h', csv: 'xp_per_hour', fmt: f0 },
  { key: 'dropsPerExpedition', label: 'drop/回', csv: 'drops_per_expedition', fmt: f2 },
  { key: 'progressScore', label: '進捗Score', csv: 'progress_score', fmt: f3 },
]

function pct(v) { return (v * 100).toFixed(1) }
function f0(v) { return Math.round(v).toString() }
function f1(v) { return v.toFixed(1) }
function f2(v) { return v.toFixed(2) }
function f3(v) { return v.toFixed(3) }

function cellValue(col, row) {
  const raw = row[col.key]
  if (raw === undefined || raw === null) return '-'
  if (col.fmt && typeof raw === 'number') return col.fmt(raw)
  return String(raw)
}

function formatTable(rows) {
  const header = COLUMNS.map(c => c.label)
  const body = rows.map(row => COLUMNS.map(c => cellValue(c, row)))
  const widths = COLUMNS.map((c, i) =>
    Math.max(header[i].length, ...body.map(r => r[i].length)),
  )
  const line = (cells) => cells.map((c, i) => c.padStart(widths[i])).join('  ')
  const sep = widths.map(w => '-'.repeat(w)).join('  ')
  const out = [line(header), sep]
  for (const r of body) out.push(line(r))
  return out.join('\n')
}

function toCsv(rows) {
  const header = COLUMNS.map(c => c.csv)
  const lines = [header.join(',')]
  for (const row of rows) {
    lines.push(COLUMNS.map(c => cellValue(c, row)).join(','))
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// ペルソナ比較（floor / median / ceiling を同じ area×Tier 行で並べる）
// ---------------------------------------------------------------------------
const PERSONA_SHORT = { floor: '床', median: '中央', ceiling: '天井' }

function personaShort(id) {
  return PERSONA_SHORT[id] ?? id
}

// 比較行の列を動的に組み立てる。
//   固定: area, Lv, T, effLv, PT_Lv, seeds
//   各ペルソナ: <短縮>成功% / <短縮>Score
//   floor と ceiling が両方あれば末尾に「天井-床」（伸びしろ）
function buildComparisonColumns(personaIds) {
  const cols = [
    { key: 'area', label: 'エリア', csv: 'area_id' },
    { key: 'areaLevel', label: 'Lv', csv: 'area_level' },
    { key: 'tier', label: 'T', csv: 'tier' },
    { key: 'effAreaLevel', label: '実効Lv', csv: 'effective_area_level' },
    { key: 'partyLevel', label: 'PT_Lv', csv: 'party_level' },
    { key: 'seeds', label: 'seeds', csv: 'seeds' },
  ]
  for (const pid of personaIds) {
    const s = personaShort(pid)
    cols.push({
      label: `${s}成功%`, csv: `${pid}_success_rate`, fmt: pct,
      get: cell => cell.byPersona[pid]?.successRate,
    })
    cols.push({
      label: `${s}Score`, csv: `${pid}_progress_score`, fmt: f3,
      get: cell => cell.byPersona[pid]?.progressScore,
    })
  }
  if (personaIds.includes('floor') && personaIds.includes('ceiling')) {
    cols.push({
      label: '天井-床', csv: 'ceiling_minus_floor', fmt: f3,
      get: cell => {
        const c = cell.byPersona.ceiling?.progressScore
        const f = cell.byPersona.floor?.progressScore
        return c === undefined || f === undefined ? undefined : c - f
      },
    })
  }
  return cols
}

function comparisonCell(col, cell) {
  const raw = col.get ? col.get(cell) : cell[col.key]
  if (raw === undefined || raw === null) return '-'
  if (col.fmt && typeof raw === 'number') return col.fmt(raw)
  return String(raw)
}

function formatComparisonTable(cells, personaIds) {
  const cols = buildComparisonColumns(personaIds)
  const header = cols.map(c => c.label)
  const body = cells.map(cell => cols.map(c => comparisonCell(c, cell)))
  const widths = cols.map((c, i) => Math.max(header[i].length, ...body.map(r => r[i].length)))
  const line = cells2 => cells2.map((c, i) => c.padStart(widths[i])).join('  ')
  const sep = widths.map(w => '-'.repeat(w)).join('  ')
  const out = [line(header), sep]
  for (const r of body) out.push(line(r))
  return out.join('\n')
}

function toCsvComparison(cells, personaIds) {
  const cols = buildComparisonColumns(personaIds)
  const lines = [cols.map(c => c.csv).join(',')]
  for (const cell of cells) {
    lines.push(cols.map(c => comparisonCell(c, cell)).join(','))
  }
  return lines.join('\n')
}

module.exports = {
  COLUMNS,
  formatTable,
  toCsv,
  formatComparisonTable,
  toCsvComparison,
  personaShort,
}
