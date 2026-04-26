import type { Goblin } from '../../shared/types/Goblin'
import type { CharacterSkill } from '../../shared/types/CharacterSkill'
import type { EquipmentInstance, EquipmentStatBonus } from '../../shared/types/Equipment'
import { calculateSlotCount } from '../../shared/data/equipmentConfig'
import { getEquipmentTemplate } from '../../shared/data/equipmentPoolLoader'
import { cloneCharacterSkill, hasItemSlotsBonusSkill } from '../../shared/data/characterSkills'
import { EquipmentTitleService } from './EquipmentTitleService'

/**
 * 装備の着脱・バリデーション・ステータスボーナス計算を担当するサービス
 */
export class EquipmentService {
  private static scaleValueByTitle(value: number, equipment: EquipmentInstance): number {
    if (value === 0 || !equipment.titleId) {
      return value
    }

    const titleDef = EquipmentTitleService.getTitleDef(equipment.titleId)
    if (!titleDef) {
      return value
    }

    if (value > 0) {
      if (!Number.isInteger(value)) {
        return Number((value * titleDef.plusMultiplier).toFixed(4))
      }
      return Math.floor(value * titleDef.plusMultiplier)
    }

    if (!Number.isInteger(value)) {
      return -Number((Math.abs(value) * titleDef.minusMultiplier).toFixed(4))
    }

    return -Math.floor(Math.abs(value) * titleDef.minusMultiplier)
  }

  private static scaleGrantedSkillByTitle(skill: CharacterSkill, equipment: EquipmentInstance): CharacterSkill {
    const scaled = cloneCharacterSkill(skill)

    if (scaled.defToHpPercent !== undefined) {
      scaled.defToHpPercent = this.scaleValueByTitle(scaled.defToHpPercent, equipment)
    }

    if (scaled.magicHealToHpPercent !== undefined) {
      scaled.magicHealToHpPercent = this.scaleValueByTitle(scaled.magicHealToHpPercent, equipment)
    }

    if (scaled.criticalDamageBonusPercent !== undefined) {
      scaled.criticalDamageBonusPercent = this.scaleValueByTitle(scaled.criticalDamageBonusPercent, equipment)
    }

    return scaled
  }

  /**
   * ゴブリンが利用可能なスロット数を取得
   */
  static getAvailableSlots(goblin: Goblin): number {
    const hasBonus = hasItemSlotsBonusSkill(goblin.skills ?? [])
    return calculateSlotCount(goblin.level, hasBonus)
  }

  /**
   * 装備の装着可否チェック
   */
  static canEquip(
    goblin: Goblin,
    slotIndex: number,
    equipped: EquipmentInstance[]
  ): { canEquip: boolean; reason?: string } {
    const maxSlots = this.getAvailableSlots(goblin)

    if (slotIndex < 0 || slotIndex >= maxSlots) {
      return { canEquip: false, reason: `スロット${slotIndex}は使用できません（最大${maxSlots}枠）` }
    }

    return { canEquip: true }
  }

  /**
   * ゴブリンに装備を装着
   * 同一スロットに既存装備がある場合は外して返す
   */
  static equip(
    goblin: Goblin,
    equipment: EquipmentInstance,
    slotIndex: number,
    equipped: EquipmentInstance[]
  ): { success: boolean; error?: string; unequipped?: EquipmentInstance } {
    const check = this.canEquip(goblin, slotIndex, equipped)
    if (!check.canEquip) {
      return { success: false, error: check.reason }
    }

    // 同一スロットの既存装備を外す
    const existing = equipped.find((eq) => eq.slotIndex === slotIndex)
    let unequipped: EquipmentInstance | undefined
    if (existing) {
      unequipped = this.unequip(existing)
      this.removeGrantedSkills(goblin, existing)
    }

    // 装備を装着
    equipment.goblinId = goblin.id
    equipment.slotIndex = slotIndex
    this.addGrantedSkills(goblin, equipment)

    return { success: true, unequipped }
  }

  /**
   * 装備を外す（在庫に戻す）
   */
  static unequip(equipment: EquipmentInstance, goblin?: Goblin): EquipmentInstance {
    if (goblin) {
      this.removeGrantedSkills(goblin, equipment)
    }

    return {
      ...equipment,
      slotIndex: -1,
      goblinId: null,
    }
  }

  /**
   * ゴブリンの装備からステータスボーナスを合算
   * ModStatCalculator に渡すためのデータを生成
   */
  static calculateEquipmentBonuses(
    equipped: EquipmentInstance[]
  ): EquipmentStatBonus[] {
    const bonuses: EquipmentStatBonus[] = []

    for (const eq of equipped) {
      const template = getEquipmentTemplate(eq.templateId)
      if (!template) continue

      for (const bonus of template.statBonuses) {
        bonuses.push({
          ...bonus,
          value: this.scaleValueByTitle(bonus.value, eq),
          sourceCategory: template.category,
          sourceSubCategory: template.subCategory,
        })
      }
    }

    return bonuses
  }

  static collectGrantedSkills(equipped: EquipmentInstance[]): CharacterSkill[] {
    const skills: CharacterSkill[] = []

    for (const eq of equipped) {
      const template = getEquipmentTemplate(eq.templateId)
      if (!template?.grantedSkills) continue

      for (const skill of template.grantedSkills) {
        skills.push(this.scaleGrantedSkillByTitle(skill, eq))
      }
    }

    return skills
  }

  private static addGrantedSkills(goblin: Goblin, equipment: EquipmentInstance): void {
    for (const skill of this.collectGrantedSkills([equipment])) {
      goblin.skills.push(skill)
    }
  }

  private static removeGrantedSkills(goblin: Goblin, equipment: EquipmentInstance): void {
    for (const grantedSkill of this.collectGrantedSkills([equipment])) {
      const index = goblin.skills.findIndex((skill) => this.isSameSkill(skill, grantedSkill))
      if (index >= 0) {
        goblin.skills.splice(index, 1)
      }
    }
  }

  private static isSameSkill(a: CharacterSkill, b: CharacterSkill): boolean {
    return a.id === b.id
  }
}
