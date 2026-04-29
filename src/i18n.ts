import trRaw from './locales/tr.json'
import enRaw from './locales/en.json'

export type MsgKey = keyof typeof trRaw
export type AppLang = 'tr' | 'en'

const DICT: Record<AppLang, Record<string, string>> = {
  tr: trRaw as Record<string, string>,
  en: enRaw as Record<string, string>,
}

const LANG_KEY = 'app-lang'

function detectInitialLang(): AppLang {
  const stored = localStorage.getItem(LANG_KEY)
  if (stored === 'tr' || stored === 'en') return stored
  const nav = navigator.language.toLowerCase()
  return nav.startsWith('tr') ? 'tr' : 'en'
}

let currentLang: AppLang = detectInitialLang()

function currentMessages(): Record<string, string> {
  return DICT[currentLang]
}

export function t(key: MsgKey, vars?: Record<string, string | number>): string {
  const fromActive = currentMessages()[key as string]
  let s = fromActive ?? DICT.tr[key as string] ?? String(key)
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, String(v))
    }
  }
  return s
}

export let MONTH_NAMES = currentMessages()['months.long'].split(',')
export let WEEKDAY_SHORT = currentMessages()['weekdays.short'].split(',')

export function getLanguage(): AppLang {
  return currentLang
}

export function hasStoredLanguagePreference(): boolean {
  const stored = localStorage.getItem(LANG_KEY)
  return stored === 'tr' || stored === 'en'
}

export function setLanguage(next: AppLang): void {
  if (currentLang === next) return
  currentLang = next
  localStorage.setItem(LANG_KEY, next)
  MONTH_NAMES = currentMessages()['months.long'].split(',')
  WEEKDAY_SHORT = currentMessages()['weekdays.short'].split(',')
}
