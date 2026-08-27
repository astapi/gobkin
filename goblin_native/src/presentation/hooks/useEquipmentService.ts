import { useCallback, useState } from 'react'
import type { EquipmentInstance } from '../../shared/types'
import { equipmentRepository } from '../di/repositories'
import { EquipmentService } from '../../core/services/EquipmentService'
import type { Goblin } from '../../shared/types'
import { useGoblinStore } from '../stores/useGoblinStore'
import { calculateGoblinEffectiveStats } from '../../shared/utils/goblinStats'

export const useEquipmentService = () => {
  const [equippedItems, setEquippedItems] = useState<EquipmentInstance[]>([])
  const [inventoryItems, setInventoryItems] = useState<EquipmentInstance[]>([])

  const repository = equipmentRepository
  const saveGoblin = useGoblinStore((state) => state.saveGoblin)

  const refreshEquipment = useCallback(
    async (goblinId: number) => {
      const equipped = await repository.getByGoblinId(goblinId)
      const inventory = await repository.getUnequipped()
      setEquippedItems(equipped)
      setInventoryItems(inventory)
    },
    [repository],
  )

  const equipItem = useCallback(
    async (goblin: Goblin, equipment: EquipmentInstance, slotIndex: number) => {
      // Service は引数を直接更新するため、React state 由来のオブジェクトを渡さない。
      const nextGoblin: Goblin = { ...goblin, skills: [...goblin.skills] }
      const nextEquipment: EquipmentInstance = { ...equipment }
      const result = EquipmentService.equip(nextGoblin, nextEquipment, slotIndex, equippedItems)
      if (!result.success) {
        return { success: false as const, error: result.error }
      }
      await repository.save(nextEquipment)
      if (result.unequipped) {
        await repository.save(result.unequipped)
      }
      const updatedEquipped = await repository.getByGoblinId(goblin.id)
      const effectiveStats = calculateGoblinEffectiveStats(goblin, updatedEquipped)
      await saveGoblin({
        ...nextGoblin,
        effectiveStats,
      })
      await refreshEquipment(goblin.id)
      return { success: true as const, effectiveStats }
    },
    [repository, equippedItems, refreshEquipment, saveGoblin],
  )

  const unequipItem = useCallback(
    async (goblin: Goblin, equipment: EquipmentInstance) => {
      const unequipped = EquipmentService.unequip(equipment, goblin)
      await repository.save(unequipped)
      const updatedEquipped = await repository.getByGoblinId(goblin.id)
      await saveGoblin({
        ...goblin,
        effectiveStats: calculateGoblinEffectiveStats(goblin, updatedEquipped),
      })
      await refreshEquipment(goblin.id)
    },
    [repository, refreshEquipment, saveGoblin],
  )

  return {
    equippedItems,
    inventoryItems,
    refreshEquipment,
    equipItem,
    unequipItem,
  }
}
