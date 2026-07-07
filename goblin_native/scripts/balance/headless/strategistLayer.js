'use strict'

/**
 * バランスシミュレータ「戦略層」モジュール。
 *
 * floor / median / ceiling ペルソナ（personas.js）は「純ゴブリン＋装備＋因子」までしか
 * 表現しない。本モジュールはその上に **ジョブ編成・実隊列・装備スキルシナジー** を載せる:
 *
 *   - getAvailableJobs(areaId)           : そのエリア到達時点で訓練解放済みのジョブID
 *   - JOB_ROLE                           : 各ジョブの推奨配置（front/back）と役割タグ
 *   - buildStrategistParty({level,size,comp}) : ジョブ・隊列・装備を指定してパーティ生成
 *   - equipmentSynergyScore(loadout)     : 装備付与スキルの組合せ価値（探索ヒューリスティック）
 *
 * 統合エージェント（探索ヒューリスティック側）がこれらを組み合わせて、
 * 「どのジョブを・どの隊列で・どの装備で組むか」を最適化することを想定している。
 *
 * 設計方針:
 *   - ステータス確定手順は personas.buildGoblin（＝ StartExpeditionUseCase.prepareDepartingGoblins）
 *     と厳密に整合させる。すなわち:
 *       種族デフォルトスキル → ジョブスキル（applyGoblinJob 相当・レベル解放考慮）
 *       → 装備付与スキル の順に skills をマージし、装備込みで effectiveStats を再計算する。
 *     これは実ゲームの「訓練でジョブ付与（applyGoblinJob）→ 遠征開始で装備スキル合流
 *     → effectiveStats 再計算」という時系列と同じ。
 *   - members 配列の順序＝実隊列。味方は unitFactory.createAllyUnit で `row = originalIndex`
 *     （＝配列 index）が列番号になるため、先頭ほど前列＝狙われやすい（targeting.getRowWeight）。
 *     かばう(cover_low_hp_ally) / 後衛庇護(rear_guard/magic_rear_guard) / 鼓舞(inspire) は
 *     「自分より後ろの列(row が大きい)の味方」に効くため、タンク・鼓舞役を前に、
 *     ヒーラー・術者を後ろに置くと戦闘上有利になる。
 *   - 決定論厳守（RNG 不使用）。同一入力 → 同一パーティ。
 *   - 種族/亜種の抽選は breedingPool.js（並行作成中）が担当する。本モジュールは
 *     raceId / variant を「外部から渡せる口」だけ用意し、既定は純ゴブリン。
 */

// runtime を先に読み込む（TS ローダ・@/ エイリアス・__DEV__ を有効化）
require('./runtime')

const { syncGoblinDerivedStats, calculateGoblinEffectiveStats } = require('@/shared/utils/goblinStats')
const { getDefaultSkillsForRace } = require('@/shared/data/raceSkills')
const { pureGoblinSeed } = require('@/shared/data/pureGoblin')
const { getLegacyRaceName, normalizeGoblinRaceId } = require('@/shared/types/Race')
const { EquipmentService } = require('@/core/services/EquipmentService')
const { getEquipmentTemplate } = require('@/shared/data/equipmentPoolLoader')
const {
  applyGoblinJob,
  getGoblinJobDefinitions,
} = require('@/shared/data/goblinJobs')

const { computeAncestors } = require('./obtainablePool')

// allArea は areaLevel 参照のため直接読む（自己テストの進行表示用）
const allAreaData = require('@/shared/data/expeditionArea/allArea.json')
const AREA_BY_ID = new Map((allAreaData.areas || []).map(a => [a.id, a]))

// ストーリー解放要件（job.unlockRequiresReadStory）→ そのストーリーのトリガーとなる
// 「クリア済みダンジョン」の対応表。stories.json の unlockCondition.type==='dungeon_cleared'
// から決定論的に導出する（rider の story_after_wolf_grassland → wolf_grassland_1 など）。
const storiesData = require('@/shared/data/story/stories.json')
const STORY_CLEAR_DUNGEON = new Map()
for (const s of storiesData.stories || []) {
  const c = s && s.unlockCondition
  if (c && c.type === 'dungeon_cleared' && c.dungeonId) {
    STORY_CLEAR_DUNGEON.set(s.id, c.dungeonId)
  }
}

