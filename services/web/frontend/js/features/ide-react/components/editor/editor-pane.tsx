import { Panel, PanelGroup } from 'react-resizable-panels'
import { VerticalResizeHandle } from '@/features/ide-react/components/resize/vertical-resize-handle'
import React, { ElementType } from 'react'
import useScopeValue from '@/shared/hooks/use-scope-value'
import SourceEditor from '@/features/source-editor/components/source-editor'
import { EditorScopeValue } from '@/features/ide-react/context/editor-manager-context'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'

const symbolPaletteComponents = importOverleafModules(
  'sourceEditorSymbolPalette'
) as { import: { default: ElementType }; path: string }[]

export type EditorPaneProps = {
  shouldPersistLayout?: boolean
  show: boolean
}

export function EditorPane({ shouldPersistLayout, show }: EditorPaneProps) {
  const { t } = useTranslation()
  const [editor] = useScopeValue<EditorScopeValue>('editor')

  return (
    <PanelGroup
      autoSaveId={
        shouldPersistLayout
          ? 'ide-react-editor-and-symbol-palette-layout'
          : undefined
      }
      direction="vertical"
      units="pixels"
      className={classNames({ hidden: !show })}
    >
      <Panel
        id="sourceEditor"
        order={1}
        style={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <SourceEditor />
        {(!editor.sharejs_doc || editor.opening) &&
        !editor.error_state &&
        !!editor.open_doc_id ? (
          <div className="loading-panel">
            <span>
              <i className="fa fa-spin fa-refresh" />
              &nbsp;&nbsp;{t('loading')}…
            </span>
          </div>
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
            <div className="ide-react-symbol-palette">
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
