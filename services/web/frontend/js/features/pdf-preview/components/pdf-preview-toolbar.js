import PdfCompileButton from './pdf-compile-button'
import PdfDownloadButton from './pdf-download-button'
import PdfLogsButton from './pdf-logs-button'
import PdfExpandButton from './pdf-expand-button'
import { ButtonToolbar } from 'react-bootstrap'
import { memo, useState } from 'react'
import useToolbarBreakpoint from '../hooks/use-toolbar-breakpoint'

const isPreview = new URLSearchParams(window.location.search).get('preview')

function PdfPreviewToolbar() {
  const [element, setElement] = useState()

  const toolbarClasses = useToolbarBreakpoint(element)

  return (
    <div ref={element => setElement(element)}>
      <ButtonToolbar className={toolbarClasses}>
        <div className="toolbar-pdf-left">
          <PdfCompileButton />
          <PdfDownloadButton />
        </div>
        <div className="toolbar-pdf-right">
          <PdfLogsButton />
          {!isPreview && <PdfExpandButton />}
        </div>
      </ButtonToolbar>
    </div>
  )
}

export default memo(PdfPreviewToolbar)