// 訓練所（＝基本ジョブ guard/thief/mage/warrior）の解放条件。
// 実ゲームでは拠点ランク2で訓練が解放され、ランク2は goblin_village_1 クリアで到達する
// （BaseRankSystem.BASE_RANK_CONFIGS rank2.unlockCondition.dungeonId='goblin_village_1'）。
// cleric/rider/necromancer も当然この訓練所解放（＝ランク2）が前提。
const TRAINING_UNLOCK_DUNGEON = 'goblin_village_1'

// 課金購入が前提のダンジョン（本編進行の祖先グラフには現れない課金ルート）。
// これらのクリアを要件とするジョブ（necromancer は necromancer_crypt_1、課金 entitlement
// necromancer_side_story が前提）は、既定では本編プレイヤーは解放できないため除外する。
// getAvailableJobs(areaId,{includePaid:true}) で「課金済みプレイヤー」を別途測れる。
const PAID_UNLOCK_DUNGEONS = new Set(['necromancer_crypt_1', 'cat_fortress_1'])

const NAMES = ['グラッシュ', 'ゴブA', 'ゴブB', 'ゴブC', 'ゴブD', 'ゴブE', 'ゴブF', 'ゴブG']

// ---------------------------------------------------------------------------
// 1. getAvailableJobs(areaId)
// ---------------------------------------------------------------------------
//
// 「そのエリアに挑む時点」で実際に解放済みのジョブID配列を返す。
// 可用性は「そのエリアに到達するまでにクリア済みのダンジョン集合」＝祖先集合
// ancestors(areaId)（computeAncestors: unlockNext/unlockNexts/unlockRequires の逆辺グラフ）で
// 厳密に決まる。ゴールドコストは理想化して無視するが、解放ダンジョンは実データに厳密に従う:
//
//   (A) 訓練所解放（基本ジョブ guard/thief/mage/warrior の前提）
//       → 拠点ランク2到達 = goblin_village_1 クリア。
//         goblin_village_1 ∈ ancestors でないなら訓練不可＝ジョブ 0 個。
//   (B) job.unlockRequiresClearedArea（cleric = road_1）
//       → そのエリアが ancestors に含まれるか。
//   (C) job.unlockRequiresReadStory（rider = story_after_wolf_grassland,
//       necromancer = side_necromancer_cleared）
//       → ストーリー既読 = そのストーリーのトリガーダンジョン（STORY_CLEAR_DUNGEON）が
//         クリア済みか、で決まる。本編ダンジョンなら ancestors 判定。
//         課金ルート（PAID_UNLOCK_DUNGEONS, necromancer_crypt_1）は本編進行の祖先には
//         現れないので既定は不可。includePaid で「課金済みプレイヤー」を測るときだけ解放扱い。
//
// @param {string} areaId
// @param {{ includePaid?: boolean }} [opts] includePaid: 課金ダンジョン要件のジョブも解放扱いにする
// @returns {string[]} 解放済みジョブID（GoblinJob）の配列（辞書順）
function getAvailableJobs(areaId, opts = {}) {
  const { includePaid = false } = opts
  const ancestors = computeAncestors(areaId)

  // (A) 訓練所解放: 拠点ランク2到達 = goblin_village_1 クリア。未到達なら訓練不可＝ジョブ0個。
  if (!ancestors.has(TRAINING_UNLOCK_DUNGEON)) return []

  const jobs = []
  for (const job of getGoblinJobDefinitions()) {
    // (B) クリア済み先行エリア要件
    if (job.unlockRequiresClearedArea && !ancestors.has(job.unlockRequiresClearedArea)) continue
    // (C) ストーリー既読要件 → トリガーとなるクリア済みダンジョンで判定
    if (job.unlockRequiresReadStory) {
      const triggerDungeon = STORY_CLEAR_DUNGEON.get(job.unlockRequiresReadStory)
      if (!triggerDungeon) continue // 対応ダンジョンを導出できない＝保守的に不可
      if (PAID_UNLOCK_DUNGEONS.has(triggerDungeon)) {
        // 課金ダンジョン: 既定は不可。includePaid なら購入+クリア済みプレイヤーとして解放扱い。
        if (!includePaid) continue
      } else if (!ancestors.has(triggerDungeon)) {
        continue
      }
    }
    jobs.push(job.id)
  }
  return jobs.sort()
}

