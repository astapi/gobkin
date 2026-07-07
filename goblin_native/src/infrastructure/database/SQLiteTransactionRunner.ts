import type { ITransactionRunner } from '../../core/repositories/ITransactionRunner'
import { getDatabase } from './index'

/**
 * メインコネクションの withTransactionAsync（BEGIN/COMMIT）で fn 全体を
 * 1 トランザクションに束ねる ITransactionRunner 実装。
 *
 * IMPORTANT: withExclusiveTransactionAsync は別コネクション（useNewConnection）で
 * 実行されるため、メインコネクション経由のリポジトリ書き込みは参加しない。
 * ここではメインコネクションの withTransactionAsync を用い、同一コネクション上で
 * 実行される全リポジトリ書き込みを同一トランザクションに含める。
 */
export class SQLiteTransactionRunner implements ITransactionRunner {
  private static instance: SQLiteTransactionRunner | null = null

  static getInstance(): SQLiteTransactionRunner {
    if (!SQLiteTransactionRunner.instance) {
      SQLiteTransactionRunner.instance = new SQLiteTransactionRunner()
    }
    return SQLiteTransactionRunner.instance
  }

  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    const db = await getDatabase()
    let result: T
    let executed = false
    await db.withTransactionAsync(async () => {
      result = await fn()
      executed = true
    })
    // withTransactionAsync が rollback した場合は既に例外が伝播しているため、
    // ここに到達した時点で fn は必ず完走している。
    if (!executed) {
      throw new Error('Transaction did not execute')
    }
    return result!
  }
}
