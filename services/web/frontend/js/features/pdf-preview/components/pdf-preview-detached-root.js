import ReactDOM from 'react-dom'
import PdfPreview from './pdf-preview'
import { ContextRoot } from '../../../shared/context/root-context'

function PdfPreviewDetachedRoot() {
  return (
    <ContextRoot>
      <PdfPreview />
    </ContextRoot>
  )
}

export default PdfPreviewDetachedRoot // for testing

const element = document.getElementById('pdf-preview-detached-root')
if (element) {
  ReactDOM.render(<PdfPreviewDetachedRoot />, element)
}
