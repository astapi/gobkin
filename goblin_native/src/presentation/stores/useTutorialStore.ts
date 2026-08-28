import { create } from 'zustand'
import {
  tutorialStateRepository as repository,
  dungeonProgressRepository as dungeonRepository,
} from '../di/repositories'
import {
  isAtOrAfter,
  reconcileTutorialStep,
  tutorialStepIndex,
  type TutorialStep,
} from '../../shared/types/Tutorial'

interface TutorialStoreState {
  step: TutorialStep
  isLoading: boolean
}

interface TutorialStoreActions {
  initialize: () => Promise<void>
  /** 引数のステップが現在より進んでいる場合のみ更新（巻き戻り防止） */
  advanceTo: (target: TutorialStep) => Promise<void>
  complete: () => Promise<void>
  /** デバッグ用: チュートリアルを最初からやり直す */
  reset: () => Promise<void>
}

const persistStep = async (step: TutorialStep) => {
  try {
    await repository.setStep(step)
  } catch (error) {
    console.error('[Tutorial] Failed to persist tutorial step:', error)
  }
}

export const useTutorialStore = create<TutorialStoreState & TutorialStoreActions>()((set, get) => ({
  step: 'not_started',
  isLoading: true,

  initialize: async () => {
    set({ isLoading: true })
    try {
      const stored = await repository.getStep()

      // 既存ユーザーと、攻略完了直後に終了して進行ステップだけ残った状態を救済する。
      if (stored === 'not_started' || stored === 'wait_clear') {
        const slimeProgress = await dungeonRepository.get('slime_cave')
        const reconciled = reconcileTutorialStep(stored, slimeProgress?.cleared === true)
        if (reconciled !== stored) {
          await persistStep(reconciled)
          set({ step: reconciled, isLoading: false })
          return
        }
      }

      set({ step: stored, isLoading: false })
    } catch (error) {
      console.error('[Tutorial] Failed to initialize:', error)
      set({ step: 'not_started', isLoading: false })
    }
  },

  advanceTo: async (target: TutorialStep) => {
    const current = get().step
    if (current === 'completed') return
    if (tutorialStepIndex(target) <= tutorialStepIndex(current)) return
    await persistStep(target)
    set({ step: target })
  },

  complete: async () => {
    if (get().step === 'completed') return
    await persistStep('completed')
    set({ step: 'completed' })
  },

  reset: async () => {
    await persistStep('not_started')
    set({ step: 'not_started' })
  },
}))

/** チュートリアルが現在のステップ以上に進んでいるか判定するセレクタ */
export const useTutorialReached = (target: TutorialStep): boolean =>
  isAtOrAfter(useTutorialStore(state => state.step), target)
