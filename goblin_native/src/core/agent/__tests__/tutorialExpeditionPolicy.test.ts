import {
  getTutorialExpeditionConfigError,
  getTutorialExpeditionRequirement,
} from '../tutorialExpeditionPolicy'

describe('tutorialExpeditionPolicy', () => {
  it('チュートリアル中は完全踏破できる設定を要求する', () => {
    expect(getTutorialExpeditionRequirement('start_expedition')).toEqual({
      dungeonId: 'slime_cave',
      tier: 0,
      targetFloor: null,
      returnPolicy: 'never',
    })

    expect(getTutorialExpeditionConfigError('start_expedition', {
      dungeonId: 'slime_cave',
      tier: 0,
      targetFloor: null,
      returnPolicy: 'never',
    }, 2)).toBeNull()

    expect(getTutorialExpeditionConfigError('wait_clear', {
      dungeonId: 'slime_cave',
      tier: 0,
      targetFloor: 2,
      returnPolicy: 'never',
    }, 2)).toBeNull()
  })

  it('途中階帰還や別ダンジョンを拒否する', () => {
    const partialFloorError = getTutorialExpeditionConfigError('start_expedition', {
      dungeonId: 'slime_cave',
      tier: 0,
      targetFloor: 1,
      returnPolicy: 'never',
    }, 2)
    expect(partialFloorError).toContain('最下層')

    const wrongDungeonError = getTutorialExpeditionConfigError('select_dungeon', {
      dungeonId: 'forest_outskirts',
      tier: 0,
      targetFloor: null,
      returnPolicy: 'never',
    }, 6)
    expect(wrongDungeonError).toContain('スライムの洞窟')
  })

  it('チュートリアル完了後は通常設定を制限しない', () => {
    expect(getTutorialExpeditionRequirement('completed')).toBeNull()
    expect(getTutorialExpeditionConfigError('completed', {
      dungeonId: 'forest_outskirts',
      tier: 2,
      targetFloor: 1,
      returnPolicy: 'if_any_ko',
    }, 6)).toBeNull()
  })
})
