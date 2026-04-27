import React from 'react'
import { SvgProps } from 'react-native-svg'

// 因子SVGのインポート
import FactorSlime from '../../../assets/factor/factor_slime.svg'
import FactorWolf from '../../../assets/factor/factor_wolf.svg'
import FactorOrc from '../../../assets/factor/factor_orc.svg'
import FactorHobgoblin from '../../../assets/factor/factor_hobgoblin.svg'

// 因子画像のマッピング
const factorImages: Record<string, React.FC<SvgProps>> = {
  slime: FactorSlime,
  wolf: FactorWolf,
  orc: FactorOrc,
  hobgoblin: FactorHobgoblin,
  shadow: FactorWolf,
}

// デフォルト画像（スライム）
const defaultFactorImage = FactorSlime

/**
 * 因子IDから因子画像コンポーネントを取得
 * @param factorId - 因子ID
 * @returns SVGコンポーネント
 */
export function getFactorImage(factorId: string): React.FC<SvgProps> {
  return factorImages[factorId] || defaultFactorImage
}
