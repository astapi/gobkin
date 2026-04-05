import type { SpellDef } from '../types/Spell'

export const SPELL_DEFS: Record<string, SpellDef> = {
  magic_arrow: {
    id: 'magic_arrow',
    name: 'マジックアロー',
    power: 0.8,
    targeting: { type: 'random_hits', hitCount: 3 },
    defaultCharges: 1,
  },
  fireball: {
    id: 'fireball',
    name: 'ファイヤーボール',
    power: 1.2,
    targeting: {
      type: 'multi_target',
      baseTargets: 6,
      scalePerLevel: 1,
      scaleLevelInterval: 12,
    },
    defaultCharges: 1,
  },
}