// ---------------------------------------------------------------------------
// 2. JOB_ROLE — 各ジョブの推奨配置と役割タグ
// ---------------------------------------------------------------------------
//
// position: 'front' | 'back'  … 隊列上の推奨列（front=前方＝狙われやすい / back=後方）
// role    : 役割タグ            … tank / dps / caster / healer / skirmisher
// rationale: 割当根拠（付与される戦闘スキルの実挙動に基づく）
//
// 根拠は goblinJobs.ts の各ジョブ skillId と、battle/positioning.ts・targeting.ts の実挙動:
//   - 前列(row 小)ほど狙われやすい（getRowWeight）。
//   - cover_low_hp_ally / rear_guard / magic_rear_guard / inspire は
//     「自分より後ろ(row が大)の味方」に効く → 守り・鼓舞役は前に置く。
//   - 術者・ヒーラーは自身が脆く後方支援が本分 → 後列に置く。
const JOB_ROLE = {
  // 守護: 高DEF・物理軽減・かばう(cover)・後衛庇護(rear_guard)。前で被弾を引き受け、
  //       後方の味方を守るのが役割 → front/tank。
  guard: {
    position: 'front',
    role: 'tank',
    rationale: 'talent_def_150/armor_mastery_150/physical_reduction_5 で高耐久。'
      + 'cover_low_hp_ally と rear_guard は自分より後方の味方を守るため最前列が最適。',
  },
  // 戦士: 攻撃回数talent・鼓舞(inspire)。前で殴りつつ後方を鼓舞 → front/dps。
  warrior: {
    position: 'front',
    role: 'dps',
    rationale: 'talent_attackCount_150 で手数型の物理DPS。inspire_150 は後方味方の与ダメを'
      + '上げるため、前列に置くと後衛DPS/術者を底上げできる。',
  },
  // 騎兵: クリティカル・攻撃回数+3・行動順・反撃回避。近接高火力アタッカー → front/dps。
  rider: {
    position: 'front',
    role: 'dps',
    rationale: 'critical_support/attack_count_up_3 の近接高火力。action_order_150 で先制、'
      + 'counter_avoidance で反撃を受けにくく前線でこそ真価を発揮する。',
  },
  // 盗賊: 高回避・行動順・ゴールド。素の耐久は無いが回避で被弾を捌けるため前寄り運用可 → front/skirmisher。
  thief: {
    position: 'front',
    role: 'skirmisher',
    rationale: 'evasion_150 の高回避で前列の被弾を受け流せる遊撃。action_order_150 で先制。'
      + '装甲は薄いので隊列は前後どちらでも成立するが、回避を活かすなら前寄り。',
  },
  // 魔術師: 呪文lv7・呪文火力・マナ回復。遠隔範囲火力の脆い術者 → back/caster。
  mage: {
    position: 'back',
    role: 'caster',
    rationale: 'mage_magic_lv7/spell_damage_20 の遠隔呪文アタッカー。耐久が無いため後列で保護する。',
  },
  // 死霊術師: 呪文lv7・ブリザード付与・不死特性・魔法支援。脆い上級術者 → back/caster。
  necromancer: {
    position: 'back',
    role: 'caster',
    rationale: 'mage_magic_lv7/grant_blizzard の範囲術者。undead_trait/magic_support の支援型で、'
      + 'ヒーラー同様に後列運用が基本。',
  },
  // 僧侶: 回復lv7・魔法後衛庇護・魔法フィールド・蘇生。パーティ生存の要 → back/healer。
  cleric: {
    position: 'back',
    role: 'healer',
    rationale: 'recovery_magic_lv7/instant_revive でパーティ生存を支えるヒーラー。'
      + '自身が脆く回復役を落とされると崩壊するため後列に置く。',
  },
}

