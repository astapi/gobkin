import { getFactor } from '../../shared/data/factors'
import factorSlime from '../../assets/factor/factor_slime.svg'
import factorWolf from '../../assets/factor/factor_wolf.svg'

interface FactorBadgeProps {
  factorId: string
  size?: 'sm' | 'md'
  showName?: boolean
}

/**
 * 因子のアイコン（因子IDに基づいてアイコンを決定）
 */
const getFactorIcon = (factorId: string): string => {
  switch (factorId) {
    case 'slime':
      return factorSlime
    case 'wolf':
      return factorWolf
    case 'orc':
      return factorSlime // TODO: オーク用アイコン
    case 'hobgoblin':
      return factorSlime // TODO: ホブゴブリン用アイコン
    default:
      return factorSlime
  }
}

/**
 * 因子バッジコンポーネント
 * ゴブリンが持つ因子を視覚的に表示
 */
export const FactorBadge = ({ factorId, size = 'sm', showName = false }: FactorBadgeProps) => {
  const factor = getFactor(factorId)
  if (!factor) return null

  const icon = getFactorIcon(factorId)
  const iconSize = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6'

  return (
    <span
      className="inline-flex items-center gap-1"
      title={factor.description}
    >
      <img src={icon} alt={factor.name} className={iconSize} />
      {showName && (
        <span className={`font-medium text-gray-700 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
          {factor.name}
        </span>
      )}
    </span>
  )
}

interface FactorBadgeListProps {
  factorIds: string[]
  size?: 'sm' | 'md'
  showName?: boolean
}

/**
 * 因子バッジのリスト表示
 */
export const FactorBadgeList = ({ factorIds, size = 'sm', showName = false }: FactorBadgeListProps) => {
  if (!factorIds || factorIds.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1">
      {factorIds.map(factorId => (
        <FactorBadge key={factorId} factorId={factorId} size={size} showName={showName} />
      ))}
    </div>
  )
}
