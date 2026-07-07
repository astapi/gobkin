import type { ExpeditionReplay } from '../../shared/types'

/**
 * 遠征完了処理が必要とする永続化操作の最小ポート。
 * complete は WHERE status='ongoing' ガード付きで status を確定し、
 * 更新できた（=このプロセスが完了処理担当）かどうかを返す（冪等性ゲート）。
 */
export interface IExpeditionCompletionGateway {
  complete(id: string, replay: ExpeditionReplay): Promise<boolean>
  updateReplay(id: string, replay: ExpeditionReplay): Promise<void>
}
