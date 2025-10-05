// ==== 型定義 ====
export type RaceKey = string;

export type RaceDict = Record<RaceKey, { label: string; implies?: RaceKey[] }>;

export type RaceBuckets = {
  add: Partial<Record<RaceKey, number>>; // +20% → 0.20（同種は加算）
  mult: Partial<Record<RaceKey, number>>; // ×1.10 → 0.10（同種は乗算）
};

export type SourceWithRaceBonus = {
  raceBonus?: RaceBuckets; // 与ダメ用
  raceTakenBonus?: RaceBuckets; // 被ダメ用（相手の種族に対して受けるダメージ補正）
};

export type Skill = SourceWithRaceBonus & {
  id: string;
  name: string;
  power: number; // スキル倍率
};

export type Item = SourceWithRaceBonus & {
  id: string;
  name: string;
};

export type Buff = SourceWithRaceBonus & {
  id: string;
  name: string;
};

export type Combatant = {
  id: string;
  name: string;
  atk: number;
  def: number;
  raceTags: RaceKey[];
  items?: Item[];
  buffs?: Buff[];
};

export type DamageOptions = {
  defConstant?: number; // 防御逓減の定数：既定 100
  crit?: { rate: number; mult: number }; // rate: 0〜1, mult: 1.5 など
  randomMin?: number; // 乱数下限：既定 0.95
  randomMax?: number; // 乱数上限：既定 1.05
};

// ==== ユーティリティ ====

// タグ継承（implies）を展開して、対象の「全有効タグ」を得る
function expandRaceTags(races: RaceDict, baseTags: RaceKey[]): Set<RaceKey> {
  const out = new Set<RaceKey>();
  const visit = (k: RaceKey) => {
    if (out.has(k)) return;
    out.add(k);
    for (const p of races[k]?.implies ?? []) visit(p);
  };
  baseTags.forEach(visit);
  return out;
}

// raceBuckets を「対象の有効タグ」に対して合成（加算/乗算バケット）
function collectRaceFactor(
  buckets: RaceBuckets | undefined,
  effectiveTargetTags: Set<RaceKey>
): { addSum: number; multProd: number } {
  if (!buckets) return { addSum: 0, multProd: 1 };
  let addSum = 0;
  let multProd = 1;

  // 加算は一致タグぶん合計
  for (const [tag, v] of Object.entries(buckets.add ?? {})) {
    if (v && effectiveTargetTags.has(tag)) addSum += v;
  }
  // 乗算は一致タグぶん (1+v) を連鎖
  for (const [tag, v] of Object.entries(buckets.mult ?? {})) {
    if (v && effectiveTargetTags.has(tag)) multProd *= 1 + v;
  }

  return { addSum, multProd };
}

// 攻撃側の複数ソース（武器/アクセ/スキル/バフ）から合成
function aggregateRaceBonusForAttacker(
  sources: SourceWithRaceBonus[],
  effectiveTargetTags: Set<RaceKey>
): { addSum: number; multProd: number } {
  return sources.reduce(
    (acc, s) => {
      const f = collectRaceFactor(s.raceBonus, effectiveTargetTags);
      return { addSum: acc.addSum + f.addSum, multProd: acc.multProd * f.multProd };
    },
    { addSum: 0, multProd: 1 }
  );
}

// 防御側の被ダメ補正（raceTakenBonus）合成
function aggregateRaceTakenBonusForDefender(
  sources: SourceWithRaceBonus[],
  attackerRaceTags: Set<RaceKey>
): { addSum: number; multProd: number } {
  return sources.reduce(
    (acc, s) => {
      const f = collectRaceFactor(s.raceTakenBonus, attackerRaceTags);
      return { addSum: acc.addSum + f.addSum, multProd: acc.multProd * f.multProd };
    },
    { addSum: 0, multProd: 1 }
  );
}

// ==== ダメージ計算本体 ====

export function calcDamage(
  races: RaceDict,
  attacker: Combatant,
  defender: Combatant,
  skill: Skill,
  opt: DamageOptions = {}
): number {
  const K = opt.defConstant ?? 100;
  const rand =
    (opt.randomMin ?? 0.95) +
    Math.random() * ((opt.randomMax ?? 1.05) - (opt.randomMin ?? 0.95));

  const critRate = opt.crit?.rate ?? 0;
  const critMult = opt.crit?.mult ?? 1.5;
  const isCrit = Math.random() < critRate;

  // 1) 基本威力
  const base = attacker.atk * skill.power;

  // 2) 防御による割合軽減（逓減）
  const defMitigate = 1 - defender.def / (defender.def + K); // 例: def=100,K=100→50%通る

  // 3) 種族タグ展開
  const targetTags = expandRaceTags(races, defender.raceTags);
  const attackerTags = expandRaceTags(races, attacker.raceTags);

  // 4) 攻撃側の raceBonus（アイテム/バフ/スキル）を合算
  const atkSources: SourceWithRaceBonus[] = [
    ...(attacker.items ?? []),
    ...(attacker.buffs ?? []),
    skill,
  ];
  const atkRace = aggregateRaceBonusForAttacker(atkSources, targetTags);

  // 5) 防御側の被ダメ補正（相手の種族＝攻撃側タグを見る）
  const defSources: SourceWithRaceBonus[] = [
    ...(defender.items ?? []),
    ...(defender.buffs ?? []),
  ];
  const defRace = aggregateRaceTakenBonusForDefender(defSources, attackerTags);

  // 6) クリティカル
  const critFactor = isCrit ? critMult : 1;

  // 7) まとめて適用
  //  - raceは「(1 + addSum) × multProd」で１つの係数に
  //  - 防御側の被ダメ補正も同様にまとめ、最後に掛ける
  const raceFactor = (1 + atkRace.addSum) * atkRace.multProd;
  const takenFactor = (1 + defRace.addSum) * defRace.multProd;

  const dmgFloat = base * defMitigate * raceFactor * takenFactor * critFactor * rand;

  // 8) 最低保証
  return Math.max(1, Math.floor(dmgFloat));
}
