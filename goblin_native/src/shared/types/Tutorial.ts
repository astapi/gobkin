export type TutorialStep =
  | 'not_started'
  | 'read_prologue'
  | 'see_first_goblin'
  | 'view_first_goblin'
  | 'open_formation'
  | 'edit_party'
  | 'select_party_member'
  | 'save_party'
  | 'select_dungeon'
  | 'start_expedition'
  | 'wait_clear'
  | 'completed'

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  'not_started',
  'read_prologue',
  'see_first_goblin',
  'view_first_goblin',
  'open_formation',
  'edit_party',
  'select_party_member',
  'save_party',
  'select_dungeon',
  'start_expedition',
  'wait_clear',
  'completed',
]

export const isTutorialStep = (value: unknown): value is TutorialStep =>
  typeof value === 'string' && (TUTORIAL_STEPS as readonly string[]).includes(value)

export const tutorialStepIndex = (step: TutorialStep): number =>
  TUTORIAL_STEPS.indexOf(step)

export const isAtOrAfter = (current: TutorialStep, target: TutorialStep): boolean =>
  tutorialStepIndex(current) >= tutorialStepIndex(target)
