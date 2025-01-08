import { EditorView, WidgetType } from '@codemirror/view'
import { SyntaxNode } from '@lezer/common'
import { loadMathJax } from '../../../../mathjax/load-mathjax'
import { selectNode } from '../utils/select-node'
import { typesetNodeIntoElement } from '../utils/typeset-content'

export type Frame = {
  title: {
    node: SyntaxNode
    content: string
  }
  subtitle?: {
    node: SyntaxNode
    content: string
  }
}

export class FrameWidget extends WidgetType {
  destroyed = false

  constructor(public frame: Frame) {
    super()
  }

  toDOM(view: EditorView): HTMLElement {
    this.destroyed = false
    const element = document.createElement('div')
    element.classList.add('ol-cm-frame-widget', 'ol-cm-divider')

    const title = document.createElement('div')
    title.classList.add('ol-cm-frame-title', 'ol-cm-heading')
    title.addEventListener('mouseup', () =>
      selectNode(view, this.frame.title.node)
    )
    typesetNodeIntoElement(this.frame.title.node, title, view.state)
    element.appendChild(title)

    if (this.frame.subtitle) {
      const subtitle = document.createElement('div')
      subtitle.classList.add('ol-cm-frame-subtitle', 'ol-cm-heading')
      typesetNodeIntoElement(this.frame.subtitle.node, subtitle, view.state)
      subtitle.addEventListener('mouseup', () =>
        selectNode(view, this.frame.subtitle!.node)
      )
      element.appendChild(subtitle)
    }

    // render equations
    loadMathJax()
      .then(async MathJax => {
        if (!this.destroyed) {
          await MathJax.typesetPromise([element])
          view.requestMeasure()
          MathJax.typesetClear([element])
        }
      })
      .catch(() => {
        element.classList.add('ol-cm-error')
      })

    return element
  }

  destroy() {
    this.destroyed = true
  }

  eq(other: FrameWidget): boolean {
    return (
      other.frame.title.content === this.frame.title.content &&
      other.frame.subtitle?.content === this.frame.subtitle?.content
    )
  }

  ignoreEvent(event: Event) {
    return event.type !== 'mouseup'
  }

  coordsAt(element: HTMLElement) {
    return element.getBoundingClientRect()
  }
}
