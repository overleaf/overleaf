import { Panel, PanelGroup } from 'react-resizable-panels'
import { VerticalResizeHandle } from '@/features/ide-react/components/resize/vertical-resize-handle'
import React, { ElementType, useEffect } from 'react'
import useScopeValue from '@/shared/hooks/use-scope-value'
import SourceEditor from '@/features/source-editor/components/source-editor'
import {
  EditorScopeValue,
  useEditorManagerContext,
} from '@/features/ide-react/context/editor-manager-context'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import { EditorProps } from '@/features/ide-react/components/editor/editor'

const symbolPaletteComponents = importOverleafModules(
  'sourceEditorSymbolPalette'
) as { import: { default: ElementType }; path: string }[]

export function EditorPane({
  shouldPersistLayout,
  openDocId,
  fileTreeReady,
}: EditorProps) {
  const { openDocId: openDocWithId } = useEditorManagerContext()

  const [editor] = useScopeValue<EditorScopeValue>('editor')

  useEffect(() => {
    if (!fileTreeReady || !openDocId) {
      return
    }
    openDocWithId(openDocId)
  }, [fileTreeReady, openDocId, openDocWithId])

  return (
    <PanelGroup
      autoSaveId={
        shouldPersistLayout
          ? 'ide-react-editor-and-symbol-palette-layout'
          : undefined
      }
      direction="vertical"
      units="pixels"
    >
      <Panel
        id="editor"
        order={1}
        style={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {!!editor.sharejs_doc &&
        !editor.opening &&
        editor.multiSelectedCount === 0 &&
        !editor.error_state ? (
          <SourceEditor />
        ) : null}
      </Panel>
      {editor.showSymbolPalette ? (
        <>
          <VerticalResizeHandle id="editor-symbol-palette" />
          <Panel
            id="symbol-palette"
            order={2}
            defaultSize={250}
            minSize={250}
            maxSize={336}
          >
            <div className="ide-react-placeholder-symbol-palette">
              {symbolPaletteComponents.map(
                ({ import: { default: Component }, path }) => (
                  <Component key={path} />
                )
              )}
            </div>
          </Panel>
        </>
      ) : null}
    </PanelGroup>
  )
}
