import { ElementType, memo, useRef, useState } from 'react'
import useIsMounted from '../../../shared/hooks/use-is-mounted'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import CodeMirrorView from './codemirror-view'
import CodeMirrorSearch from './codemirror-search'
import { CodeMirrorToolbar } from './codemirror-toolbar'
import { CodemirrorOutline } from './codemirror-outline'
import { CodeMirrorCommandTooltip } from './codemirror-command-tooltip'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import { FigureModal } from './figure-modal/figure-modal'
import { ReviewPanelProviders } from '@/features/review-panel-new/context/review-panel-providers'
import { ReviewPanelMigration } from '@/features/source-editor/components/review-panel/review-panel-migration'
import ReviewTooltipMenu from '@/features/review-panel-new/components/review-tooltip-menu'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import {
  CodeMirrorStateContext,
  CodeMirrorViewContext,
} from './codemirror-context'
import MathPreviewTooltip from './math-preview-tooltip'

// TODO: remove this when definitely no longer used
export * from './codemirror-context'

const sourceEditorComponents = importOverleafModules(
  'sourceEditorComponents'
) as { import: { default: ElementType }; path: string }[]

const sourceEditorToolbarComponents = importOverleafModules(
  'sourceEditorToolbarComponents'
) as { import: { default: ElementType }; path: string }[]

function CodeMirrorEditor() {
  // create the initial state
  const [state, setState] = useState(() => {
    return EditorState.create()
  })

  const isMounted = useIsMounted()

  const newReviewPanel = useFeatureFlag('review-panel-redesign')

  // create the view using the initial state and intercept transactions
  const viewRef = useRef<EditorView | null>(null)
  if (viewRef.current === null) {
    // @ts-ignore (disable EditContext-based editing until stable)
    EditorView.EDIT_CONTEXT = false

    const view = new EditorView({
      state,
      dispatchTransactions: trs => {
        view.update(trs)
        if (isMounted.current) {
          setState(view.state)
        }
      },
    })
    viewRef.current = view
  }

  return (
    <CodeMirrorStateContext.Provider value={state}>
      <CodeMirrorViewContext.Provider value={viewRef.current}>
        <ReviewPanelProviders>
          <CodemirrorOutline />
          <CodeMirrorView />
          <FigureModal />
          <CodeMirrorSearch />
          <CodeMirrorToolbar />
          {sourceEditorToolbarComponents.map(
            ({ import: { default: Component }, path }) => (
              <Component key={path} />
            )
          )}
          <CodeMirrorCommandTooltip />

          <MathPreviewTooltip />
          {newReviewPanel && <ReviewTooltipMenu />}
          <ReviewPanelMigration />

          {sourceEditorComponents.map(
            ({ import: { default: Component }, path }) => (
              <Component key={path} />
            )
          )}
        </ReviewPanelProviders>
      </CodeMirrorViewContext.Provider>
    </CodeMirrorStateContext.Provider>
  )
}

export default memo(CodeMirrorEditor)
