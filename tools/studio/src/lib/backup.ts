import { z } from 'zod'

export const BackupMetaSchema = z.object({
  app: z.string(),
  formatVersion: z.number().int(),
  appVersion: z.string().optional(),
  schemaVersion: z.number().int().optional(),
  exportedAt: z.string().optional(),
  platform: z.string().optional(),
  signatureAlgorithm: z.string().optional(),
  signature: z.string().optional(),
})

export const BackupSchema = z.object({
  meta: BackupMetaSchema,
  tables: z
    .object({
      goblins: z.array(z.record(z.unknown())).optional(),
      parties: z.array(z.record(z.unknown())).optional(),
      equipment: z.array(z.record(z.unknown())).optional(),
      pending_goblins: z.array(z.record(z.unknown())).optional(),
      expeditions: z.array(z.record(z.unknown())).optional(),
      base_state: z.array(z.record(z.unknown())).optional(),
      dungeon_progress: z.array(z.record(z.unknown())).optional(),
      story_progress: z.array(z.record(z.unknown())).optional(),
      app_metadata: z.array(z.record(z.unknown())).optional(),
    })
    .passthrough(),
  preferences: z.unknown().optional(),
})

export type BackupDocument = z.infer<typeof BackupSchema>

export async function parseBackupFile(file: File): Promise<BackupDocument> {
  const text = await file.text()
  const json = JSON.parse(text)
  const result = BackupSchema.safeParse(json)
  if (!result.success) {
    throw new Error(
      `バックアップ形式が不正です: ${result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(' / ')}`,
    )
  }
  if (result.data.meta.app !== 'goblin_kingdom') {
    throw new Error(
      `想定外の app 識別子です（meta.app = ${result.data.meta.app}）。goblin_kingdom のバックアップのみ対応しています。`,
    )
  }
  return result.data
}
