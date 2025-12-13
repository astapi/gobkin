import type { Factor } from '../types/Factor'

/**
 * 因子マスターデータ
 */
export const factorDatabase: Record<string, Factor> = {
  slime: {
    id: 'slime',
    name: 'スライム因子',
    description: 'スライムの特性を宿した因子。耐久性が増す。',
    effects: []
  },
  forest: {
    id: 'forest',
    name: 'ウルフ因子',
    description: 'ウルフの特性を宿した因子。敏捷性が増す。',
    effects: []
  },
}

/**
 * 因子IDから因子データを取得
 */
export function getFactor(factorId: string): Factor | undefined {
  return factorDatabase[factorId]
}

/**
 * 全因子のリストを取得
 */
export function getAllFactors(): Factor[] {
  return Object.values(factorDatabase)
}
