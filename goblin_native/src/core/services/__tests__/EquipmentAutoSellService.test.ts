import { EquipmentAutoSellService } from '../EquipmentAutoSellService'
import type { EquipmentAutoSellSettings, TreasureDrop } from '../../../shared/types'

const drop: TreasureDrop = {
  templateId: 'sword_long',
  titleId: 'masterwork',
  prefixMod: { id: 'power', tier: 9 },
  suffixMod: { id: 'vitality', tier: 8 },
}

describe('EquipmentAutoSellService', () => {
  it('未設定の装備は残す', () => {
    expect(EquipmentAutoSellService.shouldAutoSell(drop, { version: 1, policies: {} })).toBe(false)
  })

  it('全部売る設定はMODに関係なく売却する', () => {
    const settings: EquipmentAutoSellSettings = {
      version: 1,
      policies: {
        sword_long: { mode: 'sell_all', keepRules: [] },
      },
    }
    expect(EquipmentAutoSellService.shouldAutoSell(drop, settings)).toBe(true)
  })

  it('詳細設定は同じルール内をAND、複数ルール間をORで判定する', () => {
    const settings: EquipmentAutoSellSettings = {
      version: 1,
      policies: {
        sword_long: {
          mode: 'rules',
          keepRules: [
            {
              titleIds: ['legendary'],
              prefixModIds: [],
              prefixTiers: [],
              suffixModIds: [],
              suffixTiers: [],
            },
            {
              titleIds: ['masterwork'],
              prefixModIds: ['power'],
              prefixTiers: [9],
              suffixModIds: ['vitality'],
              suffixTiers: [8],
            },
          ],
        },
      },
    }

    expect(EquipmentAutoSellService.shouldAutoSell(drop, settings)).toBe(false)
    expect(EquipmentAutoSellService.shouldAutoSell(
      { ...drop, suffixMod: { id: 'vitality', tier: 9 } },
      settings,
    )).toBe(true)
  })

  it('称号なし・MODなしを明示的に条件指定できる', () => {
    const settings: EquipmentAutoSellSettings = {
      version: 1,
      policies: {
        sword_long: {
          mode: 'rules',
          keepRules: [{
            titleIds: ['none'],
            prefixModIds: ['none'],
            prefixTiers: [],
            suffixModIds: ['none'],
            suffixTiers: [],
          }],
        },
      },
    }

    expect(EquipmentAutoSellService.shouldAutoSell({ templateId: 'sword_long' }, settings)).toBe(false)
    expect(EquipmentAutoSellService.shouldAutoSell(drop, settings)).toBe(true)
  })

  it('壊れたJSONから不正値と空ルールを除外する', () => {
    expect(EquipmentAutoSellService.normalizeSettings({
      policies: {
        sword_long: {
          mode: 'rules',
          keepRules: [
            { titleIds: [], prefixModIds: [], prefixTiers: [], suffixModIds: [], suffixTiers: [] },
            { titleIds: ['broken', 'invalid'], prefixModIds: ['vitality'], prefixTiers: [1, 99] },
          ],
        },
        invalid_policy: { mode: 'unknown' },
      },
    })).toEqual({
      version: 1,
      policies: {
        sword_long: {
          mode: 'rules',
          keepRules: [{
            titleIds: ['broken'],
            prefixModIds: [],
            prefixTiers: [1],
            suffixModIds: [],
            suffixTiers: [],
          }],
        },
      },
    })
  })
})
