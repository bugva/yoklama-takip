import type { ScheduleSlot } from '../types'

export function parseIcs(icsContent: string): ScheduleSlot[] {
  const slots: ScheduleSlot[] = []
  const events = icsContent.split('BEGIN:VEVENT')

  for (let i = 1; i < events.length; i++) {
    const eventText = events[i].split('END:VEVENT')[0]

    // Extract Summary (Course Name)
    const summaryMatch = eventText.match(/SUMMARY:(.*?)(?:\r\n|\n|$)/)
    if (!summaryMatch) continue
    const courseName = summaryMatch[1].trim()

    // Extract Start Time
    // Match DTSTART;TZID=...:YYYYMMDDTHHMMSS or DTSTART:YYYYMMDDTHHMMSSZ
    const dtstartMatch = eventText.match(/DTSTART(?:[^:]*):(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/)
    if (!dtstartMatch) continue

    const year = parseInt(dtstartMatch[1], 10)
    const month = parseInt(dtstartMatch[2], 10) - 1 // JS months are 0-11
    const date = parseInt(dtstartMatch[3], 10)
    const startHour = dtstartMatch[4]
    const startMinute = dtstartMatch[5]

    // Extract End Time
    const dtendMatch = eventText.match(/DTEND(?:[^:]*):(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/)
    const [endHour, endMinute] = dtendMatch
      ? [dtendMatch[4], dtendMatch[5]]
      : [String((parseInt(startHour, 10) + 1) % 24).padStart(2, '0'), startMinute] // If no DTEND, default to 1 hour after start

    const startTime = `${startHour}:${startMinute}`
    const endTime = `${endHour}:${endMinute}`

    // Calculate Day of Week
    // JS getDay(): Sunday = 0, Monday = 1, ... Saturday = 6
    // App dayOfWeek: Monday = 0, Tuesday = 1, ... Sunday = 6
    const jsDate = new Date(year, month, date)
    const dayOfWeek = (jsDate.getDay() + 6) % 7

    // Check if we already have this exact slot to avoid duplicates
    const isDuplicate = slots.some(
      (s) => s.dayOfWeek === dayOfWeek && s.startTime === startTime && s.courseName === courseName
    )

    if (!isDuplicate) {
      slots.push({
        id: crypto.randomUUID(),
        dayOfWeek,
        startTime,
        endTime,
        courseName,
        isExtra: false,
        extraRecurring: true,
        extraAttendanceTracked: false,
      })
    }
  }

  return slots
}
