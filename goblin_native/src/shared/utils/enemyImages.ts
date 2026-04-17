import { ImageSourcePropType } from 'react-native'
import type { EnemySnap } from '@/shared/types'

const enemyImagesById: Record<string, ImageSourcePropType> = {
  B_ORC: require('../../../assets/enemy/orc_expedition_captain.png'),
  B_HOB: require('../../../assets/enemy/hobgoblin.png'),
  B001: require('../../../assets/enemy/gray_wolf.png'),
  B_SLIME: require('../../../assets/enemy/boss_slime.png'),
  B_LICH: require('../../../assets/enemy/necromancer_remains.png'),
  B_CANNON: require('../../../assets/enemy/defense_cannon.png'),
}

const enemyImagesByName: Record<string, ImageSourcePropType> = {
  オーク遠征隊長: enemyImagesById.B_ORC,
  ホブゴブリン: enemyImagesById.B_HOB,
  グレイウルフ: enemyImagesById.B001,
  ボススライム: enemyImagesById.B_SLIME,
  死霊術師の残骸: enemyImagesById.B_LICH,
  防衛砲台: enemyImagesById.B_CANNON,
}

export function getEnemyImage(enemy: Pick<EnemySnap, 'id' | 'name'>): ImageSourcePropType | null {
  return enemyImagesById[enemy.id] ?? enemyImagesByName[enemy.name] ?? null
}
