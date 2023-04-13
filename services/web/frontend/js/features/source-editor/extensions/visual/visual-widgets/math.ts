import { EditorView, WidgetType } from '@codemirror/view'
import { loadMathJax } from '../../../../mathjax/load-mathjax'
import { placeSelectionInsideBlock } from '../selection'

export class MathWidget extends WidgetType {
  destroyed = false

  constructor(public math: string, public displayMode: boolean) {
    super()
  }

  toDOM(view: EditorView) {
    this.destroyed = false
    const element = document.createElement(this.displayMode ? 'div' : 'span')
    element.classList.add('ol-cm-math')
    if (this.displayMode) {
      element.addEventListener('mouseup', event => {
        event.preventDefault()
        view.dispatch(placeSelectionInsideBlock(view, event as MouseEvent))
      })
    }
    this.renderMath(element).catch(() => {
      element.classList.add('ol-cm-math-error')
    })
    return element
  }

  eq(widget: MathWidget) {
    return widget.math === this.math && widget.displayMode === this.displayMode
  }

  updateDOM(element: HTMLElement) {
    this.destroyed = false
    this.renderMath(element).catch(() => {
      element.classList.add('ol-cm-math-error')
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

  async renderMath(element: HTMLElement) {
    const MathJax = await loadMathJax()

    if (!this.destroyed) {
      MathJax.texReset([0]) // equation numbering is disabled, but this is still needed
      const math = await MathJax.tex2svgPromise(this.math, {
        ...MathJax.getMetricsFor(element),
        display: this.displayMode,
      })
      element.textContent = ''
      element.append(math)
    }
  }
}
