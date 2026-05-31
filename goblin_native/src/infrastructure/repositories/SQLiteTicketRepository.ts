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

  async grantTicketsOnce(metadataKey: string, type: TicketType, count: number): Promise<boolean> {
    if (count <= 0) return false
    const db = await getDatabase()
    let granted = false
    await db.withTransactionAsync(async () => {
      const existing = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM app_metadata WHERE key = ?',
        [metadataKey]
      )
      if (existing) return

      await db.runAsync(
        `INSERT INTO tickets (ticket_type, quantity) VALUES (?, ?)
         ON CONFLICT(ticket_type) DO UPDATE SET quantity = quantity + ?`,
        [type, count, count]
      )
      await db.runAsync(
        'INSERT INTO app_metadata (key, value) VALUES (?, ?)',
        [metadataKey, new Date().toISOString()]
      )
      granted = true
    })
    return granted
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
