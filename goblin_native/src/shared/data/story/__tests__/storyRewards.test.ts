import { storiesData } from '..'

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
})
