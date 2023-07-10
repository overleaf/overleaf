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
  authors: {
    node: SyntaxNode
    content: string
  }[]
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
    return isShallowEqualPreamble(widget.preamble, this.preamble)
  }

  updateDOM(element: HTMLElement, view: EditorView): boolean {
    this.destroyed = false
    element.textContent = ''
    this.buildContent(view, element)
    view.requestMeasure()
    return true
  }

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

    if (this.preamble.authors.length) {
      const authorsElement = buildAuthorsElement(this.preamble.authors, view)
      element.append(authorsElement)
    }
  }
}

function isShallowEqualPreamble(a: Preamble, b: Preamble) {
  if (a.title?.content !== b.title?.content) {
    return false // title changed
  }

  if (a.authors.length !== b.authors.length) {
    return false // number of authors changed
  }

  for (let i = 0; i < a.authors.length; i++) {
    if (a.authors[i].content !== b.authors[i].content) {
      return false // author changed
    }
  }

  return true
}

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
  authors: { node: SyntaxNode; content: string }[],
  view: EditorView
) {
  const authorsElement = document.createElement('div')
  authorsElement.classList.add('ol-cm-authors')

  for (const { node, content } of authors) {
    const authorContent = content.slice(1, -1) // trimming the braces
    const authors = authorContent.replaceAll(/\s+/g, ' ').split('\\and')

    for (const author of authors) {
      const authorElement = document.createElement('div')
      authorElement.classList.add('ol-cm-author')

      for (const authorInfoItem of author.split('\\\\')) {
        const authorLineElement = document.createElement('div')
        authorLineElement.classList.add('ol-cm-author-line')
        authorLineElement.textContent = authorInfoItem.trim()
        authorElement.appendChild(authorLineElement)
      }

      authorElement.addEventListener('mouseup', () => {
        selectNode(view, node)
      })
      authorsElement.append(authorElement)
    }
  }

  return authorsElement
}
