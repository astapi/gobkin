/**
 * バランスシミュレータの戦略ペルソナ(strategist)が探索したビルドを、
 * studio 側で同じパーティとして再現するためのモジュール。
 *
 * ビルド定義は `goblin_native/scripts/balance/out/strategist-builds.json`
 * （`scripts/balance/exportStrategistBuilds.js` が生成）から読み込む。
 *
 * ゴブリンの組み立て手順は
 * `goblin_native/scripts/balance/headless/strategistLayer.js` の
 * buildStrategistGoblin と同一にしてある。ここがズレるとシミュレータと
 * studio で別のパーティを測ることになるため、片方を触ったら必ず両方直すこと。
 * 手順は実ゲームの StartExpeditionUseCase.prepareDepartingGoblins に準拠:
 *   種族デフォルトスキル → applyGoblinJob → 装備付与スキル合流 → effectiveStats 再計算
 */
import { EquipmentService } from '@app/core/services/EquipmentService'
import { calculateSlotCount } from '@app/shared/data/equipmentConfig'
import { applyGoblinJob } from '@app/shared/data/goblinJobs'
import { pureGoblinSeed } from '@app/shared/data/pureGoblin'
import { getDefaultSkillsForRace } from '@app/shared/data/raceSkills'
import { getLegacyRaceName, normalizeGoblinRaceId } from '@app/shared/types/Race'
import { calculateGoblinEffectiveStats, syncGoblinDerivedStats } from '@app/shared/utils/goblinStats'
import type { EquipmentInstance, Goblin, GoblinJob } from '@app/shared/types'

/** strategist-builds.json の 1 メンバー */
export interface StrategistBuildMember {
  kind: 'job' | 'variant'
  jobId: string | null
  raceId: string | null
  variant: string | null
  /** 山登りで最適化した装備スロット分のみ。残りは equipmentTail で埋める */
  loadout: string[]
}

/** strategist-builds.json の 1 ビルド（エリア×Tier） */
export interface StrategistBuild {
  areaId: string
  tier: number
  /** このビルドを探索したレベル。measureArea 準拠なら 3 */
  searchLevel: number
  score: number
  /** 何体目までを前列とみなすか（members 配列の先頭から） */
  frontCount: number
  optimizedSlots: number
  /** 最適化スロットより装備枠が多いレベルでの充填候補（装備パワースコア降順） */
  equipmentTail: string[]
  members: StrategistBuildMember[]
  availableJobs: string[]
  availableVariants: string[]
}

export interface StrategistBuildFile {
  generatedAt: string
  partySize: number
  note?: string
  builds: StrategistBuild[]
}

const NAMES = ['グラッシュ', 'ゴブA', 'ゴブB', 'ゴブC', 'ゴブD', 'ゴブE', 'ゴブF', 'ゴブG']

/**
 * 指定レベルでのメンバーの実装備を解決する。
 * personas.js buildStrategistCompAtLevel と同じ規則:
 *   [最適化スロット分] + [equipmentTail を残り枠ぶん] を装備枠数まで
 */
export function resolveLoadout(
  build: StrategistBuild,
  member: StrategistBuildMember,
  level: number,
): string[] {
  const slotCount = calculateSlotCount(level)
  const optimized = member.loadout.slice(0, build.optimizedSlots)
  const tail = build.equipmentTail.slice(0, Math.max(0, slotCount - build.optimizedSlots))
  return [...optimized, ...tail].slice(0, slotCount)
}

function buildStrategistGoblin(
  id: number,
  level: number,
  member: StrategistBuildMember,
  loadout: string[],
): Goblin {
  const normalizedRaceId = normalizeGoblinRaceId(member.raceId ?? 'goblin')
  const instances: EquipmentInstance[] = loadout.map((templateId, i) => ({
    id: `studio-strat-eq-${id}-${i}`,
    templateId,
    slotIndex: i,
    goblinId: id,
  }))

  // 1. 素のゴブリン（種族デフォルトスキル・因子）を作り derived stats を確定
  const baseSkills = getDefaultSkillsForRace(normalizedRaceId)
  const seed: Goblin = {
    id,
    name: NAMES[(id - 1) % NAMES.length],
    race: getLegacyRaceName(normalizedRaceId),
    raceId: normalizedRaceId,
    level,
    experience: 0,
    avatar: '/src/assets/goblin/goblin.png',
    baseAttributes: { ...pureGoblinSeed.baseAttributes },
    individualValue: 1,
    // 亜種は因子として渡す（シミュレータ側と同じ）。variantFactorId は
    // 戦闘計算に影響しない表示用フィールドのため、意図的に設定しない。
    factors: member.variant ? [member.variant] : [],
    skills: baseSkills,
    stats: {
      hp: 0, atk: 0, magicAtk: 0, def: 0, magicDef: 0,
      attackCount: 0, accuracy: 0, evasion: 0, magicHeal: 0, criticalRate: 0,
    },
  }
  const withStats = syncGoblinDerivedStats(seed)

  // 2. ジョブ付与（ジョブ baseAttributes・ジョブスキルをレベル解放考慮で合流）
  const jobbed = member.jobId ? applyGoblinJob(withStats, member.jobId as GoblinJob) : withStats

  // 3. 装備付与スキルを末尾に合流し、装備込みで effectiveStats を確定
  const equipmentSkills = EquipmentService.collectGrantedSkills(instances)
  const mergedSkills = [...jobbed.skills, ...equipmentSkills]
  const effectiveStats = calculateGoblinEffectiveStats(
    { ...jobbed, skills: mergedSkills },
    instances,
  )
  return { ...jobbed, skills: mergedSkills, effectiveStats, currentHp: undefined }
}

/**
 * 保存された戦略ビルドを、指定レベルのパーティ（Goblin[]）として組み立てる。
 * 配列順がそのまま隊列（先頭ほど前列＝狙われやすい）。
 */
export function buildPartyFromStrategistBuild(build: StrategistBuild, level: number): Goblin[] {
  return build.members.map((member, index) =>
    buildStrategistGoblin(index + 1, level, member, resolveLoadout(build, member, level)),
  )
}

/** UI 表示用のラベル（ジョブ名 or 亜種名） */
export function memberLabel(member: StrategistBuildMember): string {
  if (member.kind === 'variant') return member.variant ?? '亜種'
  return member.jobId ?? 'ジョブなし'
}

export function isStrategistBuildFile(value: unknown): value is StrategistBuildFile {
  if (!value || typeof value !== 'object') return false
  return Array.isArray((value as { builds?: unknown }).builds)
}
