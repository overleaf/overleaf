import { memo, Suspense } from 'react'
import classNames from 'classnames'
import PdfLogsViewer from './pdf-logs-viewer'
import PdfViewer from './pdf-viewer'
import { FullSizeLoadingSpinner } from '../../../shared/components/loading-spinner'
import PdfHybridPreviewToolbar from './pdf-preview-hybrid-toolbar'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import FasterCompilesFeedback from './faster-compiles-feedback'
import { PdfPreviewMessages } from './pdf-preview-messages'
import CompileTimeWarning from './compile-time-warning'
import CompileTimeoutMessages from './compile-timeout-messages'
import { PdfPreviewProvider } from './pdf-preview-provider'

function PdfPreviewPane() {
  const { pdfUrl, showNewCompileTimeoutUI } = useCompileContext()
  const classes = classNames('pdf', 'full-size', {
    'pdf-empty': !pdfUrl,
  })
  return (
    <div className={classes}>
      <PdfPreviewProvider>
        <PdfHybridPreviewToolbar />
        <PdfPreviewMessages>
          {showNewCompileTimeoutUI ? (
            <CompileTimeoutMessages />
          ) : (
            <CompileTimeWarning />
          )}
        </PdfPreviewMessages>
        <Suspense fallback={<FullSizeLoadingSpinner delay={500} />}>
          <div className="pdf-viewer">
            <PdfViewer />
            <FasterCompilesFeedback />
          </div>
        </Suspense>
        <PdfLogsViewer />
      </PdfPreviewProvider>
    </div>
  )
}

export default memo(PdfPreviewPane)
