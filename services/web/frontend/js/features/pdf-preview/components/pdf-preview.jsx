import PdfPreviewPane from './pdf-preview-pane'
import { memo } from 'react'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import PdfPreviewErrorBoundaryFallback from './pdf-preview-error-boundary-fallback'
import { useLayoutContext } from '../../../shared/context/layout-context'

function PdfPreview() {
  const { detachRole } = useLayoutContext()
  if (detachRole === 'detacher') return null
  return <PdfPreviewPane />
}

export default withErrorBoundary(memo(PdfPreview), () => (
  <PdfPreviewErrorBoundaryFallback type="preview" />
))
