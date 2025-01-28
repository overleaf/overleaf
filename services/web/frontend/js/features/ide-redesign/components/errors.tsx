import PdfLogsViewer from '@/features/pdf-preview/components/pdf-logs-viewer'
import { PdfPreviewProvider } from '@/features/pdf-preview/components/pdf-preview-provider'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import OLBadge from '@/features/ui/components/ol/ol-badge'

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
    <OLBadge bg={errorCount > 0 ? 'danger' : 'warning'}>{totalCount}</OLBadge>
  )
}

export const ErrorPane = () => {
  return (
    <PdfPreviewProvider>
      <PdfLogsViewer alwaysVisible />
    </PdfPreviewProvider>
  )
}
