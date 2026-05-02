import React from 'react'
import { SvgProps } from 'react-native-svg'

// 因子SVGのインポート
import FactorSlime from '../../../assets/factor/factor_slime.svg'
import FactorWolf from '../../../assets/factor/factor_wolf.svg'
import FactorOrc from '../../../assets/factor/factor_orc.svg'
import FactorHobgoblin from '../../../assets/factor/factor_hobgoblin.svg'
import FactorUndead from '../../../assets/factor/factor_undead.svg'
import FactorDwarf from '../../../assets/factor/factor_dwarf.svg'
import FactorElf from '../../../assets/factor/factor_elf.svg'
import FactorLizardman from '../../../assets/factor/factor_lizardman.svg'
import FactorTroll from '../../../assets/factor/factor_troll.svg'
import FactorHarpy from '../../../assets/factor/factor_harpy.svg'
import FactorHobbit from '../../../assets/factor/factor_hobbit.svg'
import FactorMinotaur from '../../../assets/factor/factor_minotaur.svg'
import FactorVampire from '../../../assets/factor/factor_vampire.svg'
import FactorDragon from '../../../assets/factor/factor_dragon.svg'

// 因子画像のマッピング
const factorImages: Record<string, React.FC<SvgProps>> = {
  slime: FactorSlime,
  wolf: FactorWolf,
  orc: FactorOrc,
  hobgoblin: FactorHobgoblin,
  undead: FactorUndead,
  dwarf: FactorDwarf,
  elf: FactorElf,
  lizardman: FactorLizardman,
  troll: FactorTroll,
  harpy: FactorHarpy,
  hobbit: FactorHobbit,
  minotaur: FactorMinotaur,
  vampire: FactorVampire,
  dragon: FactorDragon,
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
