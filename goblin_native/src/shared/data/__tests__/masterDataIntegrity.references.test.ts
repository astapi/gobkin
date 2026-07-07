/**
 * マスターデータ整合性ラチェットテスト: 参照整合性（厳格チェック）
 *
 * 以下は現状違反ゼロのはずのため、例外リストなしで厳格にチェックする。
 * 新しく参照切れを追加してしまった場合、このテストが失敗して検知する。
 *
 *  (a) 敵JSON(factorDrops.factorId) -> factorDatabase(factors.ts + goblinVariants.ts)
 *  (b) 敵JSON(rareEquipmentDrops/tierRareEquipmentDrops の templateId) -> equipmentPool
 *  (c) 装備(grantedSkillIds) -> skillCatalog
 *  (d) allArea.json のエリアID <-> 敵DB(src/shared/data/enemy/) の対応
 *  (e) unlockNext/unlockNexts/unlockRequires が指すエリアIDの実在確認
 */
import { areasData } from '..'
import { getEnemyDatabase } from '../enemy'
import { getAreaConfig } from '../expeditionArea'
import { factorDatabase } from '../factors'
import { getEquipmentTemplates } from '../equipmentPoolLoader'
import { isCharacterSkillId } from '../skillCatalog'
import type { Enemy } from '../../types/Enemy'

const areaIds = areasData.map(area => area.id)
const factorIds = new Set(Object.keys(factorDatabase))
const equipmentTemplates = getEquipmentTemplates()
const equipmentTemplateIds = new Set(equipmentTemplates.map(t => t.id))

function collectEnemies(areaId: string): Enemy[] {
  const database = getEnemyDatabase(areaId)
  return database?.enemies ?? []
}

describe('参照整合性ラチェット(厳格チェック)', () => {
  it('(d) allArea.jsonのエリアIDと敵DBの対応が過不足なく揃っている', () => {
    for (const areaId of areaIds) {
      expect(getEnemyDatabase(areaId)).not.toBeNull()
      expect(getAreaConfig(areaId)).not.toBeNull()
    }
  })

  it('(e) unlockNext/unlockNexts/unlockRequires が指すエリアIDはすべて実在する', () => {
    const areaIdSet = new Set(areaIds)
    for (const area of areasData) {
      const referencedIds = [
        ...(area.unlockNext ? [area.unlockNext] : []),
        ...(area.unlockNexts ?? []),
        ...(area.unlockRequires ? [area.unlockRequires] : []),
      ]
      for (const referencedId of referencedIds) {
        expect(areaIdSet.has(referencedId)).toBe(true)
      }
    }
  })

  it('(a) 全敵JSONのfactorDrops.factorIdがfactorDatabaseに存在する', () => {
    const violations: string[] = []
    for (const areaId of areaIds) {
      for (const enemy of collectEnemies(areaId)) {
        for (const drop of enemy.factorDrops ?? []) {
          if (!factorIds.has(drop.factorId)) {
            violations.push(`${areaId}/${enemy.id}: 未知の factorId "${drop.factorId}"`)
          }
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('(b) 全敵JSONのドロップtemplateIdがequipmentPoolに存在する', () => {
    const violations: string[] = []
    for (const areaId of areaIds) {
      for (const enemy of collectEnemies(areaId)) {
        for (const drop of enemy.rareEquipmentDrops ?? []) {
          if (!equipmentTemplateIds.has(drop.templateId)) {
            violations.push(`${areaId}/${enemy.id}: 未知のtemplateId(rareEquipmentDrops) "${drop.templateId}"`)
          }
        }
        for (const tierDrop of enemy.tierRareEquipmentDrops ?? []) {
          for (const drop of tierDrop.drops) {
            if (!equipmentTemplateIds.has(drop.templateId)) {
              violations.push(
                `${areaId}/${enemy.id}: 未知のtemplateId(tierRareEquipmentDrops tier=${tierDrop.tier}) "${drop.templateId}"`
              )
            }
          }
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('(c) 装備のgrantedSkillIdsがskillCatalogに存在する', () => {
    const violations: string[] = []
    for (const template of equipmentTemplates) {
      for (const skillId of template.grantedSkillIds ?? []) {
        if (!isCharacterSkillId(skillId)) {
          violations.push(`${template.id}: 未知のskillId "${skillId}"`)
        }
      }
    }
    expect(violations).toEqual([])
  })
})
