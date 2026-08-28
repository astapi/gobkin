import { reconcileTutorialStep } from '../Tutorial'

describe('reconcileTutorialStep', () => {
  it('クリア待ちのまま保存された攻略済み状態を結果確認へ進める', () => {
    expect(reconcileTutorialStep('wait_clear', true)).toBe('learn_factor')
  })

  it('未攻略または他ステップは変更しない', () => {
    expect(reconcileTutorialStep('wait_clear', false)).toBe('wait_clear')
    expect(reconcileTutorialStep('start_expedition', true)).toBe('start_expedition')
  })

  it('既存ユーザー向けの完了済み救済を維持する', () => {
    expect(reconcileTutorialStep('not_started', true)).toBe('completed')
  })
})
