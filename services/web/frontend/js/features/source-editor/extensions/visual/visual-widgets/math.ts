import { EditorView, WidgetType } from '@codemirror/view'
import { loadMathJax } from '@/features/mathjax/load-mathjax'
import { placeSelectionInsideBlock } from '../selection'

export class MathWidget extends WidgetType {
  destroyed = false

  constructor(
    public math: string,
    public displayMode: boolean,
    public preamble?: string
  ) {
    super()
  }

  toDOM(view: EditorView) {
    this.destroyed = false
    const element = document.createElement(this.displayMode ? 'div' : 'span')
    element.classList.add('ol-cm-math')
    element.style.height = this.estimatedHeight + 'px'
    if (this.displayMode) {
      element.addEventListener('mouseup', event => {
        event.preventDefault()
        view.dispatch(placeSelectionInsideBlock(view, event as MouseEvent))
      })
    }
    this.renderMath(element)
      .catch(() => {
        element.classList.add('ol-cm-math-error')
      })
      .finally(() => {
        view.requestMeasure()
      })

    return element
  }

  eq(widget: MathWidget) {
    return (
      widget.math === this.math &&
      widget.displayMode === this.displayMode &&
      widget.preamble === this.preamble
    )
  }

  updateDOM(element: HTMLElement, view: EditorView) {
    this.destroyed = false
    this.renderMath(element)
      .catch(() => {
        element.classList.add('ol-cm-math-error')
      })
      .finally(() => {
        view.requestMeasure()
      })

    return true
  }

  ignoreEvent(event: Event) {
    // always enable mouseup to release the decorations
    if (event.type === 'mouseup') {
      return false
    }

    // inline math needs mousedown to set the selection
    if (!this.displayMode && event.type === 'mousedown') {
      return false
    }

    // ignore other events
    return true
  }

  destroy() {
    this.destroyed = true
  }

  get estimatedHeight() {
    return this.math.split('\n').length * 40
  }

  coordsAt(element: HTMLElement) {
    return element.getBoundingClientRect()
  }

  async renderMath(element: HTMLElement) {
    const MathJax = await loadMathJax()

    // abandon if the widget has been destroyed
    if (this.destroyed) {
      return
    }

    MathJax.texReset([0]) // equation numbering is disabled, but this is still needed
    if (this.preamble) {
      try {
        await MathJax.tex2svgPromise(this.preamble)
      } catch {
        // ignore errors thrown during parsing command definitions
      }
    }

    // abandon if the element has been removed from the DOM
    if (!element.isConnected) {
      return
    }

    const math = await MathJax.tex2svgPromise(this.math, {
      ...MathJax.getMetricsFor(element, this.displayMode),
      display: this.displayMode,
    })
    element.replaceChildren(math)
    element.style.height = 'auto'
  }
}
