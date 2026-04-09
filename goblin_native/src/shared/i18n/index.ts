import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ja from './resources/ja'
import en from './resources/en'
import ko from './resources/ko'
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type SupportedLanguage } from './keys'

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

if (!i18n.isInitialized) {
  void i18n
    .use(initReactI18next)
    .init({
      compatibilityJSON: 'v4',
      lng: detectLanguage(),
      fallbackLng: DEFAULT_LANGUAGE,
      interpolation: {
        escapeValue: false,
      },
      resources: {
        ja: { translation: ja },
        en: { translation: en },
        ko: { translation: ko },
      },
    })
}

export default i18n
