import type { Goblin } from '../../types'
import { applyGoblinJob, canTrainGoblin } from '../goblinJobs'

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
      spd: 10,
      def: 8,
      attackCount: 2,
      accuracy: 100,
      evasion: 5,
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
        { id: 'goblin_job_guard_armor', name: '[1.5倍]鎧装備', equipmentCategoryMultiplier: { armor: 1.5 } },
        { id: 'goblin_job_guard_wall', name: '盾壁', physicalDamageReductionPercent: 12 },
        { id: 'equipment_bonus', name: '装備スキル', statBonuses: { atk: 3 } },
      ],
    })

    const trained = applyGoblinJob(goblin, 'mage')

    expect(trained.job).toBe('mage')
    expect(trained.skills.some((skill) => skill.id === 'goblin_job_mage_fireball')).toBe(true)
    expect(trained.skills.some((skill) => skill.id === 'goblin_job_mage_magic_arrow')).toBe(true)
    expect(trained.skills.some((skill) => skill.id === 'goblin_job_guard_armor')).toBe(false)
    expect(trained.skills.some((skill) => skill.id === 'equipment_bonus')).toBe(true)
  })

  it('レベル15未満ではレベル習得スキルを持たない', () => {
    const trained = applyGoblinJob(createGoblin({ level: 14 }), 'guard')
    expect(trained.skills.some((skill) => skill.id === 'goblin_job_guard_cover')).toBe(false)
  })

  it('レベル15以上ではレベル習得スキルを持つ', () => {
    const trained = applyGoblinJob(createGoblin({ level: 15 }), 'mage')
    expect(trained.skills.some((skill) => skill.id === 'goblin_job_mage_blizzard')).toBe(true)
  })

  it('ジョブ変更時にHPが基本能力値ベースで再計算される', () => {
    const goblin = createGoblin({
      level: 3,
      stats: {
        hp: 1,
        atk: 12,
        spd: 10,
        def: 8,
        attackCount: 2,
        accuracy: 100,
        evasion: 5,
      },
    })

    expect(applyGoblinJob(goblin, 'guard').stats.hp).toBe(44)
    expect(applyGoblinJob(goblin, 'warrior').stats.hp).toBe(47)
    expect(applyGoblinJob(goblin, 'thief').stats.hp).toBe(35)
    expect(applyGoblinJob(goblin, 'mage').stats.hp).toBe(32)
  })
})
