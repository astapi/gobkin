export type SlotDragPayload =
  | { kind: 'new'; enemyId: string }
  | { kind: 'move'; enemyId: string; source: { row: number; slot: number } }

export const DRAG_MIME = 'application/x-goblin-studio'

export function encodePayload(payload: SlotDragPayload): string {
  return JSON.stringify(payload)
}

export function decodePayload(raw: string | null | undefined): SlotDragPayload | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as SlotDragPayload
    if (parsed && typeof parsed === 'object' && 'kind' in parsed && 'enemyId' in parsed) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}
