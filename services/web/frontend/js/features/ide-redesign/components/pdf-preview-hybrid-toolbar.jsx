import { memo } from 'react'
import OlButtonToolbar from '@/features/ui/components/ol/ol-button-toolbar'
import PdfCompileButton from './pdf-compile-button'
import PdfHybridLogsButton from '@/features/pdf-preview/components/pdf-hybrid-logs-button'
import PdfHybridDownloadButton from '@/features/pdf-preview/components/pdf-hybrid-download-button'

function PdfPreviewHybridToolbar() {
  // TODO: add detached pdf logic
  return (
    <OlButtonToolbar className="toolbar toolbar-pdf toolbar-pdf-hybrid">
      <div className="toolbar-pdf-left">
        <PdfCompileButton />
        <PdfHybridLogsButton />
        <PdfHybridDownloadButton />
      </div>
      <div className="toolbar-pdf-right">
        <div className="toolbar-pdf-controls" id="toolbar-pdf-controls" />
        {/* TODO: should we have switch to editor/code check/synctex buttons? */}
      </div>
    </OlButtonToolbar>
  )
}

export default memo(PdfPreviewHybridToolbar)
