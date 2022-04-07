import { memo, Suspense } from 'react'
import classNames from 'classnames'
import PdfLogsViewer from './pdf-logs-viewer'
import PdfViewer from './pdf-viewer'
import LoadingSpinner from '../../../shared/components/loading-spinner'
import PdfHybridPreviewToolbar from './pdf-preview-hybrid-toolbar'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'

function PdfPreviewPane() {
  const { pdfUrl } = useCompileContext()
  const classes = classNames('pdf', 'full-size', {
    'pdf-empty': !pdfUrl,
  })
  return (
    <div className={classes}>
      <PdfHybridPreviewToolbar />
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
      <LoadingSpinner delay={500} />
    </div>
  )
}

export default memo(PdfPreviewPane)
