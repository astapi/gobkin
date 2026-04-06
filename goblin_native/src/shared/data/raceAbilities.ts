import type {
  EquipmentCategory,
  EquipmentEffect,
  EquipmentStat,
  EquipmentStatBonus,
  GoblinStats,
  RaceAbility,
} from '../types'

const RACE_ABILITIES: Record<string, RaceAbility[]> = {
  'スライムゴブリン': [
    {
      name: '[1.3倍]鎧装備',
      equipmentCategoryMultiplier: {
        armor: 1.3,
      },
    },
    {
      name: '後列防護',
      protectRearAllyNormalAttackMultiplier: 2 / 3,
    },
  ],
  'ウルフゴブリン': [
    {
      name: '[+2]攻撃回数アップ',
      statBonuses: {
        attackCount: 2,
      },
    },
    {
      name: '[2.0倍]命中精度',
      equipmentStatMultipliers: {
        accuracy_flat: 2,
        accuracy_percent: 2,
      },
    },
    {
      name: '[+13]追加ダメージ',
      additionalDamage: 13,
    },
  ],
}

export function getRaceAbilities(race: string): RaceAbility[] {
  return RACE_ABILITIES[race] ?? []
}

export function describeRaceAbility(ability: RaceAbility): string {
  if (ability.additionalDamage !== undefined) {
    return `通常攻撃の各ヒットに固定で+${ability.additionalDamage}`
  }

  if (ability.protectRearAllyNormalAttackMultiplier !== undefined) {
    const reducedRate = Math.round((1 - ability.protectRearAllyNormalAttackMultiplier) * 100)
    return `自分より後列の仲間が受ける通常攻撃ダメージを${reducedRate}%軽減`
  }

  if (ability.equipmentCategoryMultiplier?.armor !== undefined) {
    return `鎧カテゴリ装備の能力値が×${ability.equipmentCategoryMultiplier.armor.toFixed(1)}`
  }

  if (ability.equipmentStatMultipliers?.accuracy_flat !== undefined) {
    return `装備由来の命中精度補正が×${ability.equipmentStatMultipliers.accuracy_flat.toFixed(1)}`
  }

  if (ability.statBonuses?.attackCount !== undefined) {
    return `攻撃回数 +${ability.statBonuses.attackCount}`
  }

  return ability.name
}

export function getRaceStatBonuses(race: string): Partial<Record<keyof GoblinStats, number>> {
  const bonuses: Partial<Record<keyof GoblinStats, number>> = {}

  for (const ability of getRaceAbilities(race)) {
    for (const [key, value] of Object.entries(ability.statBonuses ?? {})) {
      const statKey = key as keyof GoblinStats
      bonuses[statKey] = (bonuses[statKey] ?? 0) + (value ?? 0)
    }
  }

  return bonuses
}

export function getRaceAdditionalDamage(race: string): number {
  return getRaceAbilities(race).reduce((sum, ability) => sum + (ability.additionalDamage ?? 0), 0)
}

export function getRearProtectionMultiplier(race: string): number {
  return getRaceAbilities(race).reduce(
    (product, ability) => product * (ability.protectRearAllyNormalAttackMultiplier ?? 1),
    1,
  )
}

function getEquipmentValueMultiplier(
  race: string,
  category: EquipmentCategory | undefined,
  stat: EquipmentStat | undefined,
): number {
  return getRaceAbilities(race).reduce((product, ability) => {
    let next = product

    if (category) {
      next *= ability.equipmentCategoryMultiplier?.[category] ?? 1
    }

    if (stat) {
      next *= ability.equipmentStatMultipliers?.[stat] ?? 1
    }

    return next
  }, 1)
}

export function applyRaceBonusToEquipmentBonuses(
  race: string,
  bonuses: EquipmentStatBonus[],
): EquipmentStatBonus[] {
  return bonuses.map((bonus) => ({
    ...bonus,
    value: bonus.value * getEquipmentValueMultiplier(race, bonus.sourceCategory, bonus.stat),
  }))
}

export function applyRaceBonusToEquipmentEffects(
  race: string,
  effects: EquipmentEffect[],
): EquipmentEffect[] {
  return effects.map((effect) => {
    const statKey = effect.type === 'accuracy_boost' ? 'accuracy_flat' : undefined
    return {
      ...effect,
      value: effect.value * getEquipmentValueMultiplier(race, effect.sourceCategory, statKey),
    }
  })
}
