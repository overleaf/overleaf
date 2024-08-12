import {
  createContext,
  ElementType,
  memo,
  useContext,
  useRef,
  useState,
} from 'react'
import useIsMounted from '../../../shared/hooks/use-is-mounted'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import CodeMirrorView from './codemirror-view'
import CodeMirrorSearch from './codemirror-search'
import { CodeMirrorToolbar } from './codemirror-toolbar'
import { CodemirrorOutline } from './codemirror-outline'
import { CodeMirrorCommandTooltip } from './codemirror-command-tooltip'
import { dispatchTimer } from '../../../infrastructure/cm6-performance'

import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import { FigureModal } from './figure-modal/figure-modal'
import useViewerPermissions from '@/shared/hooks/use-viewer-permissions'
import { ReviewPanelProviders } from '@/features/review-panel-new/context/review-panel-providers'
import { ReviewPanelMigration } from '@/features/source-editor/components/review-panel/review-panel-migration'

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

  const shouldShowReviewPanel = !useViewerPermissions()

  // create the view using the initial state and intercept transactions
  const viewRef = useRef<EditorView | null>(null)
  if (viewRef.current === null) {
    const timer = dispatchTimer()

    const view = new EditorView({
      state,
      dispatchTransactions: trs => {
        timer.start(trs)
        view.update(trs)
        if (isMounted.current) {
          setState(view.state)
        }
        timer.end(trs, view)
      },
    })
    viewRef.current = view
  }

  return (
    <CodeMirrorStateContext.Provider value={state}>
      <CodeMirrorViewContextProvider value={viewRef.current}>
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

          {shouldShowReviewPanel && <ReviewPanelMigration />}
          {sourceEditorComponents.map(
            ({ import: { default: Component }, path }) => (
              <Component key={path} />
            )
          )}
        </ReviewPanelProviders>
      </CodeMirrorViewContextProvider>
    </CodeMirrorStateContext.Provider>
  )
}

export default memo(CodeMirrorEditor)

const CodeMirrorStateContext = createContext<EditorState | undefined>(undefined)

export const useCodeMirrorStateContext = (): EditorState => {
  const context = useContext(CodeMirrorStateContext)

  if (!context) {
    throw new Error(
      'useCodeMirrorStateContext is only available inside CodeMirrorEditor'
    )
  }

  return context
}

const CodeMirrorViewContext = createContext<EditorView | undefined>(undefined)

export const CodeMirrorViewContextProvider = CodeMirrorViewContext.Provider

export const useCodeMirrorViewContext = (): EditorView => {
  const context = useContext(CodeMirrorViewContext)

  if (!context) {
    throw new Error(
      'useCodeMirrorViewContext is only available inside CodeMirrorViewContextProvider'
    )
  }

  return context
}
