import { Panel, PanelGroup } from 'react-resizable-panels'
import classNames from 'classnames'
import { HorizontalResizeHandle } from '@/features/ide-react/components/resize/horizontal-resize-handle'
import PdfPreview from '@/features/pdf-preview/components/pdf-preview'
import { RailLayout } from './rail'
import { Toolbar } from './toolbar/toolbar'
import { HorizontalToggler } from '@/features/ide-react/components/resize/horizontal-toggler'
import { useTranslation } from 'react-i18next'
import { usePdfPane } from '@/features/ide-react/hooks/use-pdf-pane'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useState } from 'react'
import EditorPanel from './editor-panel'
import { useRailContext } from '../contexts/rail-context'
import HistoryContainer from '@/features/ide-react/components/history-container'

export default function MainLayout() {
  const [resizing, setResizing] = useState(false)
  const { resizing: railResizing } = useRailContext()
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
            'ide-panel-group-resizing': resizing || railResizing,
          })}
        >
          <RailLayout />
          <Panel id="ide-redesign-editor-and-pdf-panel" order={2}>
            <HistoryContainer />
            <PanelGroup
              autoSaveId="ide-redesign-editor-and-pdf-panel-group"
              direction="horizontal"
            >
              <Panel
                id="ide-redesign-editor-panel"
                order={1}
                className={classNames({
                  hidden: !editorIsOpen || view === 'history',
                })}
                minSize={5}
                defaultSize={50}
              >
                <div className="ide-redesign-editor-container">
                  <EditorPanel />
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
                className={classNames('ide-redesign-pdf-container', {
                  hidden: view === 'history',
                })}
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
          </Panel>
        </PanelGroup>
      </div>
    </div>
  )
}
