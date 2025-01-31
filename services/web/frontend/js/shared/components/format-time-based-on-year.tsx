import { memo } from 'react'
import { formatTimeBasedOnYear } from '@/features/utils/format-date'

export const FormatTimeBasedOnYear = memo<{ date: string | number | Date }>(
  function FormatTimeBasedOnYear({ date }) {
    return <>{formatTimeBasedOnYear(date)}</>
  }
)
