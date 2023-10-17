import { lazy, memo, Suspense } from 'react'
import { FullSizeLoadingSpinner } from '../../../shared/components/loading-spinner'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import { ErrorBoundaryFallback } from '../../../shared/components/error-boundary-fallback'

const CodeMirrorEditor = lazy(
  () =>
    import(/* webpackChunkName: "codemirror-editor" */ './codemirror-editor')
)

function SourceEditor() {
  return (
    <Suspense fallback={<FullSizeLoadingSpinner delay={500} />}>
      <CodeMirrorEditor />
    </Suspense>
  )
}

export default withErrorBoundary(memo(SourceEditor), ErrorBoundaryFallback)
