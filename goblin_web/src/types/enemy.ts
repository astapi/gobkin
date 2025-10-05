export type Enemy = {
  id: string;
  name: string;
  raceTags: string[];
  level: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  sp: number;
  exp: number;
  gold: number;
};

export type EnemyPattern = {
  id: string;
  floors: number[];
  enemies: string[]; // 敵IDの配列
  isBoss?: boolean;
};