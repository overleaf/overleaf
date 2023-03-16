import { captureException } from '../../../infrastructure/error-reporter'
import { generatePdfCachingTransportFactory } from './pdf-caching-transport'

const params = new URLSearchParams(window.location.search)
const disableFontFace = params.get('disable-font-face') === 'true'
const disableStream = process.env.NODE_ENV !== 'test'

const DEFAULT_RANGE_CHUNK_SIZE = 128 * 1024 // 128K chunks

export default class PDFJSWrapper {
  constructor(container) {
    this.container = container
  }

  async init() {
    const {
      PDFJS,
      PDFJSViewer,
      cMapUrl,
      imageResourcesPath,
      standardFontDataUrl,
    } = await import('./pdf-js-versions').then(m => {
      return m.default
    })

    this.PDFJS = PDFJS
    this.genPdfCachingTransport = generatePdfCachingTransportFactory(PDFJS)
    this.PDFJSViewer = PDFJSViewer
    this.cMapUrl = cMapUrl
    this.standardFontDataUrl = standardFontDataUrl
    this.imageResourcesPath = imageResourcesPath

    // create the event bus
    const eventBus = new PDFJSViewer.EventBus()

    // create the link service
    const linkService = new PDFJSViewer.PDFLinkService({
      eventBus,
      externalLinkTarget: 2,
      externalLinkRel: 'noopener',
    })

    // create the localization
    // const l10n = new PDFJSViewer.GenericL10n('en-GB') // TODO: locale mapping?

    // create the viewer
    const viewer = new PDFJSViewer.PDFViewer({
      container: this.container,
      eventBus,
      imageResourcesPath,
      linkService,
      // l10n, // commented out since it currently breaks `aria-label` rendering in pdf pages
      enableScripting: false, // default is false, but set explicitly to be sure
      enableXfa: false, // default is false (2021-10-12), but set explicitly to be sure
      renderInteractiveForms: false,
      maxCanvasPixels: 8192 * 8192, // default is 4096 * 4096, increased for better resolution at high zoom levels
      annotationMode: PDFJS.AnnotationMode?.ENABLE, // enable annotations but not forms
      annotationEditorMode: PDFJS.AnnotationEditorType?.DISABLE, // disable annotation editing
    })

    linkService.setViewer(viewer)

    this.eventBus = eventBus
    this.linkService = linkService
    this.viewer = viewer
  }

  // load a document from a URL
  loadDocument({ url, pdfFile, abortController, handleFetchError }) {
    // cancel any previous loading task
    if (this.loadDocumentTask) {
      this.loadDocumentTask.destroy()
      this.loadDocumentTask = undefined
    }

    return new Promise((resolve, reject) => {
      const rangeTransport = this.genPdfCachingTransport({
        url,
        pdfFile,
        abortController,
        handleFetchError,
      })
      let rangeChunkSize = DEFAULT_RANGE_CHUNK_SIZE
      if (rangeTransport && pdfFile.size < 2 * DEFAULT_RANGE_CHUNK_SIZE) {
        // pdf.js disables the "bulk" download optimization when providing a
        //  custom range transport. Restore it by bumping the chunk size.
        rangeChunkSize = pdfFile.size
      }
      this.loadDocumentTask = this.PDFJS.getDocument({
        url,
        cMapUrl: this.cMapUrl,
        cMapPacked: true,
        standardFontDataUrl: this.standardFontDataUrl,
        disableFontFace,
        rangeChunkSize,
        disableAutoFetch: true,
        disableStream,
        textLayerMode: 2, // PDFJSViewer.TextLayerMode.ENABLE,
        range: rangeTransport,
      })

      this.loadDocumentTask.promise
        .then(doc => {
          if (!this.loadDocumentTask) {
            return // ignoring the response since loading task has been aborted
          }

          const previousDoc = this.viewer.pdfDocument

          this.viewer.setDocument(doc)
          this.linkService.setDocument(doc)
          resolve(doc)

          if (previousDoc) {
            previousDoc.cleanup().catch(console.error)
            previousDoc.destroy()
          }
        })
        .catch(error => {
          if (this.loadDocumentTask) {
            if (!error || error.name !== 'MissingPDFException') {
              captureException(error, {
                tags: { handler: 'pdf-preview' },
              })
            }

            reject(error)
          }
        })
        .finally(() => {
          this.loadDocumentTask = undefined
        })
    })
  }

  // update the current scale value if the container size changes
  updateOnResize() {
    if (!this.isVisible()) {
      return
    }

    const currentScaleValue = this.viewer.currentScaleValue

    if (
      currentScaleValue === 'auto' ||
      currentScaleValue === 'page-fit' ||
      currentScaleValue === 'page-width'
    ) {
      this.viewer.currentScaleValue = currentScaleValue
    }

    this.viewer.update()
  }

  // get the page and offset of a click event
  clickPosition(event, pageElement, textLayer) {
    const { viewport } = this.viewer.getPageView(textLayer.pageNumber - 1)

    const pageCanvas = pageElement.querySelector('canvas')

    if (!pageCanvas) {
      return
    }

    const pageRect = pageCanvas.getBoundingClientRect()

    const dx = event.clientX - pageRect.left
    const dy = event.clientY - pageRect.top

    const [left, top] = viewport.convertToPdfPoint(dx, dy)

    return {
      page: textLayer.pageNumber - 1,
      offset: {
        left,
        top: viewport.viewBox[3] - top,
      },
    }
  }

  // get the current page, offset and page size
  get currentPosition() {
    const pageIndex = this.viewer.currentPageNumber - 1
    const pageView = this.viewer.getPageView(pageIndex)
    const pageRect = pageView.div.getBoundingClientRect()

    const containerRect = this.container.getBoundingClientRect()
    const dy = containerRect.top - pageRect.top
    const dx = containerRect.left - pageRect.left
    const [left, top] = pageView.viewport.convertToPdfPoint(dx, dy)
    const [, , width, height] = pageView.viewport.viewBox

    return {
      page: pageIndex,
      offset: { top, left },
      pageSize: { height, width },
    }
  }

  scrollToPosition(position, scale = null) {
    const destArray = [
      null,
      {
        name: 'XYZ', // 'XYZ' = scroll to the given coordinates
      },
      position.offset.left,
      position.offset.top,
      scale,
    ]

    this.viewer.scrollPageIntoView({
      pageNumber: position.page + 1,
      destArray,
    })

    // scroll the page left and down by an extra few pixels to account for the pdf.js viewer page border
    const pageIndex = this.viewer.currentPageNumber - 1
    const pageView = this.viewer.getPageView(pageIndex)
    const offset = parseFloat(getComputedStyle(pageView.div).borderWidth)
    this.viewer.container.scrollBy({
      top: -offset,
      left: -offset,
    })
  }

  isVisible() {
    return this.viewer.container.offsetParent !== null
  }

  abortDocumentLoading() {
    this.loadDocumentTask = undefined
  }

  destroy() {
    if (this.loadDocumentTask) {
      this.loadDocumentTask.destroy()
      this.loadDocumentTask = undefined
    }
    if (this.viewer) {
      this.viewer.destroy()
    }
  }
}
