import { EditorView, WidgetType } from '@codemirror/view'
import { placeSelectionInsideBlock } from '../selection'
import { isEqual } from 'lodash'
import { FigureData } from '../../figure-modal'
import { debugConsole } from '@/utils/debugging'
import { PreviewPath } from '../../../../../../../types/preview-path'

export class GraphicsWidget extends WidgetType {
  destroyed = false
  height = 300 // for estimatedHeight, updated when the image is loaded

  constructor(
    public filePath: string,
    public previewByPath: (path: string) => PreviewPath | null,
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
    view.requestMeasure()
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

  coordsAt(element: HTMLElement) {
    return element.getBoundingClientRect()
  }

  get estimatedHeight(): number {
    return this.height
  }

  renderGraphic(element: HTMLElement, view: EditorView) {
    element.textContent = '' // ensure the element is empty

    const preview = this.previewByPath(this.filePath)
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
      case 'PDF':
        {
          const canvas = document.createElement('canvas')
          canvas.classList.add('ol-cm-graphics')
          this.renderPDF(view, canvas, preview.url).catch(debugConsole.error)
          element.append(canvas)
        }
        break

      case 'svg':
      case 'SVG':
        element.append(this.createSvgImage(view, preview.url))
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
    const wrapper = document.createElement('div')
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
    image.addEventListener('error', () => {
      const errorElement = this.createErrorElement(view)
      wrapper.replaceChildren(errorElement)
      this.height = wrapper.clientHeight
      view.requestMeasure()
    })

    wrapper.appendChild(image)
    return wrapper
  }

  /**
   * Creates an image element for SVG files by fetching the content and
   * creating a Blob URL with the correct MIME type. This is necessary because
   * the server serves blobs as application/octet-stream, which browsers won't
   * render as SVG.
   */
  createSvgImage(view: EditorView, url: string) {
    const wrapper = document.createElement('div')
    const image = document.createElement('img')
    image.classList.add('ol-cm-graphics')
    image.classList.add('ol-cm-graphics-loading')
    const width = this.getFigureWidth()
    image.style.width = width
    image.style.maxWidth = width

    // Fetch SVG and create a Blob URL with correct MIME type
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch SVG: ${response.status}`)
        }
        return response.text()
      })
      .then(svgText => {
        if (this.destroyed) {
          return
        }

        const blob = new Blob([svgText], { type: 'image/svg+xml' })
        const objectUrl = URL.createObjectURL(blob)

        const showError = () => {
          URL.revokeObjectURL(objectUrl)
          const errorElement = this.createErrorElement(view)
          wrapper.replaceChildren(errorElement)
          this.height = wrapper.clientHeight
          view.requestMeasure()
        }

        image.addEventListener(
          'load',
          () => {
            URL.revokeObjectURL(objectUrl)
            image.classList.remove('ol-cm-graphics-loading')
            this.height = image.height
            view.requestMeasure()
          },
          { once: true }
        )

        image.addEventListener('error', showError, { once: true })

        image.src = objectUrl
      })
      .catch(() => {
        if (this.destroyed) {
          return
        }

        const errorElement = this.createErrorElement(view)
        wrapper.replaceChildren(errorElement)
        this.height = wrapper.clientHeight
        view.requestMeasure()
      })

    wrapper.appendChild(image)
    return wrapper
  }

  createErrorElement(view: EditorView): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.classList.add('ol-cm-graphics-loading-error')
    const title = document.createElement('span')
    title.classList.add('ol-cm-graphics-loading-error-title')
    title.textContent = view.state.phrase(
      'the_visual_editor_cant_preview_this_type_of_image_file'
    )
    const subtitle = document.createElement('span')
    subtitle.classList.add('ol-cm-graphics-loading-error-subtitle')
    subtitle.textContent = view.state.phrase(
      'click_recompile_and_check_your_pdf_to_see_how_its_looking'
    )
    wrapper.appendChild(title)
    wrapper.appendChild(subtitle)
    return wrapper
  }

  async renderPDF(view: EditorView, canvas: HTMLCanvasElement, url: string) {
    const { loadPdfDocumentFromUrl } =
      await import('@/features/pdf-preview/util/pdf-js')

    // bail out if loading PDF.js took too long
    if (this.destroyed) {
      return
    }

    const pdf = await loadPdfDocumentFromUrl(url).promise
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
      canvasContext: canvas.getContext('2d')!,
      viewport,
    })
    this.height = viewport.height
    view.requestMeasure()
  }
}
