import type { Goblin } from '../../types'
import { applyGoblinJob, canTrainGoblin, getGoblinTrainingJobDefinitions } from '../goblinJobs'

function createGoblin(overrides: Partial<Goblin> = {}): Goblin {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'グラッシュ',
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

  it('ジョブ変更時に種族スキルとジョブスキルを再構成し、その他のスキルは保持する', () => {
    const goblin = createGoblin({
      job: 'guard',
      skills: [
        { id: 'armor_mastery_150', equipmentCategoryMultiplier: { armor: 1.5 } },
        { id: 'physical_reduction_5', physicalDamageReductionPercent: 12 },
        { id: 'equipment_bonus', statBonuses: { atk: 3 } },
      ],
    })

    const trained = applyGoblinJob(goblin, 'mage')

    expect(trained.job).toBe('mage')
    expect(trained.skills.some((skill) => skill.id === 'grant_fireball')).toBe(true)
    expect(trained.skills.some((skill) => skill.id === 'grant_magic_arrow')).toBe(true)
    expect(trained.skills.some((skill) => skill.id === 'armor_mastery_150')).toBe(false)
    expect(trained.skills.some((skill) => skill.id === 'equipment_bonus')).toBe(true)
  })

  it('レベル15未満ではレベル習得スキルを持たない', () => {
    const trained = applyGoblinJob(createGoblin({ level: 14 }), 'guard')
    expect(trained.skills.some((skill) => skill.id === 'cover_low_hp_ally')).toBe(false)
    expect(trained.skills.some((skill) => skill.id === 'rear_guard')).toBe(false)
  })

  it('レベル15以上ではレベル習得スキルを持つ', () => {
    const trained = applyGoblinJob(createGoblin({ level: 15 }), 'mage')
    expect(trained.skills.some((skill) => skill.id === 'grant_blizzard')).toBe(true)
  })

  it('ゴブリンガードはレベル15で後列防護を習得する', () => {
    const trained = applyGoblinJob(createGoblin({ level: 15 }), 'guard')
    expect(trained.skills.some((skill) => skill.id === 'rear_guard')).toBe(true)
  })

  it('街道クリア後にクレリック訓練が解放される', () => {
    expect(getGoblinTrainingJobDefinitions(new Set()).some((job) => job.id === 'cleric')).toBe(false)
    expect(getGoblinTrainingJobDefinitions(new Set(['road_1'])).some((job) => job.id === 'cleric')).toBe(true)
  })

  it('クレリックはレベルに応じて回復・防護呪文を習得する', () => {
    const level1 = applyGoblinJob(createGoblin({ level: 1 }), 'cleric')
    const level4 = applyGoblinJob(createGoblin({ level: 4 }), 'cleric')
    const level19 = applyGoblinJob(createGoblin({ level: 19 }), 'cleric')

    expect(level1.skills.some((skill) => skill.id === 'grant_heal')).toBe(true)
    expect(level1.skills.some((skill) => skill.id === 'grant_shield_barrier')).toBe(false)
    expect(level4.skills.some((skill) => skill.id === 'grant_shield_barrier')).toBe(true)
    expect(level19.skills.some((skill) => skill.id === 'grant_party_heal')).toBe(true)
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

    expect(applyGoblinJob(goblin, 'guard').stats.hp).toBe(44)
    expect(applyGoblinJob(goblin, 'warrior').stats.hp).toBe(47)
    expect(applyGoblinJob(goblin, 'thief').stats.hp).toBe(35)
    expect(applyGoblinJob(goblin, 'mage').stats.hp).toBe(32)
    expect(applyGoblinJob(goblin, 'cleric').stats.hp).toBe(38)
  })
})
