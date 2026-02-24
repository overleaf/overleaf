import { EditorLoadingPane } from '@/features/ide-react/components/editor/editor-loading-pane'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { useFileTreeOpenContext } from '@/features/ide-react/context/file-tree-open-context'
import classNames from 'classnames'
import SourceEditor from '@/features/source-editor/components/source-editor'
import { Panel, PanelGroup } from 'react-resizable-panels'
import { VerticalResizeHandle } from '@/features/ide-react/components/resize/vertical-resize-handle'
import { Suspense } from 'react'
import { FullSizeLoadingSpinner } from '@/shared/components/loading-spinner'
import SymbolPalettePane from '@/features/ide-react/components/editor/symbol-palette-pane'
import { useEditorPropertiesContext } from '@/features/ide-react/context/editor-properties-context'

export const Editor = () => {
  const { opening, errorState, showSymbolPalette } =
    useEditorPropertiesContext()
  const { selectedEntityCount, openEntity } = useFileTreeOpenContext()
  const { currentDocumentId, currentDocument } = useEditorOpenDocContext()

  if (!currentDocumentId) {
    return null
  }

  const isLoading = Boolean(
    (!currentDocument || opening) && !errorState && currentDocumentId
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
          {isLoading && <EditorLoadingPane />}
        </Panel>
        {showSymbolPalette && (
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
