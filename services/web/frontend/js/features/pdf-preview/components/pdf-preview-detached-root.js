import ReactDOM from 'react-dom'
import PdfPreview from './pdf-preview'
import { ContextRoot } from '../../../shared/context/root-context'
import useWaitForI18n from '../../../shared/hooks/use-wait-for-i18n'
import { Shortcuts } from './shortcuts'
import PdfPreviewDetachedRootSafariWarning from './pdf-preview-detached-root-safari-warning'

function PdfPreviewDetachedRoot() {
  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

  return (
    <ContextRoot>
      <Shortcuts>
        <PdfPreviewDetachedRootSafariWarning />
        <PdfPreview />
      </Shortcuts>
    </ContextRoot>
  )
}

export default PdfPreviewDetachedRoot // for testing

const element = document.getElementById('pdf-preview-detached-root')
if (element) {
  ReactDOM.render(<PdfPreviewDetachedRoot />, element)
}
