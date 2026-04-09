import type { Factor } from '../types/Factor'
import { goblinVariantDefinitions } from './goblinVariants'

/**
 * 因子マスターデータ
 */
export const factorDatabase: Record<string, Factor> = Object.fromEntries(
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
        raceId: variant.raceId,
        raceName: variant.raceName,
        avatar: variant.avatar,
        additionalEffects: variant.additionalEffects,
      },
    },
  ])
)

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
