import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import { RailIndicator } from '../rail-indicator'

export default function ErrorIndicator() {
  const { logEntries } = useCompileContext()

  if (!logEntries) {
    return null
  }

  const errorCount = Number(logEntries.errors?.length)
  const warningCount = Number(logEntries.warnings?.length)
  const totalCount = errorCount + warningCount

  if (totalCount === 0) {
    return null
  }

  return (
    <RailIndicator
      count={totalCount}
      type={errorCount > 0 ? 'danger' : 'warning'}
    />
  )
}
