import type { CSSProperties } from 'react'
import { useMemo } from 'react'

import {
  describeLoadoutParty,
  type BalanceScenario,
  type PartyMemberPreview,
} from '../lib/runBalanceReference'

interface PartyStatsPreviewProps {
  scenario: BalanceScenario
  level: number
  onLevelChange: (level: number) => void
}

interface StatColumn {
  label: string
  value: (m: PartyMemberPreview) => number
  base?: (m: PartyMemberPreview) => number
}

const STAT_COLUMNS: StatColumn[] = [
  { label: 'HP', value: (m) => m.effectiveStats.hp, base: (m) => m.stats.hp },
  { label: 'ATK', value: (m) => m.effectiveStats.atk, base: (m) => m.stats.atk },
  { label: 'M-ATK', value: (m) => m.effectiveStats.magicAtk, base: (m) => m.stats.magicAtk },
  { label: 'DEF', value: (m) => m.effectiveStats.def, base: (m) => m.stats.def },
  { label: 'M-DEF', value: (m) => m.effectiveStats.magicDef, base: (m) => m.stats.magicDef },
  { label: 'HEAL', value: (m) => m.effectiveStats.magicHeal, base: (m) => m.stats.magicHeal },
  {
    label: '攻撃回数',
    value: (m) => m.effectiveStats.attackCount,
    base: (m) => m.stats.attackCount,
  },
  { label: '命中', value: (m) => m.effectiveStats.accuracy, base: (m) => m.stats.accuracy },
  { label: '回避', value: (m) => m.effectiveStats.evasion, base: (m) => m.stats.evasion },
  {
    label: '必殺',
    value: (m) => m.effectiveStats.criticalRate,
    base: (m) => m.stats.criticalRate,
  },
  { label: '敏捷', value: (m) => m.baseAttributes.agility },
  { label: '運', value: (m) => m.baseAttributes.luck },
]

export function PartyStatsPreview({ scenario, level, onLevelChange }: PartyStatsPreviewProps) {
  const previews = useMemo(() => {
    return scenario.loadouts.map((loadout) => {
      try {
        return { loadout, members: describeLoadoutParty(loadout, level), error: null as string | null }
      } catch (err) {
        return {
          loadout,
          members: [] as PartyMemberPreview[],
          error: err instanceof Error ? err.message : String(err),
        }
      }
    })
  }, [scenario.loadouts, level])

  return (
    <section className="card">
      <h3>味方ステータス（Lv{level}）</h3>
      <p className="subtle">
        シミュレーションで実際に組まれる味方（ジョブ・亜種・装備・スキル適用後）の実効ステータスです。
        括弧内は装備込みの基本ステータスで、差分はスキル・因子・装備倍率による補正を表します。
      </p>
      <label className="field" style={{ maxWidth: 220 }}>
        <span className="field-label">プレビューLv</span>
        <span className="field-input">
          <input
            type="number"
            min={1}
            value={level}
            onChange={(e) => onLevelChange(Math.max(1, Number(e.target.value) || 1))}
          />
        </span>
      </label>

      {previews.map(({ loadout, members, error }, idx) => (
        <div key={`${idx}-${loadout.name}`} style={{ marginTop: 16 }}>
          <h4 style={{ marginBottom: 4 }}>{loadout.name}</h4>
          {error && <p className="save-error">ステータス算出エラー: {error}</p>}
          {!error && members.length === 0 && <p className="subtle">メンバーがいません</p>}
          {!error && members.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={headStyle}>列</th>
                    <th style={headStyle}>名前</th>
                    <th style={headStyle}>Lv</th>
                    <th style={headStyle}>種族/ジョブ</th>
                    <th style={headStyle}>装備枠</th>
                    {STAT_COLUMNS.map((col) => (
                      <th key={col.label} style={headStyle}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.index}>
                      <td style={cellStyle}>{m.index + 1}</td>
                      <td style={{ ...cellStyle, textAlign: 'left' }}>{m.name}</td>
                      <td style={cellStyle}>{m.level}</td>
                      <td style={{ ...cellStyle, textAlign: 'left' }}>
                        {m.race}
                        {m.job ? ` / ${m.job}` : ' / 無職'}
                      </td>
                      <td style={cellStyle}>
                        {m.equippedTemplateIds.length}/{m.availableSlots}
                        {m.ignoredTemplateIds.length > 0 && (
                          <span
                            className="subtle"
                            title={`枠超過で無視: ${m.ignoredTemplateIds.join(', ')}`}
                          >
                            {' '}
                            ⚠+{m.ignoredTemplateIds.length}
                          </span>
                        )}
                      </td>
                      {STAT_COLUMNS.map((col) => {
                        const value = col.value(m)
                        const base = col.base?.(m)
                        return (
                          <td key={col.label} style={cellStyle}>
                            {formatNumber(value)}
                            {base !== undefined && base !== value && (
                              <span className="subtle"> ({formatNumber(base)})</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!error &&
            members.map((m) => (
              <p key={m.index} className="subtle" style={{ margin: '2px 0', fontSize: '0.85em' }}>
                列{m.index + 1} 装備: {m.equippedTemplateIds.filter((id) => id !== '').join(', ') || 'なし'}
                {m.skillIds.length > 0 && ` / スキル: ${m.skillIds.join(', ')}`}
              </p>
            ))}
        </div>
      ))}
    </section>
  )
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '-'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

const headStyle: CSSProperties = {
  border: '1px solid var(--border, #ddd)',
  padding: '4px 8px',
  textAlign: 'center',
  whiteSpace: 'nowrap',
}

const cellStyle: CSSProperties = {
  border: '1px solid var(--border, #ddd)',
  padding: '4px 8px',
  textAlign: 'center',
  whiteSpace: 'nowrap',
}
