import { memo, Suspense } from 'react'
import classNames from 'classnames'
import PdfLogsViewer from './pdf-logs-viewer'
import PdfViewer from './pdf-viewer'
import LoadingSpinner from '../../../shared/components/loading-spinner'
import PdfHybridPreviewToolbar from './pdf-preview-hybrid-toolbar'
import PdfPreviewToolbar from './pdf-preview-toolbar'
import { useCompileContext } from '../../../shared/context/compile-context'

const newPreviewToolbar = new URLSearchParams(window.location.search).has(
  'new_preview_toolbar'
)

function PdfPreviewPane() {
  const { pdfUrl } = useCompileContext()
  const classes = classNames('pdf', 'full-size', {
    'pdf-empty': !pdfUrl,
  })
  return (
    <div className={classes}>
      {newPreviewToolbar ? <PdfPreviewToolbar /> : <PdfHybridPreviewToolbar />}
      <Suspense fallback={<LoadingPreview />}>
        <div className="pdf-viewer">
          <PdfViewer />
        </div>
      </Suspense>
      <PdfLogsViewer />
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
