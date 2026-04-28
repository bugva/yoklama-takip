import raw from './locales/tr.json'

export type MsgKey = keyof typeof raw

const messages = raw as Record<string, string>

export function t(key: MsgKey, vars?: Record<string, string | number>): string {
  let s = messages[key as string] ?? String(key)
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, String(v))
    }
  }
  return s
}

export const MONTH_NAMES = messages['months.long'].split(',')
export const WEEKDAY_SHORT = messages['weekdays.short'].split(',')
