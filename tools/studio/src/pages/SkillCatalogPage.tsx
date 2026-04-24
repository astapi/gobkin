import { useMemo, useState } from 'react'

import { getCharacterSkillDescription } from '@app/shared/data/characterSkills'
import {
  CHARACTER_SKILL_CATALOG,
  getCharacterSkillDefinition,
} from '@app/shared/data/skillCatalog'
import ja from '@app/shared/i18n/resources/ja'
import { getSkillLabel } from '@app/shared/i18n/entityLocalization'

const ALL_SKILL_IDS = Object.keys(CHARACTER_SKILL_CATALOG).sort()

export function SkillCatalogPage() {
  const [query, setQuery] = useState('')

  const skillRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return ALL_SKILL_IDS.filter((skillId) => {
      if (normalizedQuery === '') return true

      const skill = getCharacterSkillDefinition(skillId)
      return (
        skillId.toLowerCase().includes(normalizedQuery) ||
        getJapaneseSkillLabel(skillId).toLowerCase().includes(normalizedQuery) ||
        getCharacterSkillDescription(skill).toLowerCase().includes(normalizedQuery)
      )
    })
  }, [query])

  return (
    <div className="detail">
      <div className="detail-head">
        <div>
          <h2>スキル</h2>
          <p className="subtle">ゴブリン専用ではなく、ゲーム全体で使う skill 定義の一覧です。</p>
        </div>
      </div>

      <section className="card">
        <div className="section-head">
          <h3>Skill Catalog</h3>
          <input
            type="search"
            className="search-input goblin-skill-search"
            placeholder="skillId / 名前 / 説明で絞り込み"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <table className="enemy-table skill-catalog-table">
          <thead>
            <tr>
              <th className="skill-col-id">skillId</th>
              <th className="skill-col-name">日本語名</th>
              <th className="skill-col-description">説明</th>
              <th className="skill-col-definition">定義</th>
            </tr>
          </thead>
          <tbody>
            {skillRows.map((skillId) => {
              const skill = getCharacterSkillDefinition(skillId)
              return (
                <tr key={skillId}>
                  <td className="skill-col-id"><code>{skillId}</code></td>
                  <td className="skill-col-name">{getJapaneseSkillLabel(skillId)}</td>
                  <td className="skill-col-description">{getCharacterSkillDescription(skill)}</td>
                  <td className="skill-col-definition">
                    <code>{compactSkill(skill)}</code>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function compactSkill(skill: object): string {
  const filtered = Object.fromEntries(
    Object.entries(skill as Record<string, unknown>).filter(([key]) => key !== 'id'),
  )
  return JSON.stringify(filtered)
}

function getJapaneseSkillLabel(skillId: string): string {
  const localized = ja.entities.skill[skillId as keyof typeof ja.entities.skill]?.name
  if (localized) return localized
  return getSkillLabel(getCharacterSkillDefinition(skillId))
}
