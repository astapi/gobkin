import type { Goblin } from '../../types'
import { applyGoblinJob, canTrainGoblin, getGoblinTrainingJobDefinitions } from '../goblinJobs'

function createGoblin(overrides: Partial<Goblin> = {}): Goblin {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'マルク',
    race: overrides.race ?? 'ゴブリン',
    job: overrides.job,
    level: overrides.level ?? 1,
    experience: overrides.experience ?? 0,
    avatar: overrides.avatar ?? '/src/assets/goblin/goblin.png',
    baseAttributes: overrides.baseAttributes,
    stats: overrides.stats ?? {
      hp: 50,
      atk: 12,
      magicAtk: 0,
      def: 8,
      magicDef: 0,
      attackCount: 2,
      accuracy: 100,
      evasion: 5,
      magicHeal: 10,
      criticalRate: 0,
    },
    effectiveStats: overrides.effectiveStats,
    factors: overrides.factors,
    variantFactorId: overrides.variantFactorId,
    individualValue: overrides.individualValue,
    mods: overrides.mods,
    skills: overrides.skills ?? [],
    spells: overrides.spells,
  }
}

describe('goblinJobs', () => {
  it('純ゴブリンのみ訓練対象になる', () => {
    expect(canTrainGoblin(createGoblin({ race: 'ゴブリン' }))).toBe(true)
    expect(canTrainGoblin(createGoblin({ race: 'スライムゴブリン' }))).toBe(false)
    expect(canTrainGoblin(createGoblin({ race: 'ウルフゴブリン' }))).toBe(false)
  })

  it('始祖ゴブリンは訓練対象にならない', () => {
    expect(canTrainGoblin(createGoblin({ id: 0, race: '始祖ゴブリン', raceId: 'founder' }))).toBe(false)
  })

  it('ジョブ変更時に種族スキルとジョブスキルを再構成し、その他のスキルは保持する', () => {
    const goblin = createGoblin({
      job: 'guard',
      skills: [
        { id: 'talent_def_150', baseStatMultipliers: { def: 1.5 } },
        { id: 'armor_mastery_150', equipmentCategoryMultiplier: { armor: 1.5 } },
        { id: 'physical_reduction_5', physicalDamageReductionPercent: 12 },
        { id: 'equipment_bonus', statBonuses: { atk: 3 } },
      ],
    })

    const trained = applyGoblinJob(goblin, 'mage')

    expect(trained.job).toBe('mage')
    expect(trained.skills.some((skill) => skill.id === 'mage_magic_lv7')).toBe(true)
    expect(trained.skills.some((skill) => skill.mageMagicLevel === 7)).toBe(true)
    expect(trained.skills.some((skill) => skill.id === 'talent_def_150')).toBe(false)
    expect(trained.skills.some((skill) => skill.id === 'armor_mastery_150')).toBe(false)
    expect(trained.skills.some((skill) => skill.id === 'equipment_bonus')).toBe(true)
  })

  it('レベル15未満ではレベル習得スキルを持たない', () => {
    const trained = applyGoblinJob(createGoblin({ level: 14 }), 'guard')
    expect(trained.skills.some((skill) => skill.id === 'cover_low_hp_ally')).toBe(false)
    expect(trained.skills.some((skill) => skill.id === 'rear_guard')).toBe(false)
    expect(trained.skills.some((skill) => skill.id === 'mana_recovery')).toBe(false)
  })

  it('メイジはLv7魔法使い魔法スキルを持つ', () => {
    const trained = applyGoblinJob(createGoblin({ level: 1 }), 'mage')
    expect(trained.skills.some((skill) => skill.id === 'mage_magic_lv7')).toBe(true)
    expect(trained.skills.some((skill) => skill.mageMagicLevel === 7)).toBe(true)
  })

  it('ゴブリンガードはレベル15で後列防護を習得する', () => {
    const trained = applyGoblinJob(createGoblin({ level: 15 }), 'guard')
    expect(trained.skills.some((skill) => skill.id === 'rear_guard')).toBe(true)
    expect(trained.skills.some((skill) => skill.id === 'mana_recovery')).toBe(true)
  })

  it('街道クリア後にクレリック訓練が解放される', () => {
    expect(getGoblinTrainingJobDefinitions(new Set()).some((job) => job.id === 'cleric')).toBe(false)
    expect(getGoblinTrainingJobDefinitions(new Set(['road_1'])).some((job) => job.id === 'cleric')).toBe(true)
  })

  it('ウルフ草原後のストーリー読了でライダー訓練が解放される', () => {
    expect(getGoblinTrainingJobDefinitions(new Set(['human_village'])).some((job) => job.id === 'rider')).toBe(false)
    expect(
      getGoblinTrainingJobDefinitions(new Set(['human_village']), new Set(['story_after_wolf_grassland']))
        .some((job) => job.id === 'rider')
    ).toBe(true)
  })

  it('クレリックは回復魔法Lv7スキルを持つ', () => {
    const level1 = applyGoblinJob(createGoblin({ level: 1 }), 'cleric')

    expect(level1.skills.some((skill) => skill.id === 'recovery_magic_lv7')).toBe(true)
    expect(level1.skills.some((skill) => skill.recoveryMagicLevel === 7)).toBe(true)
  })

  it('ジョブ変更時にHPが基本能力値ベースで再計算される', () => {
    const goblin = createGoblin({
      level: 3,
      stats: {
        hp: 1,
        atk: 12,
        magicAtk: 0,
        def: 8,
        magicDef: 0,
        attackCount: 2,
        accuracy: 100,
        evasion: 5,
        magicHeal: 10,
        criticalRate: 0,
      },
    })

    expect(applyGoblinJob(goblin, 'guard').stats.hp).toBe(48)
    expect(applyGoblinJob(goblin, 'warrior').stats.hp).toBe(51)
    expect(applyGoblinJob(goblin, 'thief').stats.hp).toBe(35)
    expect(applyGoblinJob(goblin, 'mage').stats.hp).toBe(32)
    expect(applyGoblinJob(goblin, 'cleric').stats.hp).toBe(38)
  })

  it('ライダーは指定した基礎能力値を使う', () => {
    const trained = applyGoblinJob(createGoblin({ level: 1 }), 'rider')

    expect(trained.baseAttributes).toEqual({
      power: 12,
      wisdom: 8,
      spirit: 10,
      vitality: 10,
      agility: 15,
      luck: 12,
    })
  })
})
