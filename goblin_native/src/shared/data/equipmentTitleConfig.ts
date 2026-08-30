import type { EquipmentTitleDef } from '../types/EquipmentTitle'

/**
 * 称号の定義一覧
 *
 * 抽選フロー:
 *   1. 付与判定: `運乱数 > 100 - effectiveTitleMultiplier × 30` を満たすかで「あり/なし」を決める
 *   2. 付与する場合のみ、Tier 別の判定回数だけ rollWeight に基づき抽選し、rank が最も高い称号を採用
 *
 * - rollWeight は「称号付き」の中での重み（合計 99999 = 約100%）
 * - rank は称号の優劣順（broken が最高、masterwork が最低）
 * - 'none' は付与判定で別経路扱いになるため rollWeight=0、rank=0 とする
 * - マイナス称号（worst / stinky）は廃止済み。その分の重みは masterwork に吸収させ、
 *   magical 以上の出現率は廃止前と同じに保っている
 */
export const EQUIPMENT_TITLE_DEFS: EquipmentTitleDef[] = [
  {
    id: 'none',
    name: '',
    plusMultiplier: 1.00,
    minusMultiplier: 1.00,
    priceMultiplier: 1.00,
    rollWeight: 0,
    rank: 0,
  },
  {
    id: 'masterwork',
    name: '名工の',
    plusMultiplier: 1.33,
    minusMultiplier: 0.75,
    priceMultiplier: 2.00,
    rollWeight: 95128,
    rank: 3,
  },
  {
    id: 'magical',
    name: '魔性の',
    plusMultiplier: 1.58,
    minusMultiplier: 0.63,
    priceMultiplier: 3.00,
    rollWeight: 3657,
    rank: 4,
  },
  {
    id: 'imbued',
    name: '宿った',
    plusMultiplier: 2.10,
    minusMultiplier: 0.48,
    priceMultiplier: 9.00,
    rollWeight: 914,
    rank: 5,
  },
  {
    id: 'legendary',
    name: '伝説の',
    plusMultiplier: 2.75,
    minusMultiplier: 0.36,
    priceMultiplier: 20.00,
    rollWeight: 229,
    rank: 6,
  },
  {
    id: 'terrifying',
    name: '恐ろしい',
    plusMultiplier: 3.50,
    minusMultiplier: 0.29,
    priceMultiplier: 42.00,
    rollWeight: 57,
    rank: 7,
  },
  {
    id: 'broken',
    name: '壊れた',
    plusMultiplier: 5.00,
    minusMultiplier: 0.20,
    priceMultiplier: 125.00,
    rollWeight: 14,
    rank: 8,
  },
]

/** 称号付与倍率の最大値 */
export const MAX_TITLE_MULTIPLIER = 99
