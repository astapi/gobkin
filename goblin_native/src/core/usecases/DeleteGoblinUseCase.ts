import type { IGoblinRepository } from '../repositories/IGoblinRepository'
import type { IEquipmentRepository } from '../repositories/IEquipmentRepository'
import { EquipmentService } from '../services/EquipmentService'

export class DeleteGoblinUseCase {
  constructor(
    private readonly goblinRepository: IGoblinRepository,
    private readonly equipmentRepository: IEquipmentRepository,
  ) {}

  public async execute(goblinId: number): Promise<void> {
    const goblin = await this.goblinRepository.getGoblin(goblinId)
    if (!goblin) {
      throw new Error(`ID ${goblinId} のゴブリンが見つかりません`)
    }

    const equippedItems = await this.equipmentRepository.getByGoblinId(goblinId)

    if (equippedItems.length > 0) {
      for (const equipment of equippedItems) {
        const unequipped = EquipmentService.unequip(equipment, goblin)
        await this.equipmentRepository.save(unequipped)
      }

      await this.goblinRepository.saveGoblin({ ...goblin })
    }

    await this.goblinRepository.deleteGoblin(goblinId)
  }
}
