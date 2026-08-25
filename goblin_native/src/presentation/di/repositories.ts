/**
 * Composition Root（リポジトリの一元生成）
 *
 * presentation / app 層から infrastructure を直接 import せず、
 * ここで生成したシングルトンインスタンスを core のインターフェース型で提供する。
 * infrastructure への直接依存はこのディレクトリ配下にのみ閉じ込める。
 */
import { SQLiteGoblinRepository } from '@/infrastructure/repositories/SQLiteGoblinRepository'
import { SQLiteEquipmentRepository } from '@/infrastructure/repositories/SQLiteEquipmentRepository'
import { SQLiteEquipmentAutoSellFilterRepository } from '@/infrastructure/repositories/SQLiteEquipmentAutoSellFilterRepository'
import { SQLitePartyRepository } from '@/infrastructure/repositories/SQLitePartyRepository'
import { SQLitePendingGoblinRepository } from '@/infrastructure/repositories/SQLitePendingGoblinRepository'
import { SQLiteBaseStateRepository } from '@/infrastructure/repositories/SQLiteBaseStateRepository'
import { SQLiteDungeonProgressRepository } from '@/infrastructure/repositories/SQLiteDungeonProgressRepository'
import { SQLiteExpeditionRepository } from '@/infrastructure/repositories/SQLiteExpeditionRepository'
import { SQLiteStoryProgressRepository } from '@/infrastructure/repositories/SQLiteStoryProgressRepository'
import { SQLiteTicketRepository } from '@/infrastructure/repositories/SQLiteTicketRepository'
import { SQLiteTutorialStateRepository } from '@/infrastructure/repositories/SQLiteTutorialStateRepository'
import { SQLiteTransactionRunner } from '@/infrastructure/database/SQLiteTransactionRunner'
import type {
  IGoblinRepository,
  IEquipmentRepository,
  IEquipmentAutoSellFilterRepository,
  IPartyRepository,
  IPendingGoblinRepository,
  IBaseStateRepository,
  IDungeonProgressRepository,
  IExpeditionRepository,
  IStoryProgressRepository,
  ITicketRepository,
  ITutorialStateRepository,
  ITransactionRunner,
} from '@/core/repositories'

export const goblinRepository: IGoblinRepository = SQLiteGoblinRepository.getInstance()
export const equipmentRepository: IEquipmentRepository = SQLiteEquipmentRepository.getInstance()
export const equipmentAutoSellFilterRepository: IEquipmentAutoSellFilterRepository = SQLiteEquipmentAutoSellFilterRepository.getInstance()
export const partyRepository: IPartyRepository = SQLitePartyRepository.getInstance()
export const pendingGoblinRepository: IPendingGoblinRepository = SQLitePendingGoblinRepository.getInstance()
export const dungeonProgressRepository: IDungeonProgressRepository = SQLiteDungeonProgressRepository.getInstance()
export const expeditionRepository: IExpeditionRepository = SQLiteExpeditionRepository.getInstance()
export const storyProgressRepository: IStoryProgressRepository = SQLiteStoryProgressRepository.getInstance()
export const ticketRepository: ITicketRepository = SQLiteTicketRepository.getInstance()
export const tutorialStateRepository: ITutorialStateRepository = SQLiteTutorialStateRepository.getInstance()
export const transactionRunner: ITransactionRunner = SQLiteTransactionRunner.getInstance()

// 拠点状態リポジトリ。ensureInitialized は初期化専用でインターフェースに含めないため、
// インターフェース型で公開しつつ初期化ヘルパーを別途提供する。
const baseStateRepositoryImpl = SQLiteBaseStateRepository.getInstance()
export const baseStateRepository: IBaseStateRepository = baseStateRepositoryImpl
export const ensureBaseStateInitialized = (): Promise<void> => baseStateRepositoryImpl.ensureInitialized()
