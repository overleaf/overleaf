import ReactDOM from 'react-dom'
import PdfPreview from './pdf-preview'
import useWaitForI18n from '../../../shared/hooks/use-wait-for-i18n'
import { ReactContextRoot } from '@/features/ide-react/context/react-context-root'

function PdfPreviewDetachedRoot() {
  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

  return (
    <ReactContextRoot>
      <PdfPreview />
    </ReactContextRoot>
  )
}

export default PdfPreviewDetachedRoot // for testing

const element = document.getElementById('pdf-preview-detached-root')
if (element) {
  ReactDOM.render(<PdfPreviewDetachedRoot />, element)
}
