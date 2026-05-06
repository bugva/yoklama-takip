import type { ScheduleSlot } from '../types'
import { t } from '../i18n'

type Props = {
  slot: ScheduleSlot
  courseName: string
  open: boolean
  onPresent: () => void
  onAbsent: () => void
  onSkipWholeDay: () => void
  onDismiss: () => void
}

export function NotifCheckInModal({
  slot,
  courseName,
  open,
  onPresent,
  onAbsent,
  onSkipWholeDay,
  onDismiss,
}: Props) {
  if (!open) return null
  return (
    <div className="modal-backdrop modal-layer-high" role="presentation" onClick={onDismiss}>
      <div
        className="modal sheet notif-checkin-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notif-checkin-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="notif-checkin-title">{t('notif.panelTitle')}</h2>
        <p className="muted notif-checkin-lead">
          {t('notif.panelLead', {
            course: courseName,
            time: `${slot.startTime}–${slot.endTime}`,
          })}
        </p>
        <div className="notif-checkin-actions">
          <button type="button" className="btn secondary notif-main-action" onClick={onPresent}>
            {t('notif.panelYes')}
          </button>
          <button type="button" className="btn primary notif-main-action" onClick={onAbsent}>
            {t('notif.panelNo')}
          </button>
          <p className="notif-checkin-note muted small">{t('notif.panelSkipDay')}</p>
          <button type="button" className="btn text sm notif-skip-day-btn" onClick={onSkipWholeDay}>
            {t('notif.panelSkipDay')}
          </button>
        </div>
      </div>
    </div>
  )
}
