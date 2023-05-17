import { EditorView, WidgetType } from '@codemirror/view'
import { placeSelectionInsideBlock } from '../selection'
import { isEqual } from 'lodash'
import { FigureData } from '../../figure-modal'

export class GraphicsWidget extends WidgetType {
  destroyed = false
  height = 300 // for estimatedHeight, updated when the image is loaded

  constructor(
    public filePath: string,
    public getPreviewByPath: (
      filePath: string
    ) => { url: string; extension: string } | null,
    public centered: boolean,
    public figureData: FigureData | null
  ) {
    super()
  }

  toDOM(view: EditorView): HTMLElement {
    this.destroyed = false

    // this is a block decoration, so it's outside the line decorations from the environment
    const element = document.createElement('div')
    element.classList.add('ol-cm-environment-figure')
    element.classList.add('ol-cm-environment-line')
    element.classList.toggle('ol-cm-environment-centered', this.centered)

    this.renderGraphic(element, view)

    element.addEventListener('mouseup', event => {
      event.preventDefault()
      view.dispatch(placeSelectionInsideBlock(view, event as MouseEvent))
    })

    return element
  }

  eq(widget: GraphicsWidget) {
    return (
      widget.filePath === this.filePath &&
      widget.centered === this.centered &&
      isEqual(this.figureData, widget.figureData)
    )
  }

  updateDOM(element: HTMLImageElement, view: EditorView) {
    this.destroyed = false
    element.classList.toggle('ol-cm-environment-centered', this.centered)
    if (
      this.filePath === element.dataset.filepath &&
      element.dataset.width === String(this.figureData?.width?.toString())
    ) {
      return true
    }
    this.renderGraphic(element, view)
    return true
  }

  ignoreEvent(event: Event) {
    return (
      event.type !== 'mouseup' &&
      // Pass events through to the edit button
      !(
        event.target instanceof HTMLElement &&
        event.target.closest('.ol-cm-graphics-edit-button')
      )
    )
  }

  destroy() {
    this.destroyed = true
  }

  get estimatedHeight(): number {
    return this.height
  }

  renderGraphic(element: HTMLElement, view: EditorView) {
    element.textContent = '' // ensure the element is empty

    const preview = this.getPreviewByPath(this.filePath)
    element.dataset.filepath = this.filePath
    element.dataset.width = this.figureData?.width?.toString()

    if (!preview) {
      const message = document.createElement('div')
      message.classList.add('ol-cm-graphics-error')
      message.classList.add('ol-cm-monospace')
      message.textContent = this.filePath
      element.append(message)
      return
    }

    switch (preview.extension) {
      case 'pdf':
        {
          const canvas = document.createElement('canvas')
          canvas.classList.add('ol-cm-graphics')
          this.renderPDF(view, canvas, preview.url).catch(error => {
            console.error(error)
          })
          element.append(canvas)
        }
        break

      default:
        element.append(this.createImage(view, preview.url))
        break
    }
  }

  getFigureWidth() {
    if (this.figureData?.width) {
      return `min(100%, ${this.figureData.width * 100}%)`
    }
    return ''
  }

  createImage(view: EditorView, url: string) {
    const image = document.createElement('img')
    image.classList.add('ol-cm-graphics')
    image.classList.add('ol-cm-graphics-loading')
    const width = this.getFigureWidth()
    image.style.width = width
    image.style.maxWidth = width

    image.src = url
    image.addEventListener('load', () => {
      image.classList.remove('ol-cm-graphics-loading')
      this.height = image.height // for estimatedHeight
      view.requestMeasure()
    })

    return image
  }

  async renderPDF(view: EditorView, canvas: HTMLCanvasElement, url: string) {
    const { PDFJS } = await this.importPDFJS()

    // bail out if loading PDF.js took too long
    if (this.destroyed) {
      return
    }

    const pdf = await PDFJS.getDocument(url).promise
    const page = await pdf.getPage(1)

    // bail out if loading the PDF took too long
    if (this.destroyed) {
      return
    }

    const viewport = page.getViewport({ scale: 1 })
    canvas.width = viewport.width
    canvas.height = viewport.height
    const width = this.getFigureWidth()
    canvas.style.width = width
    canvas.style.maxWidth = width
    page.render({
      canvasContext: canvas.getContext('2d'),
      viewport,
    })
    this.height = viewport.height
    view.requestMeasure()
  }

  async importPDFJS(): Promise<any> {
    return import('../../../../pdf-preview/util/pdf-js-versions').then(
      m => m.default
    )
  }
}
