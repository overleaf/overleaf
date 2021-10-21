import { lazy, memo } from 'react'
import { useCompileContext } from '../../../shared/context/compile-context'

const PdfJsViewer = lazy(() =>
  import(/* webpackChunkName: "pdf-js-viewer" */ './pdf-js-viewer')
)

function PdfViewer() {
  const { pdfUrl, pdfViewer } = useCompileContext()

  if (!pdfUrl) {
    return null
  }

  switch (pdfViewer) {
    case 'native':
      return <iframe title="PDF Preview" src={pdfUrl} />

    case 'pdfjs':
    default:
      return <PdfJsViewer url={pdfUrl} />
  }
}

export default memo(PdfViewer)
