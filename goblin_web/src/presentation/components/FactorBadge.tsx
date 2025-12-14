import { getFactor } from '../../shared/data/factors'

interface FactorBadgeProps {
  factorId: string
  size?: 'sm' | 'md'
}

/**
 * 因子のアイコン（因子IDに基づいて色を決定）
 */
const getFactorIcon = (factorId: string): { icon: string; bgColor: string; textColor: string } => {
  switch (factorId) {
    case 'slime':
      return { icon: '💧', bgColor: 'bg-cyan-100', textColor: 'text-cyan-700' }
    case 'forest':
      return { icon: '🐺', bgColor: 'bg-emerald-100', textColor: 'text-emerald-700' }
    default:
      return { icon: '✨', bgColor: 'bg-purple-100', textColor: 'text-purple-700' }
  }
}

/**
 * 因子バッジコンポーネント
 * ゴブリンが持つ因子を視覚的に表示
 */
export const FactorBadge = ({ factorId, size = 'sm' }: FactorBadgeProps) => {
  const factor = getFactor(factorId)
  if (!factor) return null

  const { icon, bgColor, textColor } = getFactorIcon(factorId)
  const sizeClasses = size === 'sm'
    ? 'text-xs px-1.5 py-0.5'
    : 'text-sm px-2 py-1'

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full ${bgColor} ${textColor} ${sizeClasses} font-medium`}
      title={factor.description}
    >
      <span>{icon}</span>
      <span>{factor.name}</span>
    </span>
  )
}

interface FactorBadgeListProps {
  factorIds: string[]
  size?: 'sm' | 'md'
  maxDisplay?: number
}

/**
 * 因子バッジのリスト表示
 */
export const FactorBadgeList = ({ factorIds, size = 'sm', maxDisplay = 3 }: FactorBadgeListProps) => {
  if (!factorIds || factorIds.length === 0) return null

  const displayFactors = factorIds.slice(0, maxDisplay)
  const remaining = factorIds.length - maxDisplay

  return (
    <div className="flex flex-wrap gap-1">
      {displayFactors.map(factorId => (
        <FactorBadge key={factorId} factorId={factorId} size={size} />
      ))}
      {remaining > 0 && (
        <span className="text-xs text-gray-500">+{remaining}</span>
      )}
    </div>
  )
}
