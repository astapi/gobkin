import type { Goblin } from '../../shared/types'
import { GoblinEntity } from '../domain'
import type { IGoblinRepository, IItemRepository } from '../repositories'

export class EquipItemUseCase {
  private readonly goblinRepository: IGoblinRepository
  private readonly itemRepository: IItemRepository

  constructor(
    goblinRepository: IGoblinRepository,
    itemRepository: IItemRepository,
  ) {
    this.goblinRepository = goblinRepository
    this.itemRepository = itemRepository
  }

  public execute(goblinId: number, slotIndex: number, itemId: string): Goblin {
    const goblin = this.goblinRepository.getGoblin(goblinId)
    if (!goblin) {
      throw new Error('ゴブリンが見つかりません')
    }

    const item = this.itemRepository.getItem(itemId)
    if (!item) {
      throw new Error('アイテムが見つかりません')
    }

    const entity = new GoblinEntity(goblin)
    const equippedSlotIndex = entity.equipItem(item, slotIndex)
    const snapshot = entity.toSnapshot()

    this.goblinRepository.updateGoblinStats(goblinId, snapshot.stats)
    this.goblinRepository.equipItem(goblinId, equippedSlotIndex, item.id)

    return snapshot
  }
}
