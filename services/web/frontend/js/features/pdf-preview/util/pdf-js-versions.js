// NOTE: using "legacy" build as main build requires webpack v5
// import PDFJS from 'pdfjs-dist/webpack'

// To add a new version, copy and adjust one of the `importPDFJS*` functions below,
// add the variant to the "switch" statement, and add to `pdfjsVersions` in webpack.config.js

import 'core-js/features/promise/all-settled' // polyfill for Promise.allSettled (used by pdf.js)
import getMeta from '../../../utils/meta'

async function importPDFJS210() {
  const cMapUrl = '/js/pdfjs-dist210/cmaps/'
  const imageResourcesPath = '/images/pdfjs-dist210'

  const [PDFJS, PDFJSViewer, { default: PDFJSWorker }] = await Promise.all([
    import('pdfjs-dist210/legacy/build/pdf'),
    import('pdfjs-dist210/legacy/web/pdf_viewer'),
    import('pdfjs-dist210/legacy/build/pdf.worker'),
    import('pdfjs-dist210/legacy/web/pdf_viewer.css'),
  ])

  if (typeof window !== 'undefined' && 'Worker' in window) {
    PDFJS.GlobalWorkerOptions.workerPort = new PDFJSWorker()
  }

  return { PDFJS, PDFJSViewer, PDFJSWorker, cMapUrl, imageResourcesPath }
}

async function importPDFJS213() {
  const cMapUrl = '/js/pdfjs-dist213/cmaps/'
  const imageResourcesPath = '/images/pdfjs-dist213'

  const [PDFJS, PDFJSViewer, { default: PDFJSWorker }] = await Promise.all([
    import('pdfjs-dist213/legacy/build/pdf'),
    import('pdfjs-dist213/legacy/web/pdf_viewer'),
    import('pdfjs-dist213/legacy/build/pdf.worker'),
    import('pdfjs-dist213/legacy/web/pdf_viewer.css'),
  ])

  if (typeof window !== 'undefined' && 'Worker' in window) {
    PDFJS.GlobalWorkerOptions.workerPort = new PDFJSWorker()
  }

  return { PDFJS, PDFJSViewer, PDFJSWorker, cMapUrl, imageResourcesPath }
}

async function importPDFJS() {
  const variant = getMeta('ol-pdfjsVariant', 'default')

  switch (variant) {
    case '213':
      return importPDFJS213()

    case '210':
    case 'default':
    default:
      return importPDFJS210()
  }
}

export default importPDFJS()
