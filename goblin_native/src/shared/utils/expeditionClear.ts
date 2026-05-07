import type { ExpeditionReplay } from '../types'

export function isDungeonCompleted(replay: ExpeditionReplay): boolean {
  return replay.events.some(event => event.type === 'return' && event.reason === 'completed')
}
