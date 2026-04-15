import type { TicketType } from '../../shared/constants/purchases'
import type { TicketBalance } from '../../shared/types/Ticket'

/**
 * チケット残数管理リポジトリインターフェース
 */
export interface ITicketRepository {
  /** 指定チケットの残数を取得 */
  getTicketCount(type: TicketType): Promise<number>

  /** 全チケットの残数を取得 */
  getAllTickets(): Promise<TicketBalance[]>

  /** チケットを追加 */
  addTickets(type: TicketType, count: number): Promise<void>

  /** チケットを1枚消費（残数0ならfalse） */
  useTicket(type: TicketType): Promise<boolean>
}
