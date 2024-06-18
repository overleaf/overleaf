// To add a new version, copy and adjust one of the `importPDFJS*` functions below,
// add the variant to the "switch" statement, and add to `pdfjsVersions` in webpack.config.js

import 'core-js/stable/global-this' // polyfill for globalThis (used by pdf.js)
import 'core-js/stable/promise/all-settled' // polyfill for Promise.allSettled (used by pdf.js)
import 'core-js/stable/structured-clone' // polyfill for global.StructuredClone (used by pdf.js)
import 'core-js/stable/array/at' // polyfill for Array.prototype.at (used by pdf.js)
import getMeta from '@/utils/meta'
import { createWorker } from '@/utils/worker'

async function importPDFJS401() {
  const cMapUrl = '/js/pdfjs-dist401/cmaps/'
  const standardFontDataUrl = '/fonts/pdfjs-dist401/'
  const imageResourcesPath = '/images/pdfjs-dist401/'

  // ensure that PDF.js is loaded before importing the viewer
  const PDFJS = await import('pdfjs-dist401/legacy/build/pdf')

  const [PDFJSViewer] = await Promise.all([
    import('pdfjs-dist401/legacy/web/pdf_viewer'),
    import('pdfjs-dist401/legacy/web/pdf_viewer.css'),
  ])

  createWorker(() => {
    PDFJS.GlobalWorkerOptions.workerPort = new Worker(
      new URL('pdfjs-dist401/legacy/build/pdf.worker.mjs', import.meta.url) // NOTE: .mjs extension
    )
  })

  return {
    PDFJS,
    PDFJSViewer,
    cMapUrl,
    imageResourcesPath,
    standardFontDataUrl,
  }
}

async function importPDFJS213() {
  const cMapUrl = '/js/pdfjs-dist213/cmaps/'
  const standardFontDataUrl = '/fonts/pdfjs-dist213/'
  const imageResourcesPath = '/images/pdfjs-dist213/'

  // ensure that PDF.js is loaded before importing the viewer
  const PDFJS = await import('pdfjs-dist213/legacy/build/pdf')

  const [PDFJSViewer] = await Promise.all([
    import('pdfjs-dist213/legacy/web/pdf_viewer'),
    import('pdfjs-dist213/legacy/web/pdf_viewer.css'),
  ])

  createWorker(() => {
    PDFJS.GlobalWorkerOptions.workerPort = new Worker(
      new URL('pdfjs-dist213/legacy/build/pdf.worker.js', import.meta.url)
    )
  })

  return {
    PDFJS,
    PDFJSViewer,
    cMapUrl,
    imageResourcesPath,
    standardFontDataUrl,
  }
}

async function importPDFJS() {
  const variant = getMeta('ol-pdfjsVariant') || 'default'

  // NOTE: split test variants must have at least 3 characters
  switch (variant) {
    case '213':
    case 'default':
      return importPDFJS213()

    case '401':
      return importPDFJS401()
  }
}

export default importPDFJS()
