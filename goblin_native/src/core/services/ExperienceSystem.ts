/**
 * 経験値システム
 * レベル200までの近似曲線パターン経験値テーブル
 */

const MAX_LEVEL = 200
const EXP_CURVE_SCALE = 0.00032188652886324764
const EXP_CURVE_LEVEL_OFFSET = 9.17
const EXP_CURVE_EXPONENT = 4.735402233154439

/**
 * 次のレベルに必要な経験値を取得
 * 参考ゲームの観測値から推定した近似式:
 * 0.00032188652886324764 × (レベル + 9.17) ^ 4.735402233154439
 */
export function getExpForNextLevel(currentLevel: number): number {
  if (currentLevel >= MAX_LEVEL) {
    return 0 // レベル上限到達
  }

  const level = currentLevel
  return Math.round(
    EXP_CURVE_SCALE * Math.pow(level + EXP_CURVE_LEVEL_OFFSET, EXP_CURVE_EXPONENT)
  )
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
