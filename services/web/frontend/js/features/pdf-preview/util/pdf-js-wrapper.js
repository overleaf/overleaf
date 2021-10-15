// NOTE: using "legacy" build as main build requires webpack v5
// import PDFJS from 'pdfjs-dist/webpack'
import * as PDFJS from 'pdfjs-dist/legacy/build/pdf'
import * as PDFJSViewer from 'pdfjs-dist/legacy/web/pdf_viewer'
import PDFJSWorker from 'pdfjs-dist/legacy/build/pdf.worker'
import 'pdfjs-dist/legacy/web/pdf_viewer.css'
import getMeta from '../../../utils/meta'

if (typeof window !== 'undefined' && 'Worker' in window) {
  PDFJS.GlobalWorkerOptions.workerPort = new PDFJSWorker()
}

const params = new URLSearchParams(window.location.search)
const disableFontFace = params.get('disable-font-face') === 'true'
const cMapUrl = getMeta('ol-pdfCMapsPath')
const imageResourcesPath = getMeta('ol-pdfImageResourcesPath')

const rangeChunkSize = 128 * 1024 // 128K chunks

export default class PDFJSWrapper {
  constructor(container) {
    this.container = container

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
      container,
      eventBus,
      imageResourcesPath,
      linkService,
      // l10n, // commented out since it currently breaks `aria-label` rendering in pdf pages
      enableScripting: false, // default is false, but set explicitly to be sure
      enableXfa: false, // default is false (2021-10-12), but set explicitly to be sure
      renderInteractiveForms: false,
    })

    linkService.setViewer(viewer)

    this.eventBus = eventBus
    this.linkService = linkService
    this.viewer = viewer
  }

  // load a document from a URL
  loadDocument(url) {
    // prevents any previous loading task from populating the viewer
    this.loadDocumentTask = undefined

    return new Promise((resolve, reject) => {
      this.loadDocumentTask = PDFJS.getDocument({
        url,
        cMapUrl,
        cMapPacked: true,
        disableFontFace,
        rangeChunkSize,
        disableAutoFetch: true,
        disableStream: true,
        textLayerMode: 2, // PDFJSViewer.TextLayerMode.ENABLE,
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

    const pageRect = pageElement.querySelector('canvas').getBoundingClientRect()

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
    const [, , width, height] = pageView.viewport.viewBox
    const [, top] = pageView.viewport.convertToPdfPoint(0, dy)

    return {
      page: pageIndex,
      offset: { top, left: 0 },
      pageSize: { height, width },
    }
  }

  set currentPosition(position) {
    const destArray = [
      null,
      {
        name: 'XYZ', // 'XYZ' = scroll to the given coordinates
      },
      position.offset.left,
      position.offset.top,
      null,
    ]

    this.viewer.scrollPageIntoView({
      pageNumber: position.page + 1,
      destArray,
    })
  }

  abortDocumentLoading() {
    this.loadDocumentTask = undefined
  }

  destroy() {
    if (this.loadDocumentTask) {
      this.loadDocumentTask.destroy()
      this.loadDocumentTask = undefined
    }
    this.viewer.destroy()
  }
}
