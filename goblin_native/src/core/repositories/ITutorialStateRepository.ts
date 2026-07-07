import type { TutorialStep } from '../../shared/types/Tutorial'

export interface ITutorialStateRepository {
  getStep(): Promise<TutorialStep>
  setStep(step: TutorialStep): Promise<void>
}
