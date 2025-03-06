import PdfPreviewErrorBoundaryFallback from '../js/features/pdf-preview/components/pdf-preview-error-boundary-fallback'
import { ScopeDecorator } from './decorators/scope'

export default {
  title: 'Editor / PDF Preview / Error Boundary',
  component: PdfPreviewErrorBoundaryFallback,
  decorators: [ScopeDecorator],
}

export const PreviewErrorBoundary = () => {
  return <PdfPreviewErrorBoundaryFallback type="preview" />
}

export const PdfErrorBoundary = () => {
  return <PdfPreviewErrorBoundaryFallback type="pdf" />
}

export const LogsErrorBoundary = () => {
  return <PdfPreviewErrorBoundaryFallback type="logs" />
}
