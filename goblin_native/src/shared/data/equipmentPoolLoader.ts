import type { CharacterSkill } from '../types/CharacterSkill'
import type { EquipmentTemplate, WeaponRange } from '../types/Equipment'
import equipmentPoolJson from './equipmentPool.json'
import { getCharacterSkill } from './skillCatalog'

interface EquipmentPoolData {
  version: string
  templates: EquipmentTemplate[]
}

const data = equipmentPoolJson as EquipmentPoolData

const WEAPON_RANGE_SKILLS: Record<WeaponRange, 'weapon_melee_attack' | 'weapon_ranged_attack'> = {
  melee: 'weapon_melee_attack',
  ranged: 'weapon_ranged_attack',
}

function cloneSkill(skill: CharacterSkill): CharacterSkill {
  return {
    ...skill,
    statBonuses: skill.statBonuses ? { ...skill.statBonuses } : undefined,
    statMultipliers: skill.statMultipliers ? { ...skill.statMultipliers } : undefined,
    baseStatMultipliers: skill.baseStatMultipliers ? { ...skill.baseStatMultipliers } : undefined,
    equipmentCategoryMultiplier: skill.equipmentCategoryMultiplier
      ? { ...skill.equipmentCategoryMultiplier }
      : undefined,
    equipmentStatMultipliers: skill.equipmentStatMultipliers
      ? { ...skill.equipmentStatMultipliers }
      : undefined,
  }
}

function buildGrantedSkills(template: EquipmentTemplate): CharacterSkill[] | undefined {
  const grantedSkills = (template.grantedSkillIds ?? []).map((skillId) => getCharacterSkill(skillId))

  if (template.grantedSkills?.length) {
    grantedSkills.push(...template.grantedSkills.map(cloneSkill))
  }

  if (template.category === 'weapon' && template.range) {
    grantedSkills.unshift(getCharacterSkill(WEAPON_RANGE_SKILLS[template.range]))
  }

  return grantedSkills.length > 0 ? grantedSkills : undefined
}

function normalizeTemplate(template: EquipmentTemplate): EquipmentTemplate {
  return {
    ...template,
    statBonuses: template.statBonuses.map((bonus) => ({ ...bonus })),
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
 * 指定したランクのドロップ対象装備テンプレートを取得
 */
export function getEquipmentByRank(rank: number): EquipmentTemplate[] {
  return templates.filter((t) => t.rank === rank)
}

/**
 * 装備プールのバージョン情報を取得
 */
export function getEquipmentPoolVersion(): string {
  return data.version
}
