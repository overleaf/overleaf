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
import { getVisualEditorComponent } from '../utils/visual-editor'
import EditorContextMenu from './editor-context-menu'
import { useToolbarMenuBarEditorCommands } from '@/features/ide-redesign/hooks/use-toolbar-menu-editor-commands'
import { useProjectContext } from '@/shared/context/project-context'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { useEditorPropertiesContext } from '@/features/ide-react/context/editor-properties-context'

// TODO: remove this when definitely no longer used
export * from './codemirror-context'

const sourceEditorComponents = importOverleafModules(
  'sourceEditorComponents'
) as { import: { default: ElementType }; path: string }[]

function CodeMirrorEditor() {
  // create the initial state
  const [state, setState] = useState(() => {
    return EditorState.create()
  })

  const isMounted = useIsMounted()
  const editContextEnabled = useFeatureFlag('edit-context')
  const { openDocName } = useEditorOpenDocContext()
  const { showVisual } = useEditorPropertiesContext()

  const VisualEditor =
    showVisual && openDocName != null
      ? getVisualEditorComponent(openDocName)
      : null

  // create the view using the initial state and intercept transactions
  const viewRef = useRef<EditorView | null>(null)
  if (viewRef.current === null) {
    if (!editContextEnabled) {
      // @ts-expect-error (disable EditContext-based editing until stable)
      EditorView.EDIT_CONTEXT = false
    }

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
        <CodeMirrorEditorComponents hidden={VisualEditor != null} />
        {VisualEditor && <VisualEditor />}
      </CodeMirrorViewContext.Provider>
    </CodeMirrorStateContext.Provider>
  )
}

type CodeMirrorEditorComponentsProps = {
  hidden: boolean
}

function CodeMirrorEditorComponents({
  hidden = false,
}: CodeMirrorEditorComponentsProps) {
  useToolbarMenuBarEditorCommands()
  const { features } = useProjectContext()
  return (
    <ReviewPanelProviders>
      <CodemirrorOutline />
      <CodeMirrorView hidden={hidden} />
      <FigureModal />
      <CodeMirrorSearch />
      <CodeMirrorToolbar />
      <CodeMirrorCommandTooltip />

      <MathPreviewTooltip />
      <EditorContextMenu />
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
