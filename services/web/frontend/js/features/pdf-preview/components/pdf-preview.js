import PdfPreviewPane from './pdf-preview-pane'
import { memo } from 'react'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import ErrorBoundaryFallback from './error-boundary-fallback'

function PdfPreview() {
  return <PdfPreviewPane />
}

export default withErrorBoundary(memo(PdfPreview), () => (
  <ErrorBoundaryFallback type="preview" />
))
