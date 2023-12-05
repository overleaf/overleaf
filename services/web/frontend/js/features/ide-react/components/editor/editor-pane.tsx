import { Panel, PanelGroup } from 'react-resizable-panels'
import React, { FC, lazy, Suspense } from 'react'
import useScopeValue from '@/shared/hooks/use-scope-value'
import SourceEditor from '@/features/source-editor/components/source-editor'
import { EditorScopeValue } from '@/features/ide-react/context/editor-manager-context'
import classNames from 'classnames'
import { LoadingPane } from '@/features/ide-react/components/editor/loading-pane'
import { FullSizeLoadingSpinner } from '@/shared/components/loading-spinner'
import { VerticalResizeHandle } from '@/features/ide-react/components/resize/vertical-resize-handle'

const SymbolPalettePane = lazy(
  () => import('@/features/ide-react/components/editor/symbol-palette-pane')
)

export const EditorPane: FC<{ show: boolean }> = ({ show }) => {
  const [editor] = useScopeValue<EditorScopeValue>('editor')

  const isLoading = Boolean(
    (!editor.sharejs_doc || editor.opening) &&
      !editor.error_state &&
      editor.open_doc_id
  )

  return (
    <PanelGroup
      autoSaveId="ide-react-editor-and-symbol-palette-layout"
      direction="vertical"
      units="pixels"
      className={classNames({ hidden: !show })}
    >
      <Panel id="sourceEditor" order={1} className="ide-react-editor-panel">
        <SourceEditor />
        {isLoading && <LoadingPane />}
      </Panel>

      {editor.showSymbolPalette && (
        <>
          <VerticalResizeHandle id="editor-symbol-palette" />
          <Panel
            id="symbol-palette"
            order={2}
            defaultSize={250}
            minSize={250}
            maxSize={336}
          >
            <Suspense fallback={<FullSizeLoadingSpinner delay={500} />}>
              <SymbolPalettePane />
            </Suspense>
          </Panel>
        </>
      )}
    </PanelGroup>
  )
}
