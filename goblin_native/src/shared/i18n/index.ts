import AsyncStorage from '@react-native-async-storage/async-storage'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ja from './resources/ja'
import en from './resources/en'
import ko from './resources/ko'
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type SupportedLanguage } from './keys'

const LANGUAGE_STORAGE_KEY = 'app-language'
let initializePromise: Promise<void> | null = null
const resources = {
  ja: { translation: ja },
  en: { translation: en },
  ko: { translation: ko },
} as const

function detectLanguage(): SupportedLanguage {
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
    return DEFAULT_LANGUAGE
  }

  try {
    const localizationModule = require('expo-localization') as {
      getLocales?: () => Array<{ languageCode?: string | null }>
    }
    const locale = localizationModule.getLocales?.()[0]?.languageCode?.toLowerCase()
    if (locale && SUPPORTED_LANGUAGES.includes(locale as SupportedLanguage)) {
      return locale as SupportedLanguage
    }
  } catch {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale.slice(0, 2).toLowerCase()
    if (SUPPORTED_LANGUAGES.includes(locale as SupportedLanguage)) {
      return locale as SupportedLanguage
    }
  }
  return DEFAULT_LANGUAGE
}

function isSupportedLanguage(language: string | null | undefined): language is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)
}

async function getStoredLanguage(): Promise<SupportedLanguage | null> {
  try {
    const storedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
    return isSupportedLanguage(storedLanguage) ? storedLanguage : null
  } catch {
    return null
  }
}

async function setupI18n(): Promise<void> {
  if (!i18n.isInitialized) {
    await i18n
      .use(initReactI18next)
      .init({
        compatibilityJSON: 'v4',
        lng: detectLanguage(),
        fallbackLng: DEFAULT_LANGUAGE,
        interpolation: {
          escapeValue: false,
        },
        resources,
      })
    return
  }

  await i18n.init({
    ...i18n.options,
    lng: i18n.resolvedLanguage ?? i18n.language ?? detectLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: {
      escapeValue: false,
    },
    resources,
  })
}

export async function initializeI18n(): Promise<void> {
  if (!initializePromise) {
    initializePromise = (async () => {
      await setupI18n()
      const storedLanguage = await getStoredLanguage()
      if (storedLanguage && i18n.resolvedLanguage !== storedLanguage) {
        await i18n.changeLanguage(storedLanguage)
      }
    })()
  }

  await initializePromise
}

export function getCurrentLanguage(): SupportedLanguage {
  const resolvedLanguage = i18n.resolvedLanguage ?? i18n.language
  return isSupportedLanguage(resolvedLanguage) ? resolvedLanguage : DEFAULT_LANGUAGE
}

export async function setAppLanguage(language: SupportedLanguage): Promise<void> {
  await initializeI18n()

  if (i18n.resolvedLanguage !== language) {
    await i18n.changeLanguage(language)
  }

  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // 言語保存に失敗しても表示切替は維持する
  }
}

void initializeI18n()

export default i18n
