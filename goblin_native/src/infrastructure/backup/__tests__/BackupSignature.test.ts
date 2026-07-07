/**
 * BackupSignature: HMAC-SHA256 ベースの署名検証ユニットテスト
 */
import {
  BACKUP_APP_ID,
  BACKUP_FORMAT_VERSION,
  BACKUP_SIGNATURE_ALGORITHM,
  type BackupDocument,
} from '../../../core/usecases/backup/BackupSchema'
import {
  buildPayloadFromDocument,
  buildSignablePayload,
  signBackup,
  verifyBackupSignature,
} from '../BackupSignature'

const buildDoc = (override?: Partial<BackupDocument>): BackupDocument => {
  const baseTables = {
    goblins: [{ id: 1, name: 'Marku' }],
    pending_goblins: [],
    parties: [{ id: 1, name: 'PT1' }],
    expeditions: [],
    base_state: [{ id: 1, gold: 500 }],
    dungeon_progress: [],
    equipment: [],
    story_progress: [],
    tickets: [],
    app_metadata: [{ key: 'schema_version', value: '14' }],
  }
  const metaWithoutSig = {
    app: BACKUP_APP_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    appVersion: '1.0.0',
    schemaVersion: 14,
    exportedAt: '2026-04-21T00:00:00.000Z',
    platform: 'ios' as const,
    signatureAlgorithm: BACKUP_SIGNATURE_ALGORITHM,
  } as const
  const payload = buildSignablePayload(metaWithoutSig, baseTables, {
    language: 'ja',
    debugSettings: { instantDungeonExploration: false },
  })
  return {
    meta: { ...metaWithoutSig, signature: signBackup(payload) },
    tables: baseTables,
    preferences: {
      language: 'ja',
      debugSettings: { instantDungeonExploration: false },
    },
    ...override,
  }
}

describe('BackupSignature', () => {
  it('生成直後のドキュメントは署名検証を通過する', () => {
    const doc = buildDoc()
    const payload = buildPayloadFromDocument(doc)
    expect(verifyBackupSignature(payload, doc.meta.signature)).toBe(true)
  })

  it('tables を 1 件改ざんすると検証に失敗する', () => {
    const doc = buildDoc()
    doc.tables.goblins[0].name = 'Tampered'
    const payload = buildPayloadFromDocument(doc)
    expect(verifyBackupSignature(payload, doc.meta.signature)).toBe(false)
  })

  it('preferences を改ざんすると検証に失敗する', () => {
    const doc = buildDoc()
    doc.preferences = { language: 'en' }
    const payload = buildPayloadFromDocument(doc)
    expect(verifyBackupSignature(payload, doc.meta.signature)).toBe(false)
  })

  it('schemaVersion を書き換えると検証に失敗する', () => {
    const doc = buildDoc()
    doc.meta.schemaVersion = 99
    const payload = buildPayloadFromDocument(doc)
    expect(verifyBackupSignature(payload, doc.meta.signature)).toBe(false)
  })

  it('シリアライズと再パース後でも署名検証を通過する (キー順差に頑健)', () => {
    const doc = buildDoc()
    const reparsed = JSON.parse(JSON.stringify(doc)) as BackupDocument
    const payload = buildPayloadFromDocument(reparsed)
    expect(verifyBackupSignature(payload, reparsed.meta.signature)).toBe(true)
  })

  it('canonical 化はオブジェクトのキー順に依存しない', () => {
    const tables = {
      goblins: [{ name: 'A', id: 1 }],
      pending_goblins: [],
      parties: [],
      expeditions: [],
      base_state: [],
      dungeon_progress: [],
      equipment: [],
      story_progress: [],
      tickets: [],
      app_metadata: [],
    }
    const meta = {
      app: BACKUP_APP_ID,
      formatVersion: BACKUP_FORMAT_VERSION,
      appVersion: '1.0.0',
      schemaVersion: 14,
      exportedAt: '2026-04-21T00:00:00.000Z',
      platform: 'ios' as const,
      signatureAlgorithm: BACKUP_SIGNATURE_ALGORITHM,
    } as const
    const reorderedMeta = {
      signatureAlgorithm: BACKUP_SIGNATURE_ALGORITHM,
      platform: 'ios' as const,
      exportedAt: '2026-04-21T00:00:00.000Z',
      schemaVersion: 14,
      appVersion: '1.0.0',
      formatVersion: BACKUP_FORMAT_VERSION,
      app: BACKUP_APP_ID,
    } as const
    const prefs = { language: 'ja', debugSettings: { instantDungeonExploration: false } }

    const a = buildSignablePayload(meta, tables, prefs)
    const b = buildSignablePayload(reorderedMeta, tables, prefs)
    expect(a).toBe(b)
  })
})
