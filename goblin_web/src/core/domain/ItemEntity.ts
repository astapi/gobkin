import type { Item, ItemEffect } from '../../shared/types'

export class ItemEntity {
  private readonly item: Item

  constructor(item: Item) {
    this.item = item
  }

  public calculateBonus(): number {
    return Object.values(this.item.effect).reduce((sum, value) => sum + (value ?? 0), 0)
  }

  public getEffect(): ItemEffect {
    return { ...this.item.effect }
  }

  public toSnapshot(): Item {
    return { ...this.item, effect: { ...this.item.effect } }
  }
}
