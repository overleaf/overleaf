import { lazy, memo, Suspense, ElementType } from 'react'
import { FullSizeLoadingSpinner } from '../../../shared/components/loading-spinner'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import { ErrorBoundaryFallback } from '../../../shared/components/error-boundary-fallback'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'

const editorPromotions = importOverleafModules('editorPromotions') as {
  import: { default: ElementType }
  path: string
}[]

const CodeMirrorEditor = lazy(
  () =>
    import(/* webpackChunkName: "codemirror-editor" */ './codemirror-editor')
)

function SourceEditor() {
  return (
    <Suspense fallback={<FullSizeLoadingSpinner delay={500} />}>
      {editorPromotions.map(({ import: { default: Component }, path }) => (
        <Component key={path} />
      ))}
      <CodeMirrorEditor />
    </Suspense>
  )
}

export default withErrorBoundary(memo(SourceEditor), ErrorBoundaryFallback)
