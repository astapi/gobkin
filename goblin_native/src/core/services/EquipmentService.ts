import type { Goblin } from '../../shared/types/Goblin'
import type { CharacterSkill } from '../../shared/types/CharacterSkill'
import type { EquipmentInstance, EquipmentStatBonus, EquipmentEffect } from '../../shared/types/Equipment'
import { calculateSlotCount } from '../../shared/data/equipmentConfig'
import { getEquipmentTemplate } from '../../shared/data/equipmentPoolLoader'
import { cloneCharacterSkill } from '../../shared/data/characterSkills'

/**
 * 装備の着脱・バリデーション・ステータスボーナス計算を担当するサービス
 */
export class EquipmentService {
  /**
   * ゴブリンが利用可能なスロット数を取得
   */
  static getAvailableSlots(goblin: Goblin): number {
    return calculateSlotCount(goblin.level)
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
      this.removeGrantedSkills(goblin, existing.templateId)
    }

    // 装備を装着
    equipment.goblinId = goblin.id
    equipment.slotIndex = slotIndex
    this.addGrantedSkills(goblin, equipment.templateId)

    return { success: true, unequipped }
  }

  /**
   * 装備を外す（在庫に戻す）
   */
  static unequip(equipment: EquipmentInstance, goblin?: Goblin): EquipmentInstance {
    if (goblin) {
      this.removeGrantedSkills(goblin, equipment.templateId)
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
          sourceCategory: template.category,
        })
      }
    }

    return bonuses
  }

  /**
   * ゴブリンの装備から特殊効果を収集
   * ModStatCalculator に渡してステータス確定後に適用
   */
  static collectEquipmentEffects(
    equipped: EquipmentInstance[]
  ): EquipmentEffect[] {
    const effects: EquipmentEffect[] = []

    for (const eq of equipped) {
      const template = getEquipmentTemplate(eq.templateId)
      if (!template?.effects) continue

      for (const effect of template.effects) {
        effects.push({
          ...effect,
          sourceCategory: template.category,
        })
      }
    }

    return effects
  }

  static collectGrantedSkills(equipped: EquipmentInstance[]): CharacterSkill[] {
    const skills: CharacterSkill[] = []

    for (const eq of equipped) {
      const template = getEquipmentTemplate(eq.templateId)
      if (!template?.grantedSkills) continue

      for (const skill of template.grantedSkills) {
        skills.push(cloneCharacterSkill(skill))
      }
    }

    return skills
  }

  private static addGrantedSkills(goblin: Goblin, templateId: string): void {
    const template = getEquipmentTemplate(templateId)
    if (!template?.grantedSkills?.length) return

    for (const skill of template.grantedSkills) {
      goblin.skills.push(cloneCharacterSkill(skill))
    }
  }

  private static removeGrantedSkills(goblin: Goblin, templateId: string): void {
    const template = getEquipmentTemplate(templateId)
    if (!template?.grantedSkills?.length) return

    for (const grantedSkill of template.grantedSkills) {
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
