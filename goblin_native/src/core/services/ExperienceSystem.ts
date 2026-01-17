/**
 * 経験値システム
 * レベル200までの複合曲線パターン経験値テーブル
 */

const MAX_LEVEL = 200
const BASE_EXP = 10

/**
 * 次のレベルに必要な経験値を取得
 * 複合曲線パターン:
 * - LV1-50:   基本値 × (レベル ^ 1.5)
 * - LV51-100: 基本値 × (レベル ^ 2.0)
 * - LV101-150: 基本値 × (レベル ^ 2.5)
 * - LV151-200: 基本値 × (レベル ^ 3.0)
 */
export function getExpForNextLevel(currentLevel: number): number {
  if (currentLevel >= MAX_LEVEL) {
    return 0 // レベル上限到達
  }

  const level = currentLevel
  let exponent: number

  if (level <= 50) {
    exponent = 1.5
  } else if (level <= 100) {
    exponent = 2.0
  } else if (level <= 150) {
    exponent = 2.5
  } else {
    exponent = 3.0
  }

  return Math.round(BASE_EXP * Math.pow(level, exponent))
}

/**
 * 指定レベルまでの累計経験値を取得
 */
export function getTotalExpForLevel(targetLevel: number): number {
  if (targetLevel <= 1) {
    return 0
  }

  let totalExp = 0
  for (let level = 1; level < targetLevel; level++) {
    totalExp += getExpForNextLevel(level)
  }

  return totalExp
}

/**
 * 経験値からレベルを計算
 */
export function calculateLevelFromExp(experience: number): number {
  if (experience <= 0) {
    return 1
  }

  let level = 1
  let accumulatedExp = 0

  while (level < MAX_LEVEL) {
    const expForNext = getExpForNextLevel(level)
    if (accumulatedExp + expForNext > experience) {
      break
    }
    accumulatedExp += expForNext
    level++
  }

  return level
}

/**
 * 経験値を加算してレベルアップ情報を返す
 */
export interface LevelUpResult {
  newLevel: number
  oldLevel: number
  levelsGained: number
  remainingExp: number
  didLevelUp: boolean
}

export function addExperience(
  currentLevel: number,
  currentExp: number,
  expToAdd: number
): LevelUpResult {
  if (currentLevel >= MAX_LEVEL) {
    return {
      newLevel: MAX_LEVEL,
      oldLevel: currentLevel,
      levelsGained: 0,
      remainingExp: currentExp,
      didLevelUp: false,
    }
  }

  const oldLevel = currentLevel
  let level = currentLevel
  let exp = currentExp + expToAdd
  let levelsGained = 0

  while (level < MAX_LEVEL) {
    const expForNext = getExpForNextLevel(level)
    if (exp < expForNext) {
      break
    }
    exp -= expForNext
    level++
    levelsGained++
  }

  return {
    newLevel: level,
    oldLevel,
    levelsGained,
    remainingExp: exp,
    didLevelUp: levelsGained > 0,
  }
}

/**
 * 現在のレベルでの経験値進捗率を取得（0.0〜1.0）
 */
export function getExpProgress(currentLevel: number, currentExp: number): number {
  if (currentLevel >= MAX_LEVEL) {
    return 1.0
  }

  const expForNext = getExpForNextLevel(currentLevel)
  if (expForNext === 0) {
    return 1.0
  }

  return Math.min(1.0, currentExp / expForNext)
}
