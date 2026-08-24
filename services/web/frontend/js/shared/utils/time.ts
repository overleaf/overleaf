import { TFunction } from 'i18next'

export function secondsToHoursAndMinutes(seconds: number): {
  hours: number
  minutes: number
} {
  // round up: the caller tells the user how long to wait, so never understate
  const totalMinutes = Math.ceil(seconds / 60)
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  }
}

export function formatSecondsToHoursAndMinutes(
  t: TFunction,
  seconds: number
): string {
  const { hours, minutes } = secondsToHoursAndMinutes(seconds)

  const parts = []

  if (hours > 0) {
    parts.push(t('time_hour', { count: hours }))
  }

  if (hours > 0 && minutes > 0) {
    parts.push(t('time_and'))
  }

  if (minutes > 0) {
    parts.push(
      t('time_minute', {
        count: minutes,
      })
    )
  }

  return parts.join(' ')
}
