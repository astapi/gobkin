import type { SpellDef } from '../types/Spell'
import { getSpellLabel } from '../i18n/entityLocalization'

export const SPELL_DEFS: Record<string, SpellDef> = {
  magic_arrow: {
    id: 'magic_arrow',
    name: getSpellLabel({ id: 'magic_arrow', name: 'マジックアロー' }),
    power: 0.8,
    targeting: { type: 'random_hits', hitCount: 3 },
    defaultCharges: 1,
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
  },
}
