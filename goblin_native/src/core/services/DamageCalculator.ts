// ==== 型定義 ====
export type Skill = SourceWithRaceBonus & {
  id: string;
  name: string;
  power: number;
};

export type RaceKey = string;

export type RaceDefinition = {
  label: string;
  implies?: RaceKey[];
  physicalResistancePercent?: number;
  penetrationResistancePercent?: number;
  criticalResistancePercent?: number;
  magicResistancePercent?: number;
};

export type RaceDict = Record<RaceKey, RaceDefinition>;

export type RaceBuckets = {
  add?: Partial<Record<RaceKey, number>>;
  mult?: Partial<Record<RaceKey, number>>;
};

export type SourceWithRaceBonus = {
  raceBonus?: RaceBuckets;
  raceTakenBonus?: RaceBuckets;
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
  magicAtk?: number;
  def: number;
  magicDef?: number;
  attackCount: number;
  accuracy: number;
  evasion: number;
  raceTags: RaceKey[];
  items?: Item[];
  buffs?: Buff[];
};

export type DamageOptions = {
  defConstant?: number;
  crit?: { rate: number; mult: number };
  randomMin?: number;
  randomMax?: number;
  isMagic?: boolean;  // true の場合、attacker.magicAtk を攻撃力として使用する
};

function expandRaceTags(races: RaceDict, baseTags: RaceKey[]): Set<RaceKey> {
  const out = new Set<RaceKey>();
  const visit = (key: RaceKey) => {
    if (out.has(key)) return;
    out.add(key);
    for (const implied of races[key]?.implies ?? []) visit(implied);
  };
  baseTags.forEach(visit);
  return out;
}

function collectRaceFactor(
  buckets: RaceBuckets | undefined,
  effectiveTargetTags: Set<RaceKey>
): { addSum: number; multProd: number } {
  if (!buckets) return { addSum: 0, multProd: 1 };
  let addSum = 0;
  let multProd = 1;

  for (const [tag, value] of Object.entries(buckets.add ?? {})) {
    if (value && effectiveTargetTags.has(tag)) addSum += value;
  }

  for (const [tag, value] of Object.entries(buckets.mult ?? {})) {
    if (value && effectiveTargetTags.has(tag)) multProd *= 1 + value;
  }

  return { addSum, multProd };
}

function aggregateRaceBonusForAttacker(
  sources: SourceWithRaceBonus[],
  effectiveTargetTags: Set<RaceKey>
): { addSum: number; multProd: number } {
  return sources.reduce(
    (acc, source) => {
      const factor = collectRaceFactor(source.raceBonus, effectiveTargetTags);
      return { addSum: acc.addSum + factor.addSum, multProd: acc.multProd * factor.multProd };
    },
    { addSum: 0, multProd: 1 }
  );
}

function aggregateRaceTakenBonusForDefender(
  sources: SourceWithRaceBonus[],
  attackerRaceTags: Set<RaceKey>
): { addSum: number; multProd: number } {
  return sources.reduce(
    (acc, source) => {
      const factor = collectRaceFactor(source.raceTakenBonus, attackerRaceTags);
      return { addSum: acc.addSum + factor.addSum, multProd: acc.multProd * factor.multProd };
    },
    { addSum: 0, multProd: 1 }
  );
}

export class DamageCalculator {
  private readonly defaultRandom: () => number

  constructor(defaultRandom: () => number = Math.random) {
    this.defaultRandom = defaultRandom
  }

  public calcDamage(
    races: RaceDict,
    attacker: Combatant,
    defender: Combatant,
    skill: Skill,
    opt: DamageOptions = {},
    rng: () => number = this.defaultRandom
  ): number {
    const randomFn = rng ?? this.defaultRandom;
    const min = opt.randomMin ?? 0.95;
    const max = opt.randomMax ?? 1.05;
    const rand = this.roll(randomFn, min, max);

    const critRate = opt.crit?.rate ?? 0;
    const critMult = opt.crit?.mult ?? 1.5;
    const isCrit = randomFn() < critRate;

    const attackPower = opt.isMagic ? (attacker.magicAtk ?? attacker.atk) : attacker.atk;
    const base = attackPower * skill.power;
    const defPower = opt.isMagic ? (defender.magicDef ?? defender.def) : defender.def;
    const defMitigate = 1 - defPower / (defPower + (opt.defConstant ?? 100));

    const targetTags = expandRaceTags(races, defender.raceTags);
    const attackerTags = expandRaceTags(races, attacker.raceTags);

    const atkSources: SourceWithRaceBonus[] = [
      ...(attacker.items ?? []),
      ...(attacker.buffs ?? []),
      skill,
    ];
    const atkRace = opt.isMagic
      ? { addSum: 0, multProd: 1 }
      : aggregateRaceBonusForAttacker(atkSources, targetTags);

    const defSources: SourceWithRaceBonus[] = [
      ...(defender.items ?? []),
      ...(defender.buffs ?? []),
    ];
    const defRace = aggregateRaceTakenBonusForDefender(defSources, attackerTags);

    const critFactor = isCrit ? critMult : 1;
    const raceFactor = (1 + atkRace.addSum) * atkRace.multProd;
    const takenFactor = (1 + defRace.addSum) * defRace.multProd;

    const dmgFloat = base * defMitigate * raceFactor * takenFactor * critFactor * rand;
    return Math.max(1, Math.floor(dmgFloat));
  }

  private roll(randomFn: () => number, min: number, max: number): number {
    return min + randomFn() * (max - min);
  }
}
