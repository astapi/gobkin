import type { Factor } from '../types/Factor'
import { goblinVariantDefinitions } from './goblinVariants'

const standaloneFactorDatabase: Record<string, Factor> = {
  ratatoskr: {
    id: 'ratatoskr',
    name: 'ラタトスク因子',
    description: 'ラタトスクの特性を宿した因子。命中精度と回避能力が増す。',
    inheritProbability: 0.18,
    effects: [
      { type: 'stat_bonus', target: 'accuracy', value: 10 },
      { type: 'stat_bonus', target: 'evasion', value: 10 },
    ],
  },
}

/**
 * 因子マスターデータ
 */
export const factorDatabase: Record<string, Factor> = {
  ...Object.fromEntries(
    Object.values(goblinVariantDefinitions).map((variant) => [
      variant.factorId,
      {
        id: variant.factorId,
        name: variant.factorName,
        description: variant.factorDescription,
        inheritProbability: variant.inheritProbability,
        effects: variant.factorEffects,
        variantConfig: {
          probability: variant.variantProbability,
          minPlusValue: variant.minPlusValue,
          raceId: variant.raceId,
          raceName: variant.raceName,
          avatar: variant.avatar,
        },
      },
    ])
  ),
  ...standaloneFactorDatabase,
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
