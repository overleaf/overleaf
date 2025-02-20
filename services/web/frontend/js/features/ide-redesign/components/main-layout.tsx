import { Panel, PanelGroup } from 'react-resizable-panels'
import classNames from 'classnames'
import { HorizontalResizeHandle } from '@/features/ide-react/components/resize/horizontal-resize-handle'
import PdfPreview from '@/features/pdf-preview/components/pdf-preview'
import { Editor } from './editor'
import { RailLayout } from './rail'
import { Toolbar } from './toolbar/toolbar'
import { HorizontalToggler } from '@/features/ide-react/components/resize/horizontal-toggler'
import { useTranslation } from 'react-i18next'
import { usePdfPane } from '@/features/ide-react/hooks/use-pdf-pane'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useState } from 'react'

export default function MainLayout() {
  const [resizing, setResizing] = useState(false)
  const {
    togglePdfPane,
    handlePdfPaneExpand,
    handlePdfPaneCollapse,
    setPdfIsOpen: setIsPdfOpen,
    pdfIsOpen: isPdfOpen,
    pdfPanelRef,
  } = usePdfPane()

  const { view, pdfLayout } = useLayoutContext()

  const editorIsOpen =
    view === 'editor' || view === 'file' || pdfLayout === 'sideBySide'

  const { t } = useTranslation()
  return (
    <div className="ide-redesign-main">
      <Toolbar />
      <div className="ide-redesign-body">
        <PanelGroup
          autoSaveId="ide-redesign-outer-layout"
          direction="horizontal"
          className={classNames('ide-redesign-inner', {
            'ide-panel-group-resizing': resizing,
          })}
        >
          <RailLayout />
          <Panel
            id="ide-redesign-editor-panel"
            order={1}
            className={classNames({
              'ide-panel-group-resizing': resizing,
              hidden: !editorIsOpen,
            })}
            minSize={5}
            defaultSize={50}
          >
            <div className="ide-redesign-editor-container">
              <Editor />
            </div>
          </Panel>
          <HorizontalResizeHandle
            resizable={pdfLayout === 'sideBySide'}
            onDragging={setResizing}
            onDoubleClick={togglePdfPane}
            hitAreaMargins={{ coarse: 0, fine: 0 }}
            className={classNames({
              hidden: !editorIsOpen,
            })}
          >
            <HorizontalToggler
              id="ide-redesign-pdf-panel"
              togglerType="east"
              isOpen={isPdfOpen}
              setIsOpen={setIsPdfOpen}
              tooltipWhenOpen={t('tooltip_hide_pdf')}
              tooltipWhenClosed={t('tooltip_show_pdf')}
            />
          </HorizontalResizeHandle>
          <Panel
            collapsible
            className="ide-redesign-pdf-container"
            id="ide-redesign-pdf-panel"
            order={2}
            defaultSize={50}
            minSize={5}
            ref={pdfPanelRef}
            onExpand={handlePdfPaneExpand}
            onCollapse={handlePdfPaneCollapse}
          >
            <PdfPreview />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  )
}
