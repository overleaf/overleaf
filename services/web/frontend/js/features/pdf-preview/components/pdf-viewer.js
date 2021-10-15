import useScopeValue from '../../../shared/hooks/use-scope-value'
import { lazy, memo, useEffect } from 'react'
import { useCompileContext } from '../../../shared/context/compile-context'

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

  const { pdfUrl } = useCompileContext()

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
