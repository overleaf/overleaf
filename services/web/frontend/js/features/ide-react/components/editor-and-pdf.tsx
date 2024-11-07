import React, { FC, useState } from 'react'
import { Panel, PanelGroup } from 'react-resizable-panels'
import NoSelectionPane from '@/features/ide-react/components/editor/no-selection-pane'
import FileView from '@/features/file-view/components/file-view'
import MultipleSelectionPane from '@/features/ide-react/components/editor/multiple-selection-pane'
import { HorizontalResizeHandle } from '@/features/ide-react/components/resize/horizontal-resize-handle'
import { HorizontalToggler } from '@/features/ide-react/components/resize/horizontal-toggler'
import { DefaultSynctexControl } from '@/features/pdf-preview/components/detach-synctex-control'
import PdfPreview from '@/features/pdf-preview/components/pdf-preview'
import { usePdfPane } from '@/features/ide-react/hooks/use-pdf-pane'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import { fileViewFile } from '@/features/ide-react/util/file-view'
import { useFileTreeOpenContext } from '@/features/ide-react/context/file-tree-open-context'
import { EditorPane } from '@/features/ide-react/components/editor/editor-pane'

export const EditorAndPdf: FC = () => {
  const [resizing, setResizing] = useState(false)

  const { t } = useTranslation()

  const {
    togglePdfPane,
    handlePdfPaneExpand,
    handlePdfPaneCollapse,
    setPdfIsOpen,
    pdfIsOpen,
    pdfPanelRef,
  } = usePdfPane()

  const { view, pdfLayout } = useLayoutContext()

  const { selectedEntityCount, openEntity } = useFileTreeOpenContext()

  const editorIsOpen =
    view === 'editor' || view === 'file' || pdfLayout === 'sideBySide'

  return (
    <PanelGroup
      autoSaveId="ide-editor-pdf-layout"
      direction="horizontal"
      className={classNames({
        'ide-panel-group-resizing': resizing,
        hidden: view === 'history',
      })}
    >
      {/* ide */}
      <Panel
        id="panel-ide"
        order={1}
        defaultSize={50}
        minSize={5}
        className={classNames('ide-react-panel', {
          'ide-panel-group-resizing': resizing,
          hidden: !editorIsOpen,
        })}
      >
        {selectedEntityCount === 0 && <NoSelectionPane />}
        {selectedEntityCount === 1 && openEntity?.type === 'fileRef' && (
          <FileView file={fileViewFile(openEntity.entity)} />
        )}
        {selectedEntityCount > 1 && (
          <MultipleSelectionPane selectedEntityCount={selectedEntityCount} />
        )}
        <EditorPane />
      </Panel>

      <HorizontalResizeHandle
        resizable={pdfLayout === 'sideBySide'}
        onDoubleClick={togglePdfPane}
        onDragging={setResizing}
        className={classNames({
          hidden: !editorIsOpen,
        })}
        hitAreaMargins={{ coarse: 0, fine: 0 }}
      >
        <HorizontalToggler
          id="editor-pdf"
          togglerType="east"
          isOpen={pdfIsOpen}
          setIsOpen={setPdfIsOpen}
          tooltipWhenOpen={t('tooltip_hide_pdf')}
          tooltipWhenClosed={t('tooltip_show_pdf')}
        />

        {pdfLayout === 'sideBySide' && (
          <div className="synctex-controls">
            <DefaultSynctexControl />
          </div>
        )}
      </HorizontalResizeHandle>

      {/* pdf */}
      <Panel
        ref={pdfPanelRef}
        id="panel-pdf"
        order={2}
        defaultSize={50}
        minSize={5}
        collapsible
        onCollapse={handlePdfPaneCollapse}
        onExpand={handlePdfPaneExpand}
        className="ide-react-panel"
      >
        <PdfPreview />
        {/* ensure that "sync to code" is available in PDF only layout */}
        {pdfLayout === 'flat' && view === 'pdf' && (
          <div className="synctex-controls" hidden>
            <DefaultSynctexControl />
          </div>
        )}
      </Panel>
    </PanelGroup>
  )
}
