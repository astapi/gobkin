import type {
  ModTemplate,
  ModGenerationConfig,
  ModPoolData,
} from '../types/Mod'
import modPoolJson from './modPool.json'

const data = modPoolJson as ModPoolData

/**
 * 全Modテンプレートを取得
 */
export function getModTemplates(): ModTemplate[] {
  return data.templates
}

/**
 * Mod生成設定を取得
 */
export function getModConfig(): ModGenerationConfig {
  return {
    minMods: data.config?.minMods ?? 0,
    maxMods: data.config?.maxMods ?? 4,
  }
}

/**
 * 被ダメージ軽減の上限を取得
 */
export function getDamageReductionCap(): number {
  return data.config?.damageReductionCap ?? 75
}

/**
 * IDからModTemplateを取得
 */
export function getModTemplate(id: string): ModTemplate | undefined {
  return data.templates.find((t) => t.id === id)
}

/**
 * 個体値で利用可能なModTemplateリストを取得
 */
export function getAvailableModTemplates(
  individualValue: number
): ModTemplate[] {
  return data.templates.filter((t) => t.requiredIndividual <= individualValue)
}

/**
 * ModプールのバージョンI情報を取得
 */
export function getModPoolVersion(): string {
  return data.version
}
