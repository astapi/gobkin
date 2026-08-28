import { Alert } from 'react-native'
import type { TFunction } from 'i18next'
import { EquipmentAutoSellService } from '@/core/services/EquipmentAutoSellService'
import type {
  EquipmentAutoSellBulkFilter,
  EquipmentInstance,
  EquipmentTemplate,
  TreasureDrop,
} from '@/shared/types'
import type { EquipmentInventoryFilter } from '@/shared/utils/equipmentInventoryFilter'
import { getEquipmentDisplayName } from '@/shared/i18n/entityLocalization'
import { equipmentAutoSellFilterRepository } from '@/presentation/di/repositories'

function toTreasureDrop(equipment: EquipmentInstance): TreasureDrop {
  return {
    templateId: equipment.templateId,
    titleId: equipment.titleId,
    prefixMod: equipment.prefixMod,
    suffixMod: equipment.suffixMod,
  }
}

/** 売却した個体と完全一致する今後のドロップを、自動売却へ追加するか確認する。 */
export async function promptEquipmentAutoSell(
  equipment: EquipmentInstance,
  template: EquipmentTemplate,
  t: TFunction,
): Promise<void> {
  const drop = toTreasureDrop(equipment)

  try {
    const currentSettings = await equipmentAutoSellFilterRepository.getSettings()
    if (EquipmentAutoSellService.shouldAutoSell(drop, currentSettings)) return
  } catch (error) {
    console.error('[EquipmentAutoSell] Failed to inspect settings after manual sale', error)
  }

  const name = getEquipmentDisplayName(equipment, template)
  Alert.alert(
    t('ui.autoSell.manualPromptTitle'),
    t('ui.autoSell.manualPromptBody', { name }),
    [
      { text: t('ui.autoSell.manualPromptDecline'), style: 'cancel' },
      {
        text: t('ui.autoSell.manualPromptConfirm'),
        onPress: () => {
          void (async () => {
            try {
              const latestSettings = await equipmentAutoSellFilterRepository.getSettings()
              const nextSettings = EquipmentAutoSellService.addExactSellRule(latestSettings, drop)
              await equipmentAutoSellFilterRepository.saveSettings(nextSettings)
              Alert.alert(
                t('ui.autoSell.manualSavedTitle'),
                t('ui.autoSell.manualSavedBody', { name }),
              )
            } catch (error) {
              console.error('[EquipmentAutoSell] Failed to save manual sale filter', error)
              Alert.alert(t('ui.autoSell.errorTitle'), t('ui.autoSell.saveError'))
            }
          })()
        },
      },
    ],
  )
}

/** 一括売却に使ったフィルターを、今後のドロップへ適用するか確認する。 */
export async function promptEquipmentBulkAutoSell(
  soldEquipment: EquipmentInstance[],
  filter: EquipmentInventoryFilter,
  t: TFunction,
): Promise<void> {
  const bulkFilter: EquipmentAutoSellBulkFilter = {
    templateIds: [...new Set(soldEquipment.map(equipment => equipment.templateId))],
    titleIds: [...filter.titleIds],
    modCount: filter.modCount,
  }
  if (bulkFilter.templateIds.length === 0) return

  Alert.alert(
    t('ui.autoSell.bulkPromptTitle'),
    t('ui.autoSell.bulkPromptBody', { count: soldEquipment.length }),
    [
      { text: t('ui.autoSell.manualPromptDecline'), style: 'cancel' },
      {
        text: t('ui.autoSell.manualPromptConfirm'),
        onPress: () => {
          void (async () => {
            try {
              const latestSettings = await equipmentAutoSellFilterRepository.getSettings()
              const nextSettings = EquipmentAutoSellService.addBulkSellFilter(latestSettings, bulkFilter)
              await equipmentAutoSellFilterRepository.saveSettings(nextSettings)
              Alert.alert(
                t('ui.autoSell.manualSavedTitle'),
                t('ui.autoSell.bulkSavedBody'),
              )
            } catch (error) {
              console.error('[EquipmentAutoSell] Failed to save bulk sale filter', error)
              Alert.alert(t('ui.autoSell.errorTitle'), t('ui.autoSell.saveError'))
            }
          })()
        },
      },
    ],
  )
}
