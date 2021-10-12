import { memo } from 'react'
import { ButtonToolbar } from 'react-bootstrap'
import PdfCompileButton from './pdf-compile-button'
import PdfExpandButton from './pdf-expand-button'
import PdfHybridLogsButton from './pdf-hybrid-logs-button'
import PdfHybridDownloadButton from './pdf-hybrid-download-button'
import PdfHybridCodeCheckButton from './pdf-hybrid-code-check-button'

function PdfPreviewHybridToolbar() {
  return (
    <ButtonToolbar className="toolbar toolbar-pdf toolbar-pdf-hybrid">
      <div className="toolbar-pdf-left">
        <PdfCompileButton />
        <PdfHybridLogsButton />
        <PdfHybridDownloadButton />
      </div>
      <div className="toolbar-pdf-right">
        <PdfHybridCodeCheckButton />
        <PdfExpandButton />
      </div>
    </ButtonToolbar>
  )
}

export default memo(PdfPreviewHybridToolbar)
