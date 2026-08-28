export const SUPPORTED_LANGUAGES = ['ja', 'en', 'ko'] as const

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: SupportedLanguage = 'ja'
