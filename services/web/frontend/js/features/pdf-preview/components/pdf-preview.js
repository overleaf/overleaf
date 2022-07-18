import PdfPreviewPane from './pdf-preview-pane'
import useCompileTriggers from '../hooks/use-compile-triggers'
import { memo } from 'react'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import ErrorBoundaryFallback from './error-boundary-fallback'
import { useLayoutContext } from '../../../shared/context/layout-context'

function PdfPreview() {
  useCompileTriggers()

  const { detachRole } = useLayoutContext()
  if (detachRole === 'detacher') return null
  return <PdfPreviewPane />
}

export default withErrorBoundary(memo(PdfPreview), () => (
  <ErrorBoundaryFallback type="preview" />
))
