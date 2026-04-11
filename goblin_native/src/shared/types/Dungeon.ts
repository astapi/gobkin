export type Dungeon = {
  id: string
  name: string
  floors: number
  exploration_time_sec_first: number
  exploration_time_sec: number
  description: string
  cleared?: boolean
  unlocked?: boolean
  icon?: string
  difficulty?: string
  unlockNext?: string
  unlockRequires?: string
  areaLevel?: number                // エリアレベル（1-8）、個体値計算に使用
  isBaseCapture?: boolean           // 拠点化可能か
  rankUpTarget?: number             // このダンジョン制圧で到達するランク
  maxClearedTier?: number           // 最大クリア済みティア（0=未クリア, 1=通常, 2=魔性, 3=宿った, 4=伝説, 5=恐ろしい, 6=壊れた）
}
