import PdfPreviewPane from './pdf-preview-pane'
import useCompileTriggers from '../hooks/use-compile-triggers'
import { memo } from 'react'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import ErrorBoundaryFallback from './error-boundary-fallback'

function PdfPreview() {
  useCompileTriggers()
  return <PdfPreviewPane />
}

export default withErrorBoundary(memo(PdfPreview), () => (
  <ErrorBoundaryFallback type="preview" />
))
