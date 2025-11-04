import { captureException } from '@/infrastructure/error-reporter'
import { generatePdfCachingTransportFactory } from './pdf-caching-transport'
import { PDFJS, loadPdfDocumentFromUrl, imageResourcesPath } from './pdf-js'
import {
  PDFViewer,
  EventBus,
  PDFLinkService,
  LinkTarget,
} from 'pdfjs-dist/web/pdf_viewer.mjs'
import 'pdfjs-dist/web/pdf_viewer.css'
import browser from '@/features/source-editor/extensions/browser'
import { PDFFile } from '@ol-types/compile'

const DEFAULT_RANGE_CHUNK_SIZE = 128 * 1024 // 128K chunks

export default class PDFJSWrapper {
  public readonly viewer: PDFViewer
  public readonly eventBus: EventBus
  private readonly linkService: PDFLinkService
  private readonly pdfCachingTransportFactory: any
  private url?: string

  // eslint-disable-next-line no-useless-constructor
  constructor(public container: HTMLDivElement) {
    // create the event bus
    this.eventBus = new EventBus()

    // create the link service
    this.linkService = new PDFLinkService({
      eventBus: this.eventBus,
      externalLinkTarget: LinkTarget.BLANK,
      externalLinkRel: 'noopener',
    })

    // create the viewer
    this.viewer = new PDFViewer({
      container: this.container,
      eventBus: this.eventBus,
      imageResourcesPath,
      linkService: this.linkService,
      maxCanvasPixels: browser.safari ? 4096 * 4096 : 8192 * 8192, // default is 4096 * 4096, increased for better resolution at high zoom levels (but not in Safari, which struggles with large canvases)
      annotationMode: PDFJS.AnnotationMode.ENABLE, // enable annotations but not forms
      annotationEditorMode: PDFJS.AnnotationEditorType.DISABLE, // disable annotation editing
    })

    this.linkService.setViewer(this.viewer)

    this.pdfCachingTransportFactory = generatePdfCachingTransportFactory()
  }

  // load a document from a URL
  async loadDocument({
    url,
    pdfFile,
    abortController,
    handleFetchError,
  }: {
    url: string
    pdfFile: PDFFile
    abortController: AbortController
    handleFetchError: (error: any) => void
  }) {
    this.url = url

    const rangeTransport = this.pdfCachingTransportFactory({
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

    try {
      const doc = await loadPdfDocumentFromUrl(url, {
        rangeChunkSize,
        range: rangeTransport,
      }).promise

      // check that this is still the current URL
      if (url !== this.url) {
        return
      }

      this.viewer.setDocument(doc)
      this.linkService.setDocument(doc)

      return doc
    } catch (error: any) {
      if (
        !error ||
        !(error instanceof PDFJS.ResponseException && error.missing === true)
      ) {
        captureException(error, {
          tags: { handler: 'pdf-preview' },
        })
      }

      throw error
    }
  }

  async fetchAllData() {
    await this.viewer.pdfDocument?.getData()
  }

  // update the current scale value if the container size changes
  updateOnResize() {
    if (!this.isVisible()) {
      return
    }

    // Use requestAnimationFrame to prevent errors like "ResizeObserver loop
    // completed with undelivered notifications" that can occur if updating the
    // viewer causes another repaint. The cost of this is that the viewer update
    // lags one frame behind, but it's unlikely to matter.
    // Further reading: https://github.com/WICG/resize-observer/issues/38
    window.requestAnimationFrame(() => {
      const currentScaleValue = this.viewer.currentScaleValue

      if (
        currentScaleValue === 'auto' ||
        currentScaleValue === 'page-fit' ||
        currentScaleValue === 'page-height' ||
        currentScaleValue === 'page-width'
      ) {
        this.viewer.currentScaleValue = currentScaleValue
      }

      this.viewer.update()
    })
  }

  // get the page and offset of a click event
  clickPosition(event: MouseEvent, canvas: HTMLCanvasElement, page: number) {
    if (!canvas) {
      return
    }

    const { viewport } = this.viewer.getPageView(page)

    const pageRect = canvas.getBoundingClientRect()

    const dx = event.clientX - pageRect.left
    const dy = event.clientY - pageRect.top

    const [left, top] = viewport.convertToPdfPoint(dx, dy)

    return {
      page,
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

  scrollToPosition(position: Record<string, any>, scale = null) {
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
}
