import type { Goblin, BattleLogEntry } from '../shared/types';
import type { Enemy } from '../shared/types';
import type { Combatant, Skill } from './damage.ts';
import { calcDamage } from './damage.ts';
import { goblinToCombatant, enemyToCombatant } from './combatant.ts';

/**
 * 戦闘参加者の状態
 */
interface BattleUnit {
  combatant: Combatant;
  currentHP: number;
  maxHP: number;
  initialHP: number; // 戦闘開始時のHP
  spd: number;
  isAlly: boolean;
  originalIndex: number; // パーティまたは敵グループでの元のインデックス
}

/**
 * 戦闘結果
 */
export interface BattleResult {
  rounds: number;
  outcome: "win" | "lose" | "retreat";
  allyHPDelta: number[]; // 各味方のHP変化量
  enemyDefeated: number; // 倒した敵の数
  detailedLog: BattleLogEntry[]; // 詳細な戦闘ログ
}

/**
 * 種族辞書（簡易版）
 */
const RACE_DICT = {
  goblin: { label: 'ゴブリン' },
  wolf: { label: '狼' },
  bat: { label: 'コウモリ' },
  slime: { label: 'スライム' },
  skeleton: { label: 'スケルトン' },
  orc: { label: 'オーク' },
  troll: { label: 'トロール' },
};

/**
 * 基本攻撃スキル
 */
const BASIC_ATTACK_SKILL: Skill = {
  id: 'basic_attack',
  name: '通常攻撃',
  power: 1.0,
};

/**
 * ターン制戦闘を実行
 *
 * @param allies - 味方のゴブリンリスト
 * @param initialAllyHP - 各味方の初期HP（戦闘開始時のHP、0の場合は戦闘不能）
 * @param enemies - 敵のリスト
 * @param rng - 乱数生成関数
 * @param maxTurns - 最大ターン数（デフォルト20）
 * @returns 戦闘結果
 */
export function executeBattle(
  allies: Goblin[],
  initialAllyHP: number[],
  enemies: Enemy[],
  rng: () => number,
  maxTurns: number = 20
): BattleResult {
  // 戦闘ユニットの初期化
  const allyUnits: BattleUnit[] = allies.map((goblin, index) => {
    const initialHP = initialAllyHP[index] ?? goblin.stats.hp;
    return {
      combatant: goblinToCombatant(goblin),
      currentHP: initialHP,
      maxHP: goblin.stats.hp,
      initialHP: initialHP,
      spd: goblin.stats.spd,
      isAlly: true,
      originalIndex: index,
    };
  });

  const enemyUnits: BattleUnit[] = enemies.map((enemy, index) => ({
    combatant: enemyToCombatant(enemy),
    currentHP: enemy.hp,
    maxHP: enemy.hp,
    initialHP: enemy.hp,
    spd: enemy.spd,
    isAlly: false,
    originalIndex: index,
  }));

  const detailedLog: BattleLogEntry[] = [];
  let currentTurn = 0;

  // 戦闘ループ
  while (currentTurn < maxTurns) {
    currentTurn++;

    // ターン開始時の状態をログに記録
    const turnStartLog: BattleLogEntry = {
      turn: currentTurn,
      actorId: 'system',
      actorName: 'ターン開始',
      action: 'turn_start',
      targetId: '',
      targetName: '',
      damage: 0,
      isAlly: true,
      targetDefeated: false,
      actorHP: 0,
      targetHP: 0,
      turnState: {
        allies: allyUnits.map(u => ({
          id: u.combatant.id,
          name: u.combatant.name,
          currentHP: u.currentHP,
          maxHP: u.maxHP,
        })),
        enemies: enemyUnits.map(u => ({
          id: u.combatant.id,
          name: u.combatant.name,
          currentHP: u.currentHP,
          maxHP: u.maxHP,
        })),
      },
    };
    detailedLog.push(turnStartLog);

    // 行動順の決定（spd順、敵味方混合）
    const allUnits = [...allyUnits, ...enemyUnits].filter(u => u.currentHP > 0);
    allUnits.sort((a, b) => b.spd - a.spd);

    // 各ユニットが行動
    for (const unit of allUnits) {
      // 既に倒れている場合はスキップ
      if (unit.currentHP <= 0) continue;

      // ターゲット選択（相手陣営からランダム）
      const targetGroup = unit.isAlly ? enemyUnits : allyUnits;
      const aliveTargets = targetGroup.filter(t => t.currentHP > 0);

      if (aliveTargets.length === 0) break;

      const target = aliveTargets[Math.floor(rng() * aliveTargets.length)];

      // ダメージ計算
      const damage = calcDamage(
        RACE_DICT,
        unit.combatant,
        target.combatant,
        BASIC_ATTACK_SKILL,
        {
          defConstant: 100,
          randomMin: 0.95,
          randomMax: 1.05,
        }
      );

      // ダメージ適用
      target.currentHP = Math.max(0, target.currentHP - damage);
      const targetDefeated = target.currentHP <= 0;

      // 詳細ログ記録
      detailedLog.push({
        turn: currentTurn,
        actorId: unit.combatant.id,
        actorName: unit.combatant.name,
        action: BASIC_ATTACK_SKILL.name,
        targetId: target.combatant.id,
        targetName: target.combatant.name,
        damage,
        isAlly: unit.isAlly,
        targetDefeated,
        actorHP: unit.currentHP,
        targetHP: target.currentHP,
      });
    }

    // 戦闘終了判定
    const allyAlive = allyUnits.some(u => u.currentHP > 0);
    const enemyAlive = enemyUnits.some(u => u.currentHP > 0);

    if (!allyAlive) {
      // 味方全滅 → 敗北
      return createBattleResult(
        currentTurn,
        'lose',
        allyUnits,
        enemyUnits,
        detailedLog
      );
    }

    if (!enemyAlive) {
      // 敵全滅 → 勝利
      return createBattleResult(
        currentTurn,
        'win',
        allyUnits,
        enemyUnits,
        detailedLog
      );
    }
  }

  // 最大ターン到達 → 退却
  return createBattleResult(
    currentTurn,
    'retreat',
    allyUnits,
    enemyUnits,
    detailedLog
  );
}

/**
 * 戦闘結果を生成
 */
function createBattleResult(
  rounds: number,
  outcome: "win" | "lose" | "retreat",
  allyUnits: BattleUnit[],
  enemyUnits: BattleUnit[],
  detailedLog: BattleLogEntry[]
): BattleResult {
  // 各味方のHP変化量を計算（戦闘開始時からの変化）
  const allyHPDelta = allyUnits.map(unit => unit.currentHP - unit.initialHP);

  // 倒した敵の数
  const enemyDefeated = enemyUnits.filter(u => u.currentHP <= 0).length;

  return {
    rounds,
    outcome,
    allyHPDelta,
    enemyDefeated,
    detailedLog,
  };
}
