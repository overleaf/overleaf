import { lazy, memo, Suspense, ElementType } from 'react'
import { FullSizeLoadingSpinner } from '../../../shared/components/loading-spinner'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import { ErrorBoundaryFallback } from '../../../shared/components/error-boundary-fallback'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import GrammarlyAdvert from './grammarly-advert'

const writefullPromotion = importOverleafModules(
  'writefullEditorPromotion'
) as {
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
      {writefullPromotion.map(({ import: { default: Component }, path }) => (
        <Component key={path} />
      ))}
      <GrammarlyAdvert />
      <CodeMirrorEditor />
    </Suspense>
  )
}

export default withErrorBoundary(memo(SourceEditor), ErrorBoundaryFallback)