// ---------------------------------------------------------------------------
// 3. buildStrategistParty({ level, size, comp })
// ---------------------------------------------------------------------------
//
// comp = {
//   members: [{ jobId?, loadout?: string[], raceId?, variant?, factors?: string[] }...],
//   frontCount?: number,
// }
//
//   - members 配列の順序＝実隊列（先頭ほど前列）。frontCount は「先頭 frontCount 体を前列と
//     みなす」というメタ情報（実際の row は配列 index で決まるので順序が本体）。
//   - size は出撃上限。members.length が size を超えたら先頭 size 体に切り詰める。
//   - 各メンバーは personas.buildGoblin と同じ手順 + applyGoblinJob 相当でジョブスキルを合流:
//       種族デフォルト → ジョブスキル(レベル解放考慮) → 装備付与スキル の順。
//   - raceId / variant / factors が渡されればそれを反映（未指定は純ゴブリン・因子なし）。
//   - 決定論（RNG 不使用）。
//
// @returns {Goblin[]} 隊列順（index=列）のゴブリン配列
function buildStrategistParty({ level, size, comp }) {
  const members = (comp && Array.isArray(comp.members)) ? comp.members : []
  const capped = members.slice(0, size)
  const party = []
  for (let i = 0; i < capped.length; i++) {
    party.push(buildStrategistGoblin(i + 1, level, capped[i] || {}))
  }
  return party
}

/**
 * ジョブ・装備・種族を反映したゴブリン 1 体を生成する。
 * 手順は StartExpeditionUseCase の時系列に忠実:
 *   1. 素の goblin（種族デフォルトスキル・因子）を作り derived stats を確定
 *   2. applyGoblinJob でジョブを付与（ジョブ baseAttributes・ジョブスキルをレベル解放考慮で合流）
 *   3. 装備付与スキルを末尾に合流し、装備込みで effectiveStats を再計算
 */
function buildStrategistGoblin(id, level, member) {
  const {
    jobId = null,
    loadout = [],
    factors = [],
    raceId = 'goblin',
    variant = null,
  } = member

  const normalizedRaceId = normalizeGoblinRaceId(raceId)
  const instances = loadout.map((templateId, i) => ({
    id: `sim-eq-${id}-${i}`,
    templateId,
    slotIndex: i,
    goblinId: id,
  }))

  // 1. 素のゴブリン（装備・ジョブ前）
  const baseSkills = getDefaultSkillsForRace(normalizedRaceId)
  const seed = {
    id,
    name: NAMES[(id - 1) % NAMES.length],
    race: getLegacyRaceName(normalizedRaceId),
    raceId: normalizedRaceId,
    variant: variant ?? undefined,
    level,
    experience: 0,
    avatar: '/src/assets/goblin/goblin.png',
    baseAttributes: { ...pureGoblinSeed.baseAttributes },
    individualValue: 1,
    factors: [...factors],
    skills: baseSkills,
    stats: {
      hp: 0, atk: 0, magicAtk: 0, def: 0, magicDef: 0,
      attackCount: 0, accuracy: 0, evasion: 0, magicHeal: 0, criticalRate: 0,
    },
  }
  const withStats = syncGoblinDerivedStats(seed)

  // 2. ジョブ付与（applyGoblinJob: 種族デフォルト＋ジョブスキル＋既存の非種族非ジョブスキル、
  //    ジョブ baseAttributes 適用、derived stats 再計算）。jobId 無しなら素のまま。
  const jobbed = jobId ? applyGoblinJob(withStats, jobId) : withStats

  // 3. 装備付与スキルを末尾に合流し、装備込みで effectiveStats を確定。
  //    （実ゲームの StartExpeditionUseCase.prepareDepartingGoblins と同一手順）
  const equipmentSkills = EquipmentService.collectGrantedSkills(instances)
  const mergedSkills = [...jobbed.skills, ...equipmentSkills]
  const effectiveStats = calculateGoblinEffectiveStats(
    { ...jobbed, skills: mergedSkills },
    instances,
  )
  return { ...jobbed, skills: mergedSkills, effectiveStats, currentHp: undefined }
}

