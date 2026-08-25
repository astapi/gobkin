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
  | 'learn_factor'
  | 'learn_unlock'
  | 'return_to_list'
  | 'open_goblin_list'
  | 'add_goblin'
  | 'finish'
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
  'learn_factor',
  'learn_unlock',
  'return_to_list',
  'open_goblin_list',
  'add_goblin',
  'finish',
  'completed',
]

export const isTutorialStep = (value: unknown): value is TutorialStep =>
  typeof value === 'string' && (TUTORIAL_STEPS as readonly string[]).includes(value)

export const tutorialStepIndex = (step: TutorialStep): number =>
  TUTORIAL_STEPS.indexOf(step)

export const isAtOrAfter = (current: TutorialStep, target: TutorialStep): boolean =>
  tutorialStepIndex(current) >= tutorialStepIndex(target)

/** 起動時に永続状態と攻略済みデータの食い違いを復旧する。 */
export const reconcileTutorialStep = (
  stored: TutorialStep,
  slimeCaveCleared: boolean,
): TutorialStep => {
  if (!slimeCaveCleared) return stored
  if (stored === 'not_started') return 'completed'
  if (stored === 'wait_clear') return 'learn_factor'
  return stored
}
