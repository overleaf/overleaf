import ErrorBoundaryFallback from '../js/features/pdf-preview/components/error-boundary-fallback'
import { setupContext } from './fixtures/context'
import { withContextRoot } from './utils/with-context-root'

export default {
  title: 'Editor / PDF Preview / Error Boundary',
  component: ErrorBoundaryFallback,
}

setupContext()

export const PreviewErrorBoundary = () => {
  return withContextRoot(<ErrorBoundaryFallback type="preview" />)
}

export const PdfErrorBoundary = () => {
  return withContextRoot(<ErrorBoundaryFallback type="pdf" />)
}

export const LogsErrorBoundary = () => {
  return withContextRoot(<ErrorBoundaryFallback type="logs" />)
}
