import type { ExpeditionReplay } from '../types'

export function isDungeonCompleted(replay: ExpeditionReplay): boolean {
  return replay.events.some(event => event.type === 'return' && event.reason === 'completed')
}

export function getMaxClearedFloorFromReplay(replay: ExpeditionReplay): number {
  if (isDungeonCompleted(replay)) {
    return replay.meta.floors
  }

  let maxClearedFloor = 0
  for (let index = 0; index < replay.events.length; index++) {
    const event = replay.events[index]
    if (event.type === 'floor_up') {
      maxClearedFloor = Math.max(maxClearedFloor, event.from)
      continue
    }

    if (event.type !== 'floor_end') continue

    for (const nextEvent of replay.events.slice(index + 1)) {
      if (nextEvent.type !== 'battle' && nextEvent.type !== 'boss') continue
      if (nextEvent.floor !== event.floor || nextEvent.at !== event.at) continue
      if (nextEvent.combat.outcome === 'win') {
        maxClearedFloor = Math.max(maxClearedFloor, event.floor)
      }
      break
    }
  }

  return maxClearedFloor
}
