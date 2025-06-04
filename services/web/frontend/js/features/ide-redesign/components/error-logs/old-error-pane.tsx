import PdfLogsViewer from '@/features/pdf-preview/components/pdf-logs-viewer'
import { PdfPreviewProvider } from '@/features/pdf-preview/components/pdf-preview-provider'

export default function OldErrorPane() {
  return (
    <PdfPreviewProvider>
      <PdfLogsViewer alwaysVisible />
    </PdfPreviewProvider>
  )
}
