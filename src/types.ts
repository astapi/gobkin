export interface Character {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  def: number;
  mag: number;
  res: number;
  agi: number;
  skills: Skill[];
  isDefending: boolean;
  isPlayer: boolean;
}

export interface Skill {
  id: string;
  name: string;
  mpCost: number;
  type: 'physical' | 'magical' | 'heal';
  power: number;
  targetType: 'single' | 'all';
  hitCount?: number;
}

export type CommandType = 'attack' | 'skill' | 'defend' | 'item' | 'escape';

export interface BattleCommand {
  actor: Character;
  type: CommandType;
  skill?: Skill;
  target?: Character | Character[];
  priority: number;
}

export interface BattleResult {
  damage?: number;
  healing?: number;
  message: string;
  isEscape?: boolean;
  escapeSuccess?: boolean;
}

export interface BattleState {
  playerParty: Character[];
  enemyParty: Character[];
  turn: number;
  isPlayerTurn: boolean;
  battleLog: string[];
  isFinished: boolean;
  playerWon?: boolean;
}

export interface Item {
  id: string;
  name: string;
  type: 'heal';
  value: number;
  quantity: number;
}