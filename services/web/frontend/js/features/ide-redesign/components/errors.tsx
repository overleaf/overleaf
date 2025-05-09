import PdfLogsViewer from '@/features/pdf-preview/components/pdf-logs-viewer'
import { PdfPreviewProvider } from '@/features/pdf-preview/components/pdf-preview-provider'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import { RailIndicator } from './rail-indicator'

export const ErrorIndicator = () => {
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

export const ErrorPane = () => {
  return (
    <PdfPreviewProvider>
      <PdfLogsViewer alwaysVisible />
    </PdfPreviewProvider>
  )
}
