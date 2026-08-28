import type { Skill } from '../../core/services/DamageCalculator'
import i18n from '../i18n'

export const normalAttack: Skill = {
  id: 'normal',
  name: i18n.t('battle.normalAttack'),
  power: 1.0,
}
