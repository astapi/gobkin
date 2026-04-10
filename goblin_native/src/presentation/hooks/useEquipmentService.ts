import { useCallback, useMemo, useState } from 'react'
import type { EquipmentInstance } from '../../shared/types'
import { SQLiteEquipmentRepository } from '../../infrastructure/repositories/SQLiteEquipmentRepository'
import { EquipmentService } from '../../core/services/EquipmentService'
import type { Goblin } from '../../shared/types'
import { useGoblinStore } from '../stores/useGoblinStore'
import { calculateGoblinEffectiveStats } from '../../shared/utils/goblinStats'

export const useEquipmentService = () => {
  const [equippedItems, setEquippedItems] = useState<EquipmentInstance[]>([])
  const [inventoryItems, setInventoryItems] = useState<EquipmentInstance[]>([])

  const repository = useMemo(() => SQLiteEquipmentRepository.getInstance(), [])
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
      const result = EquipmentService.equip(goblin, equipment, slotIndex, equippedItems)
      if (!result.success) {
        return { success: false, error: result.error }
      }
      await repository.save(equipment)
      if (result.unequipped) {
        await repository.save(result.unequipped)
      }
      const updatedEquipped = await repository.getByGoblinId(goblin.id)
      await saveGoblin({
        ...goblin,
        effectiveStats: calculateGoblinEffectiveStats(goblin, updatedEquipped),
      })
      await refreshEquipment(goblin.id)
      return { success: true }
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
