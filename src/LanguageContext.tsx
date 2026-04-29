import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { getLanguage, setLanguage, type AppLang } from './i18n'

type LangContextValue = {
  lang: AppLang
  toggleLang: () => void
  setLang: (next: AppLang) => void
}

const LangContext = createContext<LangContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<AppLang>(getLanguage)

  const toggleLang = useCallback(() => {
    const next: AppLang = lang === 'tr' ? 'en' : 'tr'
    setLanguage(next)
    setLangState(next)
  }, [lang])

  const setLang = useCallback((next: AppLang) => {
    setLanguage(next)
    setLangState(next)
  }, [])

  return <LangContext.Provider value={{ lang, toggleLang, setLang }}>{children}</LangContext.Provider>
}

export function useLanguage(): LangContextValue {
  const v = useContext(LangContext)
  if (!v) throw new Error('useLanguage must be used within LanguageProvider')
  return v
}
