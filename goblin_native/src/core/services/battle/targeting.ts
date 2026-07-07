import { hasActTwicePerTurnSkill } from '../../../shared/data/characterSkills'
import type { BattleUnit } from './types'

/**
 * 隊列の狙われ率の重みを取得
 * 列1(タンク)=13/12, 列2=1/3, 列3以降=0.5^(n+1), 最後2列は同率
 * 6列フル時の比率: 65% / 20% / 7.5% / 3.75% / 1.875% / 1.875%
 * totalRows: 生存列数
 */
export function getRowWeight(row: number, totalRows: number): number {
  if (totalRows <= 1) return 1
  if (row === 0) return 13 / 12
  if (row === 1) return 1 / 3
  // 最後の2列は同率
  const effectiveRow = Math.min(row, totalRows - 2)
  return Math.pow(0.5, effectiveRow + 1)
}

/**
 * 隊列に基づくターゲット選択
 * 生存ユニットを列グループ化し、前詰めした列番号で重み付き抽選
 */
export function selectTarget(aliveUnits: BattleUnit[], rng: () => number): BattleUnit {
  if (aliveUnits.length === 1) return aliveUnits[0]

  // 列でグループ化（列番号順にソート済みの前提）
  const rowGroups: Map<number, BattleUnit[]> = new Map()
  for (const unit of aliveUnits) {
    const group = rowGroups.get(unit.row) ?? []
    group.push(unit)
    rowGroups.set(unit.row, group)
  }

  // 列を前詰めして連番にする（生存列のみ、元のrow順でソート）
  const sortedRows = [...rowGroups.keys()].sort((a, b) => a - b)
  const totalRows = sortedRows.length

  // 列の重み付き抽選
  const rowWeights = sortedRows.map((_, idx) => getRowWeight(idx, totalRows))
  const totalWeight = rowWeights.reduce((sum, w) => sum + w, 0)
  let roll = rng() * totalWeight
  let selectedRowIdx = 0
  for (let i = 0; i < rowWeights.length; i++) {
    roll -= rowWeights[i]
    if (roll <= 0) {
      selectedRowIdx = i
      break
    }
  }

  const selectedRow = sortedRows[selectedRowIdx]
  const candidates = rowGroups.get(selectedRow)!

  // 列内が1体ならそのまま返す
  if (candidates.length === 1) return candidates[0]

  // 列内の複数ユニットも同じ重み方式で抽選（rowSlot順で前ほど狙われやすい）
  const sorted = [...candidates].sort((a, b) => a.rowSlot - b.rowSlot)
  const slotWeights = sorted.map((_, idx) => getRowWeight(idx, sorted.length))
  const slotTotalWeight = slotWeights.reduce((sum, w) => sum + w, 0)
  let slotRoll = rng() * slotTotalWeight
  for (let i = 0; i < sorted.length; i++) {
    slotRoll -= slotWeights[i]
    if (slotRoll <= 0) return sorted[i]
  }
  return sorted[sorted.length - 1]
}

export function getActionsPerTurn(unit: Pick<BattleUnit, 'skills'>): number {
  return hasActTwicePerTurnSkill(unit.skills) ? 2 : 1
}
