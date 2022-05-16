import ErrorBoundaryFallback from '../js/features/pdf-preview/components/error-boundary-fallback'
import { withContextRoot } from './utils/with-context-root'

export default {
  title: 'Editor / PDF Preview / Error Boundary',
  component: ErrorBoundaryFallback,
}

export const PreviewErrorBoundary = () => {
  return withContextRoot(<ErrorBoundaryFallback type="preview" />)
}

export const PdfErrorBoundary = () => {
  return withContextRoot(<ErrorBoundaryFallback type="pdf" />)
}

export const LogsErrorBoundary = () => {
  return withContextRoot(<ErrorBoundaryFallback type="logs" />)
}
