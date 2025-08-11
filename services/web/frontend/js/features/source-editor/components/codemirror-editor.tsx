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
import { ReviewPanelProviders } from '@/features/review-panel/context/review-panel-providers'
import { ReviewPanelRoot } from '@/features/review-panel/components/review-panel-root'
import ReviewTooltipMenu from '@/features/review-panel/components/review-tooltip-menu'
import {
  CodeMirrorStateContext,
  CodeMirrorViewContext,
} from './codemirror-context'
import MathPreviewTooltip from './math-preview-tooltip'
import { useToolbarMenuBarEditorCommands } from '@/features/ide-redesign/hooks/use-toolbar-menu-editor-commands'
import { useProjectContext } from '@/shared/context/project-context'

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
        <CodeMirrorEditorComponents />
      </CodeMirrorViewContext.Provider>
    </CodeMirrorStateContext.Provider>
  )
}

function CodeMirrorEditorComponents() {
  useToolbarMenuBarEditorCommands()
  const { features } = useProjectContext()

  return (
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
      {features.trackChangesVisible && <ReviewTooltipMenu />}
      {features.trackChangesVisible && <ReviewPanelRoot />}

      {sourceEditorComponents.map(
        ({ import: { default: Component }, path }) => (
          <Component key={path} />
        )
      )}
    </ReviewPanelProviders>
  )
}

export default memo(CodeMirrorEditor)
