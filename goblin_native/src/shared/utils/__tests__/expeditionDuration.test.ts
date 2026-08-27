import { applyInstantDungeonExploration } from '../expeditionDuration'

describe('applyInstantDungeonExploration', () => {
  it('1秒デバッグ設定を連続するすべての周回へ適用する', () => {
    const durations = Array.from({ length: 3 }, () => (
      applyInstantDungeonExploration(600, true)
    ))

    expect(durations).toEqual([1, 1, 1])
  })

  it('戦闘シミュレーション用の通常時間は短縮しない', () => {
    expect(applyInstantDungeonExploration(600, false)).toBe(600)
  })
})
