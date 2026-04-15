import { getDatabase } from '../database'
import type { ITicketRepository } from '../../core/repositories/ITicketRepository'
import type { TicketType } from '../../shared/constants/purchases'
import type { TicketBalance } from '../../shared/types/Ticket'

/**
 * チケット残数管理のSQLiteリポジトリ実装
 * シングルトンパターン
 */
export class SQLiteTicketRepository implements ITicketRepository {
  private static instance: SQLiteTicketRepository | null = null

  static getInstance(): SQLiteTicketRepository {
    if (!SQLiteTicketRepository.instance) {
      SQLiteTicketRepository.instance = new SQLiteTicketRepository()
    }
    return SQLiteTicketRepository.instance
  }

  async getTicketCount(type: TicketType): Promise<number> {
    const db = await getDatabase()
    const row = await db.getFirstAsync<{ quantity: number }>(
      'SELECT quantity FROM tickets WHERE ticket_type = ?',
      [type]
    )
    return row?.quantity ?? 0
  }

  async getAllTickets(): Promise<TicketBalance[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<{ ticket_type: string; quantity: number }>(
      'SELECT ticket_type, quantity FROM tickets'
    )
    return rows.map(row => ({
      ticketType: row.ticket_type as TicketType,
      quantity: row.quantity,
    }))
  }

  async addTickets(type: TicketType, count: number): Promise<void> {
    if (count <= 0) return
    const db = await getDatabase()
    await db.runAsync(
      `INSERT INTO tickets (ticket_type, quantity) VALUES (?, ?)
       ON CONFLICT(ticket_type) DO UPDATE SET quantity = quantity + ?`,
      [type, count, count]
    )
  }

  async useTicket(type: TicketType): Promise<boolean> {
    const db = await getDatabase()
    const result = await db.runAsync(
      'UPDATE tickets SET quantity = quantity - 1 WHERE ticket_type = ? AND quantity > 0',
      [type]
    )
    return result.changes > 0
  }
}
