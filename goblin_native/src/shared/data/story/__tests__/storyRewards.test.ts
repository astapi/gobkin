import { storiesData } from '..'

describe('story rewards', () => {
  it('異常固体マルクはゴブリン集落クリア後ストーリーの報酬になっている', () => {
    const storiesWithAbnormalMarku = storiesData
      .filter(story => story.rewards.some(reward => reward.type === 'skill' && reward.value === 'abnormal_marku'))
      .map(story => story.id)

    expect(storiesWithAbnormalMarku).toEqual(['story_after_goblin_village'])
  })
})
