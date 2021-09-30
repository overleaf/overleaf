import PdfPreviewProvider from '../contexts/pdf-preview-context'
import PdfPreviewPane from './pdf-preview-pane'
import { memo } from 'react'

function PdfPreview() {
  return (
    <PdfPreviewProvider>
      <PdfPreviewPane />
    </PdfPreviewProvider>
  )
}

export default memo(PdfPreview)
