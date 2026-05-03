import { getDatabase } from '../database'
import type { TutorialStep } from '../../shared/types/Tutorial'
import { isTutorialStep } from '../../shared/types/Tutorial'

const TUTORIAL_STEP_KEY = 'tutorial_step'

export interface ITutorialStateRepository {
  getStep(): Promise<TutorialStep>
  setStep(step: TutorialStep): Promise<void>
}

export class SQLiteTutorialStateRepository implements ITutorialStateRepository {
  private static instance: SQLiteTutorialStateRepository | null = null

  static getInstance(): SQLiteTutorialStateRepository {
    if (!SQLiteTutorialStateRepository.instance) {
      SQLiteTutorialStateRepository.instance = new SQLiteTutorialStateRepository()
    }
    return SQLiteTutorialStateRepository.instance
  }

  async getStep(): Promise<TutorialStep> {
    const db = await getDatabase()
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_metadata WHERE key = ?',
      [TUTORIAL_STEP_KEY]
    )
    if (!row) return 'not_started'
    return isTutorialStep(row.value) ? row.value : 'not_started'
  }

  async setStep(step: TutorialStep): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      'INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)',
      [TUTORIAL_STEP_KEY, step]
    )
  }
}
