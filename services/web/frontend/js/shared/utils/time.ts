import { TFunction } from 'i18next'

export function formatSecondsToHoursAndMinutes(
  t: TFunction,
  seconds: number
): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)

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
