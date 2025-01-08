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

  coordsAt(element: HTMLElement) {
    return element.getBoundingClientRect()
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
            MathJax.typesetClear([element])
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

  for (const { node } of authors) {
    const typesettedAuthors = document.createElement('div')
    typesetNodeIntoElement(node, typesettedAuthors, view.state)

    let currentAuthor = document.createElement('div')
    currentAuthor.classList.add('ol-cm-author')
    authorsElement.append(currentAuthor)

    while (typesettedAuthors.firstChild) {
      const child = typesettedAuthors.firstChild
      if (
        child instanceof HTMLElement &&
        child.classList.contains('ol-cm-command-and')
      ) {
        currentAuthor = document.createElement('div')
        currentAuthor.classList.add('ol-cm-author')
        authorsElement.append(currentAuthor)
        child.remove()
      } else {
        currentAuthor.append(child)
      }
    }

    currentAuthor.addEventListener('mouseup', () => {
      selectNode(view, node)
    })
  }

  return authorsElement
}
