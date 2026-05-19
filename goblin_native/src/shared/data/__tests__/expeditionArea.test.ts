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
        ...(area.unlockRequires ? [area.unlockRequires] : []),
        ...(area.unlockNext ? [area.unlockNext] : []),
        ...(area.unlockNexts ?? []),
      ]

      for (const targetId of unlockTargets) {
        expect(areaIds.has(targetId)).toBe(true)
      }
    }
  })

  it('スライムの洞窟以外は6〜8階で構成されている', () => {
    for (const area of areasData) {
      if (area.id === 'slime_cave') {
        expect(area.floors).toBe(2)
        continue
      }

      expect(area.floors).toBeGreaterThanOrEqual(6)
      expect(area.floors).toBeLessThanOrEqual(8)
    }
  })

  it('各階に通常敵パターンとフロアボス相当パターンがある', () => {
    for (const area of areasData) {
      const enemyDatabase = getEnemyDatabase(area.id)

      expect(enemyDatabase).not.toBeNull()

      for (let floor = 1; floor <= area.floors; floor++) {
        expect(enemyDatabase?.patterns.some(pattern =>
          !pattern.isBoss && !pattern.isFloorBoss && pattern.floors.includes(floor)
        )).toBe(true)

        if (area.id !== 'slime_cave') {
          expect(enemyDatabase?.patterns.some(pattern =>
            pattern.isFloorBoss && pattern.floors.includes(floor)
          )).toBe(true)
        }
      }

      const hasBossPattern = enemyDatabase?.patterns.some(pattern => pattern.isBoss) ?? false
      if (hasBossPattern) {
        expect(enemyDatabase?.patterns.some(pattern =>
          pattern.isBoss && pattern.floors.includes(area.floors)
        )).toBe(true)
      }
    }
  })
})
