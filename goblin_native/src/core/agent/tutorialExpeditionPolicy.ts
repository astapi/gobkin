import type { ExpeditionRequest } from '../../shared/types'
import type { TutorialStep } from '../../shared/types/Tutorial'

export interface TutorialExpeditionConfig {
  dungeonId: string
  tier: number
  targetFloor: number | null
  returnPolicy: ExpeditionRequest['returnPolicy']
}

export const TUTORIAL_EXPEDITION_REQUIREMENT = {
  dungeonId: 'slime_cave',
  tier: 0,
  targetFloor: null,
  returnPolicy: 'never',
} as const

const constrainedSteps: ReadonlySet<TutorialStep> = new Set([
  'select_dungeon',
  'start_expedition',
  'wait_clear',
])

export function getTutorialExpeditionRequirement(
  step: TutorialStep,
): typeof TUTORIAL_EXPEDITION_REQUIREMENT | null {
  return constrainedSteps.has(step) ? TUTORIAL_EXPEDITION_REQUIREMENT : null
}

/**
 * 初回チュートリアルを完了不能にしないため、完全踏破できる設定だけを許可する。
 * targetFloor は null（最下層）と、最下層の明示指定を同値として扱う。
 */
export function getTutorialExpeditionConfigError(
  step: TutorialStep,
  config: TutorialExpeditionConfig,
  dungeonFloors: number,
): string | null {
  if (!getTutorialExpeditionRequirement(step)) return null

  const reachesBottom = config.targetFloor === null || config.targetFloor === dungeonFloors
  if (
    config.dungeonId === TUTORIAL_EXPEDITION_REQUIREMENT.dungeonId &&
    config.tier === TUTORIAL_EXPEDITION_REQUIREMENT.tier &&
    reachesBottom &&
    config.returnPolicy === TUTORIAL_EXPEDITION_REQUIREMENT.returnPolicy
  ) {
    return null
  }

  return 'チュートリアル中はスライムの洞窟を通常難易度・最下層・帰還しない設定で攻略してください'
}
