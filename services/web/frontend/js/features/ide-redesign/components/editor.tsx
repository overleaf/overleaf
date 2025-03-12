import { LoadingPane } from '@/features/ide-react/components/editor/loading-pane'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { EditorScopeValue } from '@/features/ide-react/scope-adapters/editor-manager-context-adapter'
import { useFileTreeOpenContext } from '@/features/ide-react/context/file-tree-open-context'
import useScopeValue from '@/shared/hooks/use-scope-value'
import classNames from 'classnames'
import SourceEditor from '@/features/source-editor/components/source-editor'
import { Panel, PanelGroup } from 'react-resizable-panels'
import { VerticalResizeHandle } from '@/features/ide-react/components/resize/vertical-resize-handle'
import { Suspense } from 'react'
import { FullSizeLoadingSpinner } from '@/shared/components/loading-spinner'
import SymbolPalettePane from '@/features/ide-react/components/editor/symbol-palette-pane'

export const Editor = () => {
  const [editor] = useScopeValue<EditorScopeValue>('editor')
  const { selectedEntityCount, openEntity } = useFileTreeOpenContext()
  const { currentDocumentId } = useEditorManagerContext()

  if (!currentDocumentId) {
    return null
  }

  const isLoading = Boolean(
    (!editor.sharejs_doc || editor.opening) &&
      !editor.error_state &&
      editor.open_doc_id
  )

  return (
    <div
      className={classNames('ide-redesign-editor-content', {
        hidden: openEntity?.type !== 'doc' || selectedEntityCount !== 1,
      })}
    >
      <PanelGroup
        autoSaveId="ide-redesign-editor-symbol-palette"
        direction="vertical"
      >
        <Panel
          id="ide-redesign-panel-source-editor"
          order={1}
          className="ide-redesign-editor-panel"
        >
          <SourceEditor />
          {isLoading && <LoadingPane />}
        </Panel>
        {editor.showSymbolPalette && (
          <>
            <VerticalResizeHandle id="ide-redesign-editor-symbol-palette" />
            <Panel
              id="ide-redesign-panel-symbol-palette"
              order={2}
              defaultSize={25}
              minSize={10}
              maxSize={50}
            >
              <Suspense fallback={<FullSizeLoadingSpinner delay={500} />}>
                <SymbolPalettePane />
              </Suspense>
            </Panel>
          </>
        )}
      </PanelGroup>
    </div>
  )
}
