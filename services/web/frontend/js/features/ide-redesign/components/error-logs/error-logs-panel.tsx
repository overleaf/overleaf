import { PdfPreviewProvider } from '@/features/pdf-preview/components/pdf-preview-provider'
import ErrorLogs from './error-logs'
import ErrorLogsHeader from './error-logs-header'

export default function ErrorLogsPanel() {
  return (
    <PdfPreviewProvider>
      <div className="error-logs-panel">
        <ErrorLogsHeader />
        <ErrorLogs />
      </div>
    </PdfPreviewProvider>
  )
}
