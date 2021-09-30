import { memo, Suspense } from 'react'
import PdfLogsViewer from './pdf-logs-viewer'
import PdfViewer from './pdf-viewer'
import { usePdfPreviewContext } from '../contexts/pdf-preview-context'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import PdfPreviewToolbar from './pdf-preview-toolbar'

function PdfPreviewPane() {
  const { showLogs } = usePdfPreviewContext()

  return (
    <div className="pdf full-size">
      <PdfPreviewToolbar />
      <Suspense fallback={<div>Loading…</div>}>
        <div className="pdf-viewer">
          <PdfViewer />
        </div>
      </Suspense>
      {showLogs && <PdfLogsViewer />}
    </div>
  )
}

export default memo(withErrorBoundary(PdfPreviewPane))
