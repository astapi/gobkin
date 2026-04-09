import type { CharacterSkill } from '../types/CharacterSkill'
import type { EquipmentTemplate, WeaponRange } from '../types/Equipment'
import equipmentPoolJson from './equipmentPool.json'

interface EquipmentPoolData {
  version: string
  templates: EquipmentTemplate[]
}

const data = equipmentPoolJson as EquipmentPoolData

const WEAPON_RANGE_SKILLS: Record<WeaponRange, CharacterSkill> = {
  melee: {
    id: 'weapon_melee_attack',
    name: '[武器]近距離攻撃',
    enablesMeleeRowDamagePenalty: true,
  },
  ranged: {
    id: 'weapon_ranged_attack',
    name: '[武器]遠距離攻撃',
    enablesRangedRowDamagePenalty: true,
  },
}

function cloneSkill(skill: CharacterSkill): CharacterSkill {
  return {
    ...skill,
    statBonuses: skill.statBonuses ? { ...skill.statBonuses } : undefined,
    statMultipliers: skill.statMultipliers ? { ...skill.statMultipliers } : undefined,
    equipmentCategoryMultiplier: skill.equipmentCategoryMultiplier
      ? { ...skill.equipmentCategoryMultiplier }
      : undefined,
    equipmentStatMultipliers: skill.equipmentStatMultipliers
      ? { ...skill.equipmentStatMultipliers }
      : undefined,
  }
}

function buildGrantedSkills(template: EquipmentTemplate): CharacterSkill[] | undefined {
  const grantedSkills = template.grantedSkills?.map(cloneSkill) ?? []

  if (template.category === 'weapon' && template.range) {
    grantedSkills.unshift(cloneSkill(WEAPON_RANGE_SKILLS[template.range]))
  }

  return grantedSkills.length > 0 ? grantedSkills : undefined
}

function normalizeTemplate(template: EquipmentTemplate): EquipmentTemplate {
  return {
    ...template,
    statBonuses: template.statBonuses.map((bonus) => ({ ...bonus })),
    weaponStats: template.weaponStats ? { ...template.weaponStats } : undefined,
    effects: template.effects?.map((effect) => ({ ...effect })),
    grantedSkills: buildGrantedSkills(template),
  }
}

// コメント行を除外し、IDで高速検索するためのマップを構築
const templates = data.templates
  .filter((t) => t.id !== undefined)
  .map(normalizeTemplate)
const templateMap = new Map<string, EquipmentTemplate>(
  templates.map((t) => [t.id, t])
)

/**
 * 全装備テンプレートを取得
 */
export function getEquipmentTemplates(): EquipmentTemplate[] {
  return templates
}

/**
 * IDから装備テンプレートを取得
 */
export function getEquipmentTemplate(id: string): EquipmentTemplate | undefined {
  return templateMap.get(id)
}

/**
 * 拠点ランクで購入可能な装備を取得
 */
export function getShopEquipment(baseRank: number): EquipmentTemplate[] {
  return templates.filter(
    (t) => t.unlockRank !== undefined && t.unlockRank <= baseRank
  )
}

/**
 * ダンジョンレベルに対応する装備テンプレートを取得
 */
export function getEquipmentByDungeonLevel(dungeonLevel: number): EquipmentTemplate[] {
  return templates.filter(
    (t) =>
      t.dropLevelMin !== undefined &&
      t.dropLevelMax !== undefined &&
      dungeonLevel >= t.dropLevelMin &&
      dungeonLevel <= t.dropLevelMax
  )
}

/**
 * 装備プールのバージョン情報を取得
 */
export function getEquipmentPoolVersion(): string {
  return data.version
}
