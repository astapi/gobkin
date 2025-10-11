import { useState, useEffect } from 'react'
import type { Goblin, Item, GoblinStats } from '../shared/types'
import type { GoblinRepository } from '../repositories/GoblinRepository.ts'
import type { ItemRepository } from '../repositories/ItemRepository.ts'
import { FirestoreItemRepositoryAdapter } from '../repositories/FirestoreItemRepositoryImpl.ts'

interface GoblinDetailModalProps {
  goblin: Goblin | null
  onClose: () => void
  goblinRepository: GoblinRepository
  itemRepository?: ItemRepository
}

const defaultItemRepository = new FirestoreItemRepositoryAdapter()

export const GoblinDetailModal = ({
  goblin,
  onClose,
  goblinRepository,
  itemRepository = defaultItemRepository
}: GoblinDetailModalProps) => {
  const [items, setItems] = useState<Item[]>([])
  const [currentGoblin, setCurrentGoblin] = useState<Goblin | null>(goblin)

  const initializeEquipment = (goblin: Goblin | null): Goblin | null => {
    if (!goblin) return null
    if (!goblin.equipment || !Array.isArray(goblin.equipment)) {
      return {
        ...goblin,
        equipment: [
          { slotIndex: 0, itemId: null },
          { slotIndex: 1, itemId: null },
          { slotIndex: 2, itemId: null },
          { slotIndex: 3, itemId: null },
          { slotIndex: 4, itemId: null }
        ]
      }
    }
    return goblin
  }

  useEffect(() => {
    setItems(itemRepository.getItems())

    const handleItemChange = () => {
      setItems([...itemRepository.getItems()])
    }

    const handleGoblinChange = () => {
      if (goblin) {
        const updatedGoblin = goblinRepository.getGoblin(goblin.id)
        setCurrentGoblin(initializeEquipment(updatedGoblin))
      }
    }

    itemRepository.setOnDataChange(handleItemChange)
    goblinRepository.setOnDataChange(handleGoblinChange)
  }, [goblin, goblinRepository, itemRepository])

  useEffect(() => {
    setCurrentGoblin(initializeEquipment(goblin))
  }, [goblin])

  const handleEquipItem = (slotIndex: number, itemId: string) => {
    console.log(slotIndex, itemId);
    console.log(currentGoblin);
    if (currentGoblin) {
      goblinRepository.equipItem(currentGoblin.id, slotIndex, itemId)
    }
  }

  const handleUnequipItem = (slotIndex: number) => {
    if (currentGoblin) {
      goblinRepository.unequipItem(currentGoblin.id, slotIndex)
    }
  }

  if (!currentGoblin) return null

  const calculateTotalStats = (): GoblinStats => {
    const totalStats = { ...currentGoblin.stats }

    if (currentGoblin.equipment && Array.isArray(currentGoblin.equipment)) {
      currentGoblin.equipment.forEach(slot => {
        if (slot.itemId) {
          const item = items.find(i => i.id === slot.itemId)
          if (item) {
            totalStats.hp += item.effect.hp || 0
            totalStats.atk += item.effect.atk || 0
            totalStats.sp += item.effect.sp || 0
            totalStats.spd += item.effect.spd || 0
            totalStats.def += item.effect.def || 0
          }
        }
      })
    }

    return totalStats
  }

  const totalStats = calculateTotalStats()

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col max-w-[414px] mx-auto">
      <div className="flex gap-4 items-center p-5 text-white bg-gray-800 shadow-lg">
        <button
          onClick={onClose}
          className="p-2 text-xl rounded transition-colors hover:bg-white/20"
        >
          ←
        </button>
        <h2 className="text-lg font-bold tracking-wide">ゴブリン詳細</h2>
      </div>

      <div className="overflow-y-auto flex-1 p-6">
        <div className="p-6 bg-white rounded-xl border-2 border-gray-200 shadow-md">
          <div className="flex gap-4 items-center pb-4 mb-6 border-b-2 border-gray-100">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center border-[3px] border-gray-400 overflow-hidden">
              <img src={currentGoblin.avatar} alt={currentGoblin.name} className="object-cover w-full h-full" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-800">{currentGoblin.name}</h3>
              <div className="mt-1 text-base text-gray-600">{currentGoblin.race}</div>
              <div className="text-lg font-bold text-gray-800">Lv.{currentGoblin.level}</div>
            </div>
          </div>

          <div className="mt-2">
            <div className="pb-2 mb-3 text-lg font-bold text-gray-800 border-b border-gray-200">
              ステータス
            </div>
            <div className="flex flex-col gap-2">
              {(['hp', 'atk', 'def', 'spd', 'sp'] as const).map((key) => {
                const value = totalStats[key]
                const baseValue = currentGoblin.stats[key]
                const bonus = value - baseValue
                return (
                  <div key={key} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-300">
                    <div className="text-sm font-bold text-gray-700">
                      {key.toUpperCase()}
                    </div>
                    <div className="text-base font-bold text-gray-600">
                      {baseValue}
                      {bonus > 0 && <span className="ml-1 text-green-600">+{bonus}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {currentGoblin.equipment && Array.isArray(currentGoblin.equipment) && (
            <div className="mt-6">
              <div className="pb-2 mb-3 text-lg font-bold text-gray-800 border-b border-gray-200">
                装備
              </div>
              <div className="flex flex-col gap-2">
                {currentGoblin.equipment.map((slot) => {
                const equippedItem = slot.itemId ? items.find(i => i.id === slot.itemId) : null
                return (
                  <div key={slot.slotIndex} className="p-3 bg-gray-50 rounded-lg border border-gray-300">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-sm font-bold text-gray-700">
                        スロット {slot.slotIndex + 1}
                      </div>
                      {equippedItem && (
                        <button
                          onClick={() => handleUnequipItem(slot.slotIndex)}
                          className="px-2 py-1 text-xs text-white bg-red-500 rounded hover:bg-red-600"
                        >
                          解除
                        </button>
                      )}
                    </div>
                    {equippedItem ? (
                      <div className="text-sm">
                        <div className="font-bold text-gray-800">{equippedItem.name}</div>
                        <div className="mt-1 text-xs text-gray-600">{equippedItem.description}</div>
                      </div>
                    ) : (
                      <select
                        className="p-1 w-full text-sm rounded border border-gray-300"
                        onChange={(e) => {
                          if (e.target.value) {
                            handleEquipItem(slot.slotIndex, e.target.value)
                          }
                        }}
                        value=""
                      >
                        <option value="">アイテムを選択</option>
                        {items.map(item => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  )
}