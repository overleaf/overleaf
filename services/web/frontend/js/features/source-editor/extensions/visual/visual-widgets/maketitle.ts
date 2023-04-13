import { EditorState } from '@codemirror/state'
import { EditorView, WidgetType } from '@codemirror/view'
import { SyntaxNode } from '@lezer/common'
import { loadMathJax } from '../../../../mathjax/load-mathjax'
import { selectNode } from '../utils/select-node'
import { typesetNodeIntoElement } from '../utils/typeset-content'

type Preamble = {
  title?: {
    node: SyntaxNode
    content: string
  }
  author?: {
    node: SyntaxNode
    content: string
  }
}

export class MakeTitleWidget extends WidgetType {
  destroyed = false

  constructor(public preamble: Preamble) {
    super()
  }

  toDOM(view: EditorView) {
    this.destroyed = false
    const element = document.createElement('div')
    element.classList.add('ol-cm-maketitle')
    this.buildContent(view, element)
    return element
  }

  eq(widget: MakeTitleWidget) {
    return isShallowEqualPreamble(widget.preamble, this.preamble, [
      'title',
      'author',
    ])
  }

  // TODO: needs view
  // updateDOM(element: HTMLElement): boolean {
  //   this.destroyed = false
  //   this.buildContent(view, element)
  //   return true
  // }

  ignoreEvent(event: Event) {
    return event.type !== 'mouseup'
  }

  destroy() {
    this.destroyed = true
  }

  buildContent(view: EditorView, element: HTMLElement) {
    if (this.preamble.title) {
      const titleElement = buildTitleElement(
        view.state,
        this.preamble.title.node
      )
      titleElement.addEventListener('mouseup', () => {
        if (this.preamble.title) {
          selectNode(view, this.preamble.title.node)
        }
      })
      element.append(titleElement)

      // render equations
      loadMathJax()
        .then(async MathJax => {
          if (!this.destroyed) {
            await MathJax.typesetPromise([element])
            view.requestMeasure()
          }
        })
        .catch(() => {
          element.classList.add('ol-cm-error')
        })
    }

    if (this.preamble.author) {
      const authorsElement = buildAuthorsElement(
        view.state,
        this.preamble.author.node
      )
      authorsElement.addEventListener('mouseup', () => {
        if (this.preamble.author) {
          selectNode(view, this.preamble.author.node)
        }
      })
      element.append(authorsElement)
    }
  }
}

const isShallowEqualPreamble = (
  a: Preamble,
  b: Preamble,
  fields: Array<keyof Preamble>
) => fields.every(field => a[field]?.content === b[field]?.content)

function buildTitleElement(
  state: EditorState,
  argumentNode: SyntaxNode
): HTMLDivElement {
  const element = document.createElement('div')
  element.classList.add('ol-cm-title')
  typesetNodeIntoElement(argumentNode, element, state)
  return element
}

function buildAuthorsElement(
  state: EditorState,
  argumentNode: SyntaxNode
): HTMLDivElement {
  const element = document.createElement('div')
  element.classList.add('ol-cm-authors')

  const content = state.sliceDoc(argumentNode.from + 1, argumentNode.to - 1)
  const authors = content.replaceAll(/\s+/g, ' ').split('\\and')

  for (const authorParts of authors) {
    const authorElement = document.createElement('div')
    authorElement.classList.add('ol-cm-author')

    for (const authorInfoItem of authorParts.split('\\\\')) {
      const authorLineElement = document.createElement('div')
      authorLineElement.classList.add('ol-cm-author-line')
      authorLineElement.textContent = authorInfoItem.trim()
      authorElement.appendChild(authorLineElement)
    }

    element.append(authorElement)
  }

  return element
}
