/**
 * チケット関連の型定義
 */

import type { TicketType } from '../constants/purchases'

export interface TicketBalance {
  ticketType: TicketType
  quantity: number
}
