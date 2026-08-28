/**
 * チケット関連の型定義
 */

// チケット種別
export const TICKET_TYPES = {
  SPEED: 'speed_ticket',
  BOOST: 'boost_ticket',
  GOLDEN_ACORN: 'golden_acorn',
} as const

export type TicketType = typeof TICKET_TYPES[keyof typeof TICKET_TYPES]

export interface TicketBalance {
  ticketType: TicketType
  quantity: number
}
