import ErrorBoundaryFallback from '../js/features/pdf-preview/components/error-boundary-fallback'
import { ScopeDecorator } from './decorators/scope'

export default {
  title: 'Editor / PDF Preview / Error Boundary',
  component: ErrorBoundaryFallback,
  decorators: [ScopeDecorator],
}

export const PreviewErrorBoundary = () => {
  return <ErrorBoundaryFallback type="preview" />
}

export const PdfErrorBoundary = () => {
  return <ErrorBoundaryFallback type="pdf" />
}

export const LogsErrorBoundary = () => {
  return <ErrorBoundaryFallback type="logs" />
}
