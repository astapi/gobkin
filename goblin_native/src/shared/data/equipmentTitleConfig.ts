import type { EquipmentTitleDef } from '../types/EquipmentTitle'

/**
 * 称号の定義一覧
 *
 * 抽選時の重み計算: weight(M) = baseWeight × M^power
 * 「称号なし」は固定重みで、倍率が上がると相対的に確率が下がる。
 * レア称号ほど power が高く、倍率上昇の恩恵が大きい。
 *
 * 倍率1倍時: 壊れた=0.01%、称号なし=88%
 * 倍率99倍時: 壊れた≈1.5%、称号なし≈6%
 */
export const EQUIPMENT_TITLE_DEFS: EquipmentTitleDef[] = [
  {
    id: 'worst',
    name: '最低な',
    plusMultiplier: 0.50,
    minusMultiplier: 2.00,
    priceMultiplier: 0.50,
    baseWeight: 200,
    power: 0.3,
  },
  {
    id: 'stinky',
    name: '臭い',
    plusMultiplier: 0.80,
    minusMultiplier: 1.25,
    priceMultiplier: 0.80,
    baseWeight: 300,
    power: 0.3,
  },
  {
    id: 'none',
    name: '',
    plusMultiplier: 1.00,
    minusMultiplier: 1.00,
    priceMultiplier: 1.00,
    baseWeight: 8800,
    power: 0, // 固定重み
  },
  {
    id: 'masterwork',
    name: '名工の',
    plusMultiplier: 1.33,
    minusMultiplier: 0.75,
    priceMultiplier: 2.00,
    baseWeight: 400,
    power: 1.0,
  },
  {
    id: 'magical',
    name: '魔性の',
    plusMultiplier: 1.58,
    minusMultiplier: 0.63,
    priceMultiplier: 3.00,
    baseWeight: 200,
    power: 1.1,
  },
  {
    id: 'imbued',
    name: '宿った',
    plusMultiplier: 2.10,
    minusMultiplier: 0.48,
    priceMultiplier: 9.00,
    baseWeight: 80,
    power: 1.25,
  },
  {
    id: 'legendary',
    name: '伝説の',
    plusMultiplier: 2.75,
    minusMultiplier: 0.36,
    priceMultiplier: 20.00,
    baseWeight: 15,
    power: 1.55,
  },
  {
    id: 'terrifying',
    name: '恐ろしい',
    plusMultiplier: 3.50,
    minusMultiplier: 0.29,
    priceMultiplier: 42.00,
    baseWeight: 4,
    power: 1.80,
  },
  {
    id: 'broken',
    name: '壊れた',
    plusMultiplier: 5.00,
    minusMultiplier: 0.20,
    priceMultiplier: 125.00,
    baseWeight: 1,
    power: 1.67,
  },
]

/** 称号付与倍率の最大値 */
export const MAX_TITLE_MULTIPLIER = 99
