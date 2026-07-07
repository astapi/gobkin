/**
 * 複数の書き込みを 1 つの DB トランザクションでアトミックに実行するための抽象。
 * infrastructure 側でメインコネクションの withTransactionAsync を用いて実装する。
 */
export interface ITransactionRunner {
  runInTransaction<T>(fn: () => Promise<T>): Promise<T>
}