// ---------------------------------------------------------------------------
// 4. equipmentSynergyScore(loadout)
// ---------------------------------------------------------------------------
//
// 装備が「付与するスキル」の組合せ的価値を近似する簡易スコア（0..∞）。
// 統合側の探索ヒューリスティック（枝刈り・候補ランキング）で使う近似指標であり、
// 厳密である必要はない（最終評価は実シミュレーションの progressScore が担う）。
//
// 評価基準（素朴・決定論）:
//   - 各装備の grantedSkills を「系統(family)」に分類する（防御/攻撃/呪文/回復/機動/庇護 等）。
//   - 系統ごとに base 重みを与え、系統内の 1 個目は満額、2 個目以降は逓減（0.4 倍）で加算。
//     多くの付与スキルはブール的トグルや上限のある効果で、同系統の重複は価値が薄いため。
//   - 異なる系統を複数揃える「相補性(breadth)」に小ボーナスを与える（役割の穴を減らす）。
//   - 攻撃系統 × 生存系統(防御 or 庇護)を両立している場合、少額の相乗ボーナス。
function equipmentSynergyScore(loadout) {
  if (!Array.isArray(loadout) || loadout.length === 0) return 0

  // 付与スキルID を収集
  const grantedIds = []
  for (const templateId of loadout) {
    const t = getEquipmentTemplate(templateId)
    if (!t || !Array.isArray(t.grantedSkills)) continue
    for (const skill of t.grantedSkills) {
      if (skill && skill.id) grantedIds.push(skill.id)
    }
  }
  if (grantedIds.length === 0) return 0

  // 系統ごとの base 重み
  const FAMILY_WEIGHT = {
    survival: 2.0, // hp / def / 軽減 / 回復
    guard: 2.5, // かばう・後衛庇護（隊列シナジーの核）
    offense: 2.0, // atk / 攻撃回数 / クリティカル
    caster: 1.8, // 呪文 / 魔法
    mobility: 1.2, // 行動順 / 回避 / 命中
    utility: 0.8, // その他
  }
  const DUP_DECAY = 0.4 // 同系統 2 個目以降の逓減係数

  function classify(skillId) {
    const s = String(skillId)
    if (/(cover|rear_guard|protect|taunt)/.test(s)) return 'guard'
    if (/(hp|def|reduction|regen|heal|recover|revive|barrier|shield)/.test(s)) return 'survival'
    if (/(atk|attack|critical|damage|inspire|power)/.test(s)) return 'offense'
    if (/(spell|magic|mana|fireball|blizzard|arrow|mage)/.test(s)) return 'caster'
    if (/(action_order|evasion|accuracy|agility|speed)/.test(s)) return 'mobility'
    return 'utility'
  }

  // 系統ごとの出現数
  const familyCounts = {}
  for (const id of grantedIds) {
    const fam = classify(id)
    familyCounts[fam] = (familyCounts[fam] || 0) + 1
  }

  let score = 0
  const families = Object.keys(familyCounts)
  for (const fam of families) {
    const base = FAMILY_WEIGHT[fam] ?? FAMILY_WEIGHT.utility
    const n = familyCounts[fam]
    // 1 個目満額 + 2 個目以降逓減（等比和）
    for (let k = 0; k < n; k++) {
      score += base * Math.pow(DUP_DECAY, k)
    }
  }

  // 相補性ボーナス（系統の種類数 × 0.5）
  score += (families.length - 1) * 0.5

  // 攻守両立ボーナス（攻撃系統かつ 生存 or 庇護 系統を持つ）
  const hasOffense = !!familyCounts.offense || !!familyCounts.caster
  const hasSurvival = !!familyCounts.survival || !!familyCounts.guard
  if (hasOffense && hasSurvival) score += 1.0

  return score
}

module.exports = {
  getAvailableJobs,
  JOB_ROLE,
  buildStrategistParty,
  buildStrategistGoblin,
  equipmentSynergyScore,
}

// ---------------------------------------------------------------------------
// 自己テスト: node scripts/balance/headless/strategistLayer.js
// ---------------------------------------------------------------------------
if (require.main === module) {
  runSelfTest().catch(err => {
    console.error(err && err.stack ? err.stack : err)
    process.exit(1)
  })
}

