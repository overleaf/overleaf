import { lazy, memo } from 'react'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'

const PdfJsViewer = lazy(
  () => import(/* webpackChunkName: "pdf-js-viewer" */ './pdf-js-viewer')
)

function PdfViewer() {
  const { pdfUrl, pdfFile, pdfViewer } = useCompileContext()

  if (!pdfUrl) {
    return null
  }

  switch (pdfViewer) {
    case 'native':
      return <iframe title="PDF Preview" src={pdfUrl} />

    case 'pdfjs':
    default:
      return <PdfJsViewer url={pdfUrl} pdfFile={pdfFile} />
  }
}

export default memo(PdfViewer)
