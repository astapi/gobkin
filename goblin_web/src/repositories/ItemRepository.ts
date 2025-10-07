import type { Item } from '../types/index.ts'

export interface ItemRepository {
  getItems(): Item[]
  getItem(id: string): Item | null
  saveItem(item: Item): void
  deleteItem(id: string): void
}
