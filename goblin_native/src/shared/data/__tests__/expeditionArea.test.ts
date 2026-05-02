import { areasData } from '..'
import { getEnemyDatabase } from '../enemy'
import { getAreaConfig } from '../expeditionArea'

describe('expedition areas', () => {
  it('表示用エリア定義と遠征生成用エリア定義の階数が一致している', () => {
    for (const area of areasData) {
      const config = getAreaConfig(area.id)

      expect(config).not.toBeNull()
      expect(config?.floors).toBe(area.floors)
    }
  })

  it('解放先エリアIDが存在している', () => {
    const areaIds = new Set(areasData.map(area => area.id))

    for (const area of areasData) {
      const unlockTargets = [
        ...(area.unlockNext ? [area.unlockNext] : []),
        ...(area.unlockNexts ?? []),
      ]

      for (const targetId of unlockTargets) {
        expect(areaIds.has(targetId)).toBe(true)
      }
    }
  })

  it('オークの砦は5階すべてに通常敵パターンがあり、最終階にボスパターンがある', () => {
    const area = areasData.find(area => area.id === 'orc_fortress_1')
    const enemyDatabase = getEnemyDatabase('orc_fortress_1')

    expect(area?.floors).toBe(5)
    expect(enemyDatabase).not.toBeNull()

    for (let floor = 1; floor <= 5; floor++) {
      expect(enemyDatabase?.patterns.some(pattern =>
        !pattern.isBoss && pattern.floors.includes(floor)
      )).toBe(true)
    }

    expect(enemyDatabase?.patterns.some(pattern =>
      pattern.isBoss && pattern.floors.includes(5)
    )).toBe(true)
  })
})
