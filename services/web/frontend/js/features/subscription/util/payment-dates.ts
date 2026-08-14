import { formatTime } from '@/features/utils/format-date'

export function formatPaymentDate(date: string | null | undefined) {
  if (!date) {
    return null
  }
  return formatTime(date, 'MMMM Do, YYYY', true)
}

export function formatPaymentDateTime(date: string | null | undefined) {
  if (!date) {
    return null
  }
  return formatTime(date, 'MMMM Do, YYYY h:mm A [UTC]', true)
}
