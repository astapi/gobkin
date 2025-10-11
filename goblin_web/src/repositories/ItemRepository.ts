import type { Item } from '../shared/types'

export interface ItemRepository {
  getItems(): Item[]
  getItem(id: string): Item | null
  saveItem(item: Item): void
  deleteItem(id: string): void
}
