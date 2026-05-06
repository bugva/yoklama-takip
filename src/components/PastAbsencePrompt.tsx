import { LanguageToggle } from './LanguageToggle'
import { t } from '../i18n'

type Props = {
  onYes: () => void
  onNo: () => void
  onBack?: () => void
}

export function PastAbsencePrompt({ onYes, onNo, onBack }: Props) {
  return (
    <div className="screen">
      <div className="screen-top-bar">
        {onBack && (
          <button type="button" className="btn secondary sm" onClick={onBack}>
            {t('app.back')}
          </button>
        )}
        <LanguageToggle />
      </div>
      <h1>{t('onboard.pastTitle')}</h1>
      <p className="lead">{t('onboard.pastLead')}</p>
      <p className="muted small">{t('onboard.pastLaterHint')}</p>
      <div className="btn-row wrap" style={{ marginTop: 20 }}>
        <button type="button" className="btn primary" onClick={onYes}>
          {t('onboard.pastYes')}
        </button>
        <button type="button" className="btn secondary" onClick={onNo}>
          {t('onboard.pastNo')}
        </button>
      </div>
    </div>
  )
}
