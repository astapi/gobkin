import type { EquipmentSlot, Goblin, GoblinStats, Item, ItemEffect } from '../../shared/types'
import { addExperience, type LevelUpResult } from '../services/ExperienceSystem'

const MAX_EQUIPMENT_SLOTS = 5

export class GoblinEntity {
  private readonly base: Goblin
  private stats: GoblinStats
  private equipmentSlots: EquipmentSlot[]
  private level: number
  private experience: number

  constructor(goblin: Goblin) {
    this.base = {
      ...goblin,
      equipment: goblin.equipment.map(slot => ({ ...slot })),
      stats: { ...goblin.stats },
    }
    this.stats = { ...goblin.stats }
    this.equipmentSlots = this.base.equipment
    this.level = goblin.level
    this.experience = goblin.experience
  }

  public get id(): number {
    return this.base.id
  }

  public get name(): string {
    return this.base.name
  }

  public get currentLevel(): number {
    return this.level
  }

  public get currentExperience(): number {
    return this.experience
  }

  public calculateCombatPower(): number {
    const { atk, def, sp, spd, hp } = this.stats
    const equipmentScore = this.equipmentSlots.filter(slot => slot.itemId !== null).length * 5
    const rawPower = atk * 1.5 + def * 1.2 + sp + spd + hp / 10 + equipmentScore
    return Math.round(rawPower)
  }

  public canEquip(item: Item): boolean {
    if (this.equipmentSlots.length >= MAX_EQUIPMENT_SLOTS && this.noEmptySlots()) {
      return false
    }
    return !this.equipmentSlots.some(slot => slot.itemId === item.id)
  }

  public equipItem(item: Item, preferredSlotIndex?: number): number {
    if (!this.canEquip(item)) {
      throw new Error(`Item ${item.id}を装備できません`)
    }
    const slot = preferredSlotIndex !== undefined
      ? this.getOrCreateSlot(preferredSlotIndex)
      : this.findEmptySlot()
    if (!slot) {
      throw new Error('空きスロットがありません')
    }
    if (slot.itemId !== null) {
      throw new Error(`スロット${slot.slotIndex}には既に装備があります`)
    }
    slot.itemId = item.id
    this.applyItemEffect(item.effect)
    return slot.slotIndex
  }

  public takeDamage(damage: number): void {
    if (damage <= 0) return
    this.stats.hp = Math.max(0, this.stats.hp - Math.floor(damage))
  }

  /**
   * 経験値を獲得してレベルアップ処理を行う
   */
  public gainExperience(expAmount: number): LevelUpResult {
    const result = addExperience(this.level, this.experience, expAmount)
    this.level = result.newLevel
    this.experience = result.remainingExp

    // レベルアップした場合、ステータスを上昇させる（簡易実装）
    if (result.didLevelUp) {
      this.applyLevelUpBonus(result.levelsGained)
    }

    return result
  }

  public toSnapshot(): Goblin {
    return {
      ...this.base,
      level: this.level,
      experience: this.experience,
      stats: { ...this.stats },
      equipment: this.equipmentSlots.map(slot => ({ ...slot })),
    }
  }

  /**
   * レベルアップ時のステータス上昇処理
   * TODO: 種族ごとの成長率を設定する
   */
  private applyLevelUpBonus(levelsGained: number): void {
    for (let i = 0; i < levelsGained; i++) {
      this.stats = {
        hp: this.stats.hp + 5,
        atk: this.stats.atk + 2,
        def: this.stats.def + 1,
        sp: this.stats.sp + 1,
        spd: this.stats.spd + 1,
      }
    }
  }

  private applyItemEffect(effect: ItemEffect): void {
    this.stats = {
      hp: this.stats.hp + (effect.hp ?? 0),
      atk: this.stats.atk + (effect.atk ?? 0),
      sp: this.stats.sp + (effect.sp ?? 0),
      spd: this.stats.spd + (effect.spd ?? 0),
      def: this.stats.def + (effect.def ?? 0),
    }
  }

  private findEmptySlot(): EquipmentSlot | undefined {
    const existing = this.equipmentSlots.find(slot => slot.itemId === null)
    if (existing) return existing
    if (this.equipmentSlots.length < MAX_EQUIPMENT_SLOTS) {
      const newSlot: EquipmentSlot = { slotIndex: this.equipmentSlots.length, itemId: null }
      this.equipmentSlots.push(newSlot)
      this.sortSlots()
      return newSlot
    }
    return undefined
  }

  private noEmptySlots(): boolean {
    return !this.equipmentSlots.some(slot => slot.itemId === null)
  }

  private getOrCreateSlot(slotIndex: number): EquipmentSlot | undefined {
    if (slotIndex < 0 || slotIndex >= MAX_EQUIPMENT_SLOTS) {
      return undefined
    }
    const existing = this.equipmentSlots.find(slot => slot.slotIndex === slotIndex)
    if (existing) {
      return existing
    }
    const newSlot: EquipmentSlot = { slotIndex, itemId: null }
    this.equipmentSlots.push(newSlot)
    this.sortSlots()
    return newSlot
  }

  private sortSlots(): void {
    this.equipmentSlots.sort((a, b) => a.slotIndex - b.slotIndex)
  }
}
