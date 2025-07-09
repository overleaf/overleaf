import PdfPreviewPane from './pdf-preview-pane'
import { memo } from 'react'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import PdfPreviewErrorBoundaryFallback from './pdf-preview-error-boundary-fallback'
import { useLayoutContext } from '../../../shared/context/layout-context'
import { VisualPreview } from './visual-preview'
import { useEditorViewContext } from '@/features/ide-react/context/editor-view-context'
import { useFeatureFlag } from '@/shared/context/split-test-context'

function PdfPreview() {
  const { detachRole } = useLayoutContext()
  const { view } = useEditorViewContext()
  const visualPreviewEnabled = useFeatureFlag('visual-preview')
  if (detachRole === 'detacher') return null
  if (visualPreviewEnabled && view) return <VisualPreview view={view} />
  return <PdfPreviewPane />
}

export default withErrorBoundary(memo(PdfPreview), () => (
  <PdfPreviewErrorBoundaryFallback type="preview" />
))
