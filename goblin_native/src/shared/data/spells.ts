import type { SpellDef } from '../types/Spell'
import { getSpellLabel } from '../i18n/entityLocalization'

export const SPELL_DEFS: Record<string, SpellDef> = {
  magic_arrow: {
    id: 'magic_arrow',
    name: getSpellLabel({ id: 'magic_arrow', name: 'マジックアロー' }),
    power: 0.8,
    targeting: { type: 'random_hits', hitCount: 3 },
    defaultCharges: 1,
    spellCoefficient: 1.0,
  },
  fireball: {
    id: 'fireball',
    name: getSpellLabel({ id: 'fireball', name: 'ファイヤーボール' }),
    power: 1.2,
    targeting: {
      type: 'multi_target',
      baseTargets: 6,
      scalePerLevel: 1,
      scaleLevelInterval: 12,
    },
    defaultCharges: 1,
    spellCoefficient: 1.0,
  },
  fireball_twice: {
    id: 'fireball_twice',
    name: getSpellLabel({ id: 'fireball_twice', name: 'ファイヤーボール2回' }),
    power: 1.2,
    targeting: {
      type: 'multi_target',
      baseTargets: 6,
      scalePerLevel: 1,
      scaleLevelInterval: 12,
    },
    defaultCharges: 2,
    spellCoefficient: 1.0,
  },
  blizzard: {
    id: 'blizzard',
    name: getSpellLabel({ id: 'blizzard', name: 'ブリザード' }),
    power: 0.9,
    targeting: {
      type: 'multi_target',
      baseTargets: 8,
      scalePerLevel: 1,
      scaleLevelInterval: 8,
    },
    defaultCharges: 1,
    spellCoefficient: 1.0,
  },
  heal: {
    id: 'heal',
    name: getSpellLabel({ id: 'heal', name: 'ヒール' }),
    power: 0,
    targeting: { type: 'single_ally_lowest_hp' },
    defaultCharges: 1,
    effect: 'heal',
  },
  shield_barrier: {
    id: 'shield_barrier',
    name: getSpellLabel({ id: 'shield_barrier', name: 'シールドバリア' }),
    power: 0,
    targeting: { type: 'all_allies' },
    defaultCharges: 1,
    effect: 'barrier',
    damageReductionPercent: 50,
    breathDamageReductionPercent: 50,
  },
  party_heal: {
    id: 'party_heal',
    name: getSpellLabel({ id: 'party_heal', name: 'パーティヒール' }),
    power: 0,
    targeting: { type: 'all_allies' },
    defaultCharges: 1,
    effect: 'heal',
    healBonus: 50,
  },
}
