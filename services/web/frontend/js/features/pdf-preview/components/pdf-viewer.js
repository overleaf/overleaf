import useScopeValue from '../../../shared/context/util/scope-value-hook'
import { usePdfPreviewContext } from '../contexts/pdf-preview-context'
import { lazy, memo, useEffect } from 'react'

const PdfJsViewer = lazy(() =>
  import(/* webpackChunkName: "pdf-js-viewer" */ './pdf-js-viewer')
)

const params = new URLSearchParams(window.location.search)

function PdfViewer() {
  const [pdfViewer, setPdfViewer] = useScopeValue('settings.pdfViewer')

  useEffect(() => {
    const viewer = params.get('viewer')

    if (viewer) {
      setPdfViewer(viewer)
    }
  }, [setPdfViewer])

  const { pdfUrl } = usePdfPreviewContext()

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
