import { TFunction } from 'i18next'

export function formatSecondsToHoursAndMinutes(
  t: TFunction,
  seconds: number
): string {
  // round up: the caller tells the user how long to wait, so never understate
  const totalMinutes = Math.ceil(seconds / 60)
  const hrs = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60

  const parts = []

  if (hrs > 0) {
    parts.push(t('time_hour', { count: hrs }))
  }

  if (hrs > 0 && mins > 0) {
    parts.push(t('time_and'))
  }

  if (mins > 0) {
    parts.push(
      t('time_minute', {
        count: mins,
      })
    )
  }

  return parts.join(' ')
}
