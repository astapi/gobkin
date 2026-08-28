/**
 * SQLiteExpeditionRepository のユニットテスト
 * getDatabase をモックして SQL 呼び出しを検証する
 */

const mockRunAsync = jest.fn()
const mockGetDatabase = jest.fn().mockResolvedValue({ runAsync: mockRunAsync })

jest.mock('../../database', () => ({
  getDatabase: () => mockGetDatabase(),
}))

import { SQLiteExpeditionRepository, MAX_EXPEDITION_HISTORY } from '../SQLiteExpeditionRepository'

describe('SQLiteExpeditionRepository.pruneOldCompleted', () => {
  beforeEach(() => {
    mockRunAsync.mockReset()
    mockGetDatabase.mockClear()
  })

  it('完了/失敗遠征のみを対象にし、ongoing は保持する SQL を発行する', async () => {
    mockRunAsync.mockResolvedValue({ changes: 3 })
    const repo = SQLiteExpeditionRepository.getInstance()

    const deleted = await repo.pruneOldCompleted(50)

    expect(deleted).toBe(3)
    expect(mockRunAsync).toHaveBeenCalledTimes(1)
    const [sql, params] = mockRunAsync.mock.calls[0]
    expect(sql).toContain("status != 'ongoing'")
    expect(sql).toContain('ORDER BY created_at DESC')
    expect(sql).toContain('LIMIT ?')
    expect(params).toEqual([50])
  })

  it('max が負の値なら DB を触らずに 0 を返す', async () => {
    const repo = SQLiteExpeditionRepository.getInstance()

    const deleted = await repo.pruneOldCompleted(-1)

    expect(deleted).toBe(0)
    expect(mockRunAsync).not.toHaveBeenCalled()
  })

  it('result.changes が undefined でも 0 を返す', async () => {
    mockRunAsync.mockResolvedValue({})
    const repo = SQLiteExpeditionRepository.getInstance()

    const deleted = await repo.pruneOldCompleted(10)

    expect(deleted).toBe(0)
  })

  it('MAX_EXPEDITION_HISTORY は 50', () => {
    expect(MAX_EXPEDITION_HISTORY).toBe(50)
  })
})
