export function applyInstantDungeonExploration(
  durationSec: number,
  instantDungeonExploration: boolean,
): number {
  return instantDungeonExploration ? 1 : durationSec
}