async function runSelfTest() {
  const { ExpeditionEngine } = require('@/core/services/ExpeditionEngine')
  const { getAreaConfig } = require('@/shared/data/expeditionArea')
  const { suppressEngineLogs } = require('./runtime')
  const { extractExpeditionMetrics, aggregateMetrics } = require('./metrics')

  const line = (s = '') => console.log(s)

  // --- (a) getAvailableJobs が進行に応じて増える ---------------------------
  line('===== (a) getAvailableJobs: 本編チェーン depth 別のジョブ解放 =====')
  // slime_cave 起点 BFS で本編チェーンの depth を求める（strategyPremium.js と同じ辺集合）。
  const byId = AREA_BY_ID
  const depth = { slime_cave: 0 }
  const q = ['slime_cave']
  while (q.length) {
    const x = q.shift()
    const a = byId.get(x) || {}
    const kids = []
    if (a.unlockNext) kids.push(a.unlockNext)
    if (a.unlockNexts) kids.push(...a.unlockNexts)
    for (const c of kids) if (byId.get(c) && !(c in depth)) { depth[c] = depth[x] + 1; q.push(c) }
  }
  const chain = Object.keys(depth)
    .sort((a, b) => depth[a] - depth[b] || (byId.get(a).areaLevel || 0) - (byId.get(b).areaLevel || 0))
  for (const areaId of chain) {
    const area = byId.get(areaId)
    const jobs = getAvailableJobs(areaId)
    const paid = getAvailableJobs(areaId, { includePaid: true })
    const paidExtra = paid.filter(j => !jobs.includes(j))
    line(`  d${String(depth[areaId]).padStart(2)} ${areaId.padEnd(22)} (Lv${String(area ? area.areaLevel : 0).padStart(3)}): `
      + `[${jobs.join(', ') || '(なし)'}]`
      + (paidExtra.length ? `  (+課金: ${paidExtra.join(', ')})` : ''))
  }
  // 探索が可用外ジョブを掴んでいないことの確認: 代表エリアで build のジョブ ⊆ getAvailableJobs
  line('')
  line('  --- 探索ビルドが可用外ジョブを使っていないことの確認 ---')
  const { searchStrategistBuild } = require('./personas')
  for (const areaId of ['forest_edge_village', 'orc_camp_1', 'spider_forest_1', 'lizardman_swamp_1']) {
    if (!byId.get(areaId)) continue
    const allowed = new Set(getAvailableJobs(areaId))
    let detail
    try {
      detail = await searchStrategistBuild({
        areaId, level: 20, size: 6, tier: 0,
        simulate: async (party, tier, seed) => {
          const replay = await runExpedition(areaId, tier, party, seed)
          return extractExpeditionMetrics(replay)
        },
        options: { strategist: { seeds: 3, starts: 2 } },
      })
    } catch (e) { line(`  ${areaId}: 探索スキップ (${e.message})`); continue }
    const usedJobs = [...new Set(detail.build.members.map(m => m.jobId).filter(Boolean))]
    const violation = usedJobs.filter(j => !allowed.has(j))
    line(`  ${areaId.padEnd(22)} allowed=[${[...allowed].join(', ') || '(なし)'}] used=[${usedJobs.join(', ') || '(なし)'}] `
      + `違反=${violation.length ? violation.join(',') : 'なし'}`)
  }

  // --- (b) buildStrategistParty が実際にジョブスキルを保持している -----------
  line('')
  line('===== (b) buildStrategistParty: ジョブスキル保持の確認 =====')
  const demoComp = {
    frontCount: 2,
    members: [
      { jobId: 'guard' },
      { jobId: 'warrior' },
      { jobId: 'mage' },
      { jobId: 'cleric' },
    ],
  }
  const demoParty = buildStrategistParty({ level: 20, size: 6, comp: demoComp })
  for (let i = 0; i < demoParty.length; i++) {
    const g = demoParty[i]
    line(`  [row=${i}] job=${g.job} skills=[${g.skills.map(s => s.id).join(', ')}]`)
  }

  // --- (c) 決定論（同一入力 → 同一結果） -----------------------------------
  line('')
  line('===== (c) 決定論の確認 =====')
  const p1 = buildStrategistParty({ level: 20, size: 6, comp: demoComp })
  const p2 = buildStrategistParty({ level: 20, size: 6, comp: demoComp })
  const sig = p => JSON.stringify(p.map(g => ({
    job: g.job, skills: g.skills.map(s => s.id), eff: g.effectiveStats,
  })))
  line(`  同一入力2回の一致: ${sig(p1) === sig(p2)}`)
  line(`  equipmentSynergyScore 決定論: `
    + `${equipmentSynergyScore(['sword_copper', 'sword_broad']) === equipmentSynergyScore(['sword_copper', 'sword_broad'])}`)

  // --- 妥当性チェック: 素の純ゴブリン vs ジョブ編成 -------------------------
  line('')
  line('===== 妥当性: 素の純ゴブリンパーティ vs ジョブ編成パーティ =====')
  line('（装備なし・同レベルで隊列とジョブの効果だけを比較）')

  async function runExpedition(areaId, tier, party, seed) {
    const engine = new ExpeditionEngine(seed)
    return suppressEngineLogs(() =>
      engine.generateExpedition(
        {
          partyId: 'strategist-selftest',
          areaId,
          tier,
          returnPolicy: 'never',
          clientVersion: 'headless-strategist-selftest',
        },
        party.map(g => ({ ...g, currentHp: undefined })),
      ),
    )
  }

  async function measure(areaId, tier, party, seeds) {
    const per = []
    for (const seed of seeds) {
      try {
        const replay = await runExpedition(areaId, tier, party, seed)
        per.push(extractExpeditionMetrics(replay))
      } catch (_) { return null }
    }
    return aggregateMetrics(per)
  }

  // 素パーティ: 全員素の純ゴブリン（ジョブなし・装備なし）
  function plainParty(level, size) {
    const members = []
    for (let i = 0; i < size; i++) members.push({})
    return buildStrategistParty({ level, size, comp: { members } })
  }

  // ジョブ編成: guard 前衛 + warrior/rider 前衛DPS + mage 後衛 + cleric 後衛ヒーラー
  function jobParty(level, size) {
    const members = [
      { jobId: 'guard' }, // 前列: タンク
      { jobId: 'warrior' }, // 前列: DPS(後衛鼓舞)
      { jobId: 'rider' }, // 前列: DPS
      { jobId: 'mage' }, // 後列: 術者
      { jobId: 'necromancer' }, // 後列: 術者
      { jobId: 'cleric' }, // 後列: ヒーラー
    ].slice(0, size)
    return buildStrategistParty({ level, size, comp: { members, frontCount: 3 } })
  }

  const seeds = []
  for (let s = 1; s <= 30; s++) seeds.push(s)
  const tier = 0
  // areaLevel が 15 以上（guard の cover/rear_guard が解放される水準）のエリアを数点
  const candidateAreas = (allAreaData.areas || [])
    .filter(a => (a.areaLevel || 0) >= 15)
    .slice(0, 4)
    .map(a => a.id)
  // 低レベル帯も 1 点（ジョブの talent 効果を確認）
  const lowArea = (allAreaData.areas || []).find(a => (a.areaLevel || 0) >= 5 && (a.areaLevel || 0) < 15)
  const testAreas = [...(lowArea ? [lowArea.id] : []), ...candidateAreas]

  line('')
  line('  area                 Lv  | plain成功率 job成功率 | plain残HP% job残HP% | plain進捗 job進捗')
  line('  ' + '-'.repeat(96))
  let plainWins = 0
  let jobWins = 0
  for (const areaId of testAreas) {
    const area = getAreaConfig(areaId)
    if (!area) continue
    const level = area.areaLevel
    const plain = await measure(areaId, tier, plainParty(level, 6), seeds)
    const job = await measure(areaId, tier, jobParty(level, 6), seeds)
    if (!plain || !job) {
      line(`  ${areaId.padEnd(20)} ${String(level).padStart(3)} | (このTierは非対応)`)
      continue
    }
    if (job.progressScore > plain.progressScore) jobWins++
    else if (plain.progressScore > job.progressScore) plainWins++
    line(
      `  ${areaId.padEnd(20)} ${String(level).padStart(3)} | `
      + `${(plain.successRate * 100).toFixed(0).padStart(9)}% ${(job.successRate * 100).toFixed(0).padStart(7)}% | `
      + `${plain.remainingHpPct.toFixed(0).padStart(8)}% ${job.remainingHpPct.toFixed(0).padStart(7)}% | `
      + `${plain.progressScore.toFixed(3).padStart(8)} ${job.progressScore.toFixed(3).padStart(7)}`,
    )
  }
  line('  ' + '-'.repeat(96))
  line(`  進捗スコア勝敗: ジョブ編成 ${jobWins} 勝 / 素編成 ${plainWins} 勝（対象 ${testAreas.length} エリア）`)
  line('')
  line('自己テスト完了。')
}
