import { Panel, PanelGroup } from 'react-resizable-panels'
import classNames from 'classnames'
import { HorizontalResizeHandle } from '@/features/ide-react/components/resize/horizontal-resize-handle'
import PdfPreview from '@/features/pdf-preview/components/pdf-preview'
import { Editor } from './editor'
import { RailLayout } from './rail'
import { Toolbar } from './toolbar/toolbar'
import { HorizontalToggler } from '@/features/ide-react/components/resize/horizontal-toggler'
import { useTranslation } from 'react-i18next'
import { usePdfPane } from '../hooks/use-pdf-pane'

export default function MainLayout() {
  const {
    isOpen: isPdfOpen,
    setIsOpen: setIsPdfOpen,
    panelRef: pdfPanelRef,
    handlePaneCollapse: handlePdfPaneCollapse,
    handlePaneExpand: handlePdfPaneExpand,
    togglePane: togglePdfPane,
  } = usePdfPane()
  const { t } = useTranslation()
  return (
    <div className="ide-redesign-main">
      <Toolbar />
      <div className="ide-redesign-body">
        <PanelGroup
          autoSaveId="ide-redesign-outer-layout"
          direction="horizontal"
          className={classNames('ide-redesign-inner', {
            'ide-panel-group-resizing': false,
          })}
        >
          <RailLayout />
          <Panel id="ide-redesign-editor-panel" order={2}>
            <div className="ide-redesign-editor-container">
              <Editor />
            </div>
          </Panel>
          <HorizontalResizeHandle
            resizable
            onDoubleClick={togglePdfPane}
            hitAreaMargins={{ coarse: 0, fine: 0 }}
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
