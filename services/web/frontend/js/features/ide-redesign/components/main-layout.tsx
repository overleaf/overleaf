import { Panel, PanelGroup } from 'react-resizable-panels'
import classNames from 'classnames'
import { HorizontalResizeHandle } from '@/features/ide-react/components/resize/horizontal-resize-handle'
import PdfPreview from '@/features/pdf-preview/components/pdf-preview'
import { Editor } from './editor'
import { RailLayout } from './rail'
import { Toolbar } from './toolbar/toolbar'

export default function MainLayout() {
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
          <HorizontalResizeHandle
            resizable
            hitAreaMargins={{ coarse: 0, fine: 0 }}
          />
          <Panel id="ide-redesign-editor-panel" order={2}>
            <div className="ide-redesign-editor-container">
              <Editor />
            </div>
          </Panel>
          <HorizontalResizeHandle
            resizable
            hitAreaMargins={{ coarse: 0, fine: 0 }}
          />
          <Panel
            className="ide-redesign-pdf-container"
            id="ide-redesign-pdf-panel"
            order={2}
          >
            <PdfPreview />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  )
}
