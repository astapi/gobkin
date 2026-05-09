import { getCharacterSkills } from '@/shared/data/skillCatalog'
import { DUNGEON_TIER_SCALING, type DungeonTier } from '@/shared/types/DungeonTier'
import type { CharacterSkill, Enemy } from '@/shared/types'

type DungeonTierScaling = (typeof DUNGEON_TIER_SCALING)[number]

function getTierDamageTakenMultiplier(scaling: DungeonTierScaling): number {
  switch (scaling.statScale) {
    case 1.58:
      return 0.86
    case 2.10:
      return 0.82
    case 2.75:
      return 0.78
    case 3.50:
      return 0.74
    case 5.00:
      return 0.70
    default:
      return 1
  }
}

function getTierReductionPercent(scaling: DungeonTierScaling): number {
  return Math.max(0, Math.round((1 - getTierDamageTakenMultiplier(scaling)) * 100))
}

function scaleEnemyHp(hp: number, scaling: DungeonTierScaling): number {
  if ('hpCurve' in scaling) {
    const curve = scaling.hpCurve
    if (hp <= curve[0].base) {
      return Math.floor(hp * curve[0].scale + 1e-9)
    }

    for (let i = 1; i < curve.length; i++) {
      const previous = curve[i - 1]
      const current = curve[i]
      if (hp <= current.base) {
        const ratio = (hp - previous.base) / (current.base - previous.base)
        const scale = previous.scale + (current.scale - previous.scale) * ratio
        return Math.floor(hp * scale + 1e-9)
      }
    }
  }

  return Math.floor(hp * scaling.hpScale + 1e-9)
}

function scaleDefensiveStat(value: number, scale: number): number {
  const scaled = value * scale
  return value <= 10 ? Math.round(scaled) : Math.floor(scaled)
}

export function getDungeonTierSkills(tier: DungeonTier): CharacterSkill[] {
  const scaling = DUNGEON_TIER_SCALING[tier] ?? DUNGEON_TIER_SCALING[0]
  const damagePercent = Math.round((scaling.statScale - 1) * 100)
  const reductionPercent = getTierReductionPercent(scaling)
  if (damagePercent <= 0) {
    return []
  }

  return getCharacterSkills([
    `physical_damage_${damagePercent}`,
    `spell_damage_${damagePercent}`,
    `physical_reduction_${reductionPercent}`,
    `magic_reduction_${reductionPercent}`,
  ])
}

export function applyDungeonTierScalingToEnemy(enemy: Enemy, tier: DungeonTier): Enemy {
  const scaling = DUNGEON_TIER_SCALING[tier] ?? DUNGEON_TIER_SCALING[0]
  const statScale = scaling.statScale
  const tierSkills = getDungeonTierSkills(tier)
  const countScale = Math.sqrt(statScale)
  const goldScale = Math.pow(statScale, 1.5)

  return {
    ...enemy,
    level: Math.floor(enemy.level * statScale) + scaling.levelBonus,
    hp: scaleEnemyHp(enemy.hp, scaling),
    baseAttributes: {
      power: Math.max(1, Math.round(enemy.baseAttributes.power * statScale)),
      wisdom: Math.max(1, Math.round(enemy.baseAttributes.wisdom * statScale)),
      spirit: Math.max(1, Math.round(enemy.baseAttributes.spirit * statScale)),
      vitality: Math.max(1, Math.round(enemy.baseAttributes.vitality * statScale)),
      agility: Math.max(1, Math.round(enemy.baseAttributes.agility * statScale)),
      luck: Math.max(1, Math.round(enemy.baseAttributes.luck * statScale)),
    },
    atk: Math.floor(enemy.atk * statScale),
    def: scaleDefensiveStat(enemy.def, scaling.defScale),
    magicDef: enemy.magicDef !== undefined
      ? scaleDefensiveStat(enemy.magicDef, scaling.magicDefScale)
      : undefined,
    magicAtk: enemy.magicAtk !== undefined ? Math.floor(enemy.magicAtk * statScale) : undefined,
    magicHeal: enemy.magicHeal !== undefined ? Math.floor(enemy.magicHeal * statScale) : undefined,
    attackCount: Math.max(1, Math.floor(enemy.attackCount * countScale)),
    accuracy: Math.round(enemy.accuracy * statScale),
    evasion: scaleDefensiveStat(enemy.evasion, scaling.evasionScale),
    gold: Math.floor(enemy.gold * goldScale),
    skills: tierSkills.length > 0
      ? [...(enemy.skills ?? []), ...tierSkills]
      : enemy.skills,
  }
}
