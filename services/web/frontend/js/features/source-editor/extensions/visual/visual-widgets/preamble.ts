import { EditorSelection, StateEffect } from '@codemirror/state'
import { EditorView, WidgetType } from '@codemirror/view'
import { SyntaxNode } from '@lezer/common'
import { materialIcon } from '@/features/utils/material-icon'

function createIcon({
  type,
  accessibilityLabel,
  className,
}: {
  type: string
  accessibilityLabel: string
  className?: string
}) {
  const docFragment = document.createDocumentFragment()

  const buttonIcon = materialIcon(type)
  if (className) {
    buttonIcon.classList.add(className)
  }
  docFragment.append(buttonIcon)

  if (accessibilityLabel) {
    const accessibilityLabelEl = document.createElement('span')
    accessibilityLabelEl.className = 'visually-hidden'
    accessibilityLabelEl.textContent = accessibilityLabel
    docFragment.append(accessibilityLabelEl)
  }

  return docFragment
}

export type Preamble = {
  from: number
  to: number
  title?: {
    node: SyntaxNode
    content: string
  }
  authors: {
    node: SyntaxNode
    content: string
  }[]
}

export const collapsePreambleEffect = StateEffect.define<boolean>()

export class PreambleWidget extends WidgetType {
  constructor(public expanded: boolean) {
    super()
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.classList.add('ol-cm-preamble-wrapper')
    wrapper.classList.toggle('ol-cm-preamble-expanded', this.expanded)
    const element = document.createElement('div')
    wrapper.appendChild(element)
    element.classList.add('ol-cm-preamble-widget')
    const expandIcon = createIcon({
      type: 'expand_more',
      accessibilityLabel: view.state.phrase('expand'),
      className: 'ol-cm-preamble-expand-icon',
    })
    const helpText = document.createElement('div')
    const helpLink = document.createElement('a')
    helpLink.href =
      '/learn/latex/Learn_LaTeX_in_30_minutes#The_preamble_of_a_document'
    helpLink.target = '_blank'
    const icon = createIcon({
      type: 'help',
      accessibilityLabel: view.state.phrase('learn_more'),
    })
    helpLink.appendChild(icon)
    const textNode = document.createElement('span')
    textNode.classList.add('ol-cm-preamble-text')
    textNode.textContent = this.getToggleText(view)
    helpText.appendChild(textNode)
    if (this.expanded) {
      helpText.append(document.createTextNode(' '), helpLink)
    }
    element.append(helpText, expandIcon)

    element.addEventListener('mouseup', (event: MouseEvent) => {
      if (event.button !== 0) {
        return true
      }
      if (helpLink.contains(event.target as Node | null)) {
        return true
      }
      event.preventDefault()
      if (this.expanded) {
        view.dispatch({
          effects: collapsePreambleEffect.of(true),
        })
      } else {
        view.dispatch({
          selection: EditorSelection.cursor(0),
          scrollIntoView: true,
        })
      }
    })

    return wrapper
  }

  ignoreEvent(event: Event): boolean {
    return event.type !== 'mouseup'
  }

  eq(other: PreambleWidget): boolean {
    return this.expanded === other.expanded
  }

  coordsAt(element: HTMLElement) {
    return element.getBoundingClientRect()
  }

  get estimatedHeight() {
    return this.expanded ? -1 : 54
  }

  getToggleText(view: EditorView) {
    if (this.expanded) {
      return view.state.phrase(`hide_document_preamble`)
    }
    return view.state.phrase(`show_document_preamble`)
  }
}
