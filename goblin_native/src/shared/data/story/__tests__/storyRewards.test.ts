import { storiesData } from '..'
import { getNamedGoblinSeed, getNamedGoblinSeedBySkillReward } from '../../namedGoblinSeeds'
import { getCharacterSkill } from '../../skillCatalog'

describe('story rewards', () => {
  it('異常固体マルクはゴブリン集落クリア後ストーリーの報酬になっている', () => {
    const storiesWithAbnormalMarku = storiesData
      .filter(story => story.rewards.some(reward => reward.type === 'skill' && reward.value === 'abnormal_marku'))
      .map(story => story.id)

    expect(storiesWithAbnormalMarku).toEqual(['story_after_goblin_village'])
  })

  it('サイドストーリークリア後の読了報酬が設定されている', () => {
    const shadowCatCleared = storiesData.find(story => story.id === 'side_shadow_cat_cleared')
    const necromancerCleared = storiesData.find(story => story.id === 'side_necromancer_cleared')

    expect(shadowCatCleared?.rewards).toEqual(expect.arrayContaining([
      { type: 'goblin', value: 'shadow' },
    ]))
    expect(necromancerCleared?.rewards).toEqual(expect.arrayContaining([
      { type: 'job', value: 'necromancer' },
    ]))
  })

  it('ネームド固有種ギド・ラグが対応ストーリーの読了報酬になっている', () => {
    const afterForest = storiesData.find(story => story.id === 'story_after_forest')
    const afterWolf = storiesData.find(story => story.id === 'story_after_wolf_grassland')

    expect(afterForest?.rewards).toEqual(expect.arrayContaining([
      { type: 'named_goblin', value: 'gido' },
    ]))
    expect(afterWolf?.rewards).toEqual(expect.arrayContaining([
      { type: 'named_goblin', value: 'ragu' },
    ]))
  })

  it('討伐隊戦後ストーリーがギドの遺志を named_goblin_skill 報酬として持つ', () => {
    const afterSubjugation = storiesData.find(story => story.id === 'story_after_subjugation')

    expect(afterSubjugation?.rewards).toEqual(expect.arrayContaining([
      { type: 'named_goblin_skill', value: 'gido_no_ishi' },
    ]))
  })

  it('named_goblin_skill 報酬の value が実在スキルかつ付与対象を解決できる', () => {
    const namedGoblinSkillValues = storiesData
      .flatMap(story => story.rewards)
      .filter(reward => reward.type === 'named_goblin_skill')
      .map(reward => String(reward.value))

    expect(namedGoblinSkillValues).toEqual(expect.arrayContaining(['gido_no_ishi']))
    for (const value of namedGoblinSkillValues) {
      expect(getCharacterSkill(value)).toBeDefined()
      // ギドの遺志 -> ギド(elder) のように付与対象が一意に解決できる
      expect(getNamedGoblinSeedBySkillReward(value)).toBeDefined()
    }
    expect(getNamedGoblinSeedBySkillReward('gido_no_ishi')?.raceId).toBe('elder')
  })

  it('named_goblin 報酬の value が namedGoblinSeeds に実在する', () => {
    const namedGoblinValues = storiesData
      .flatMap(story => story.rewards)
      .filter(reward => reward.type === 'named_goblin')
      .map(reward => reward.value)

    expect(namedGoblinValues).toEqual(expect.arrayContaining(['gido', 'ragu']))
    for (const value of namedGoblinValues) {
      expect(getNamedGoblinSeed(String(value))).toBeDefined()
    }
  })
})
