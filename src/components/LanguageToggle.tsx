import { useLanguage } from '../LanguageContext'

export function LanguageToggle() {
  const { lang, toggleLang } = useLanguage()
  return (
    <button type="button" className="btn secondary sm" onClick={toggleLang}>
      {lang.toUpperCase()}
    </button>
  )
}
