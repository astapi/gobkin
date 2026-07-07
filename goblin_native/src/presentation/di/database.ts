/**
 * Composition Root（DB ライフサイクル）
 *
 * presentation / app 層が infrastructure を直接 import しないよう、
 * DB 初期化・リセット系の関数と定数をここから提供する。
 */
export { getDatabase, resetDatabase, CURRENT_SCHEMA_VERSION } from '@/infrastructure/database'
