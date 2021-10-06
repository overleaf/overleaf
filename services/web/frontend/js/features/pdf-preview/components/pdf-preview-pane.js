import { memo, Suspense } from 'react'
import PdfLogsViewer from './pdf-logs-viewer'
import PdfViewer from './pdf-viewer'
import { usePdfPreviewContext } from '../contexts/pdf-preview-context'
import PdfPreviewToolbar from './pdf-preview-toolbar'
import LoadingSpinner from '../../../shared/components/loading-spinner'

function PdfPreviewPane() {
  const { showLogs } = usePdfPreviewContext()

  return (
    <div className="pdf full-size">
      <PdfPreviewToolbar />
      <Suspense fallback={<LoadingPreview />}>
        <div className="pdf-viewer">
          <PdfViewer />
        </div>
      </Suspense>
      {showLogs && <PdfLogsViewer />}
    </div>
  )
}

function LoadingPreview() {
  return (
    <div className="pdf-loading-spinner-container">
      <LoadingSpinner />
    </div>
  )
}

export default memo(PdfPreviewPane)
