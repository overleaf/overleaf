import { BeginWidget } from './begin'
import { EditorView } from '@codemirror/view'
import { SyntaxNode } from '@lezer/common'
import { typesetNodeIntoElement } from '../utils/typeset-content'
import { loadMathJax } from '../../../../mathjax/load-mathjax'

export class BeginTheoremWidget extends BeginWidget {
  constructor(
    public environment: string,
    public name: string,
    public argumentNode?: SyntaxNode | null
  ) {
    super(environment)
  }

  toDOM(view: EditorView) {
    const element = super.toDOM(view)
    element.classList.add('ol-cm-begin-theorem')
    return element
  }

  updateDOM(element: HTMLDivElement, view: EditorView) {
    super.updateDOM(element, view)
    element.classList.add('ol-cm-begin-theorem')
    return true
  }

  eq(widget: BeginTheoremWidget) {
    return (
      super.eq(widget) &&
      widget.name === this.name &&
      widget.argumentNode === this.argumentNode
    )
  }

  coordsAt(element: HTMLElement) {
    return element.getBoundingClientRect()
  }

  buildName(nameElement: HTMLSpanElement, view: EditorView) {
    nameElement.textContent = this.name
    if (this.argumentNode) {
      const suffixElement = document.createElement('span')
      typesetNodeIntoElement(this.argumentNode, suffixElement, view.state)
      nameElement.append(' (', suffixElement, ')')

      loadMathJax()
        .then(async MathJax => {
          if (!this.destroyed) {
            await MathJax.typesetPromise([nameElement])
            view.requestMeasure()
            MathJax.typesetClear([nameElement])
          }
        })
        .catch(() => {
          nameElement.classList.add('ol-cm-error')
        })
    }
  }
}
