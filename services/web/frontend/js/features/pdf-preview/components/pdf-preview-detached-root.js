import ReactDOM from 'react-dom'
import PdfPreview from './pdf-preview'
import { ContextRoot } from '../../../shared/context/root-context'
import useWaitForI18n from '../../../shared/hooks/use-wait-for-i18n'

function PdfPreviewDetachedRoot() {
  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

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
