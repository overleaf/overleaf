import { EditorView } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import {
  insertPastedContent,
  pastedContent,
  storePastedContent,
} from './pasted-content'

export const pasteHtml = [
  Prec.highest(
    EditorView.domEventHandlers({
      paste(event, view) {
        const { clipboardData } = event

        if (!clipboardData) {
          return false
        }

        // allow pasting an image to create a figure
        if (clipboardData.files.length > 0) {
          return false
        }

        // only handle pasted HTML
        if (!clipboardData.types.includes('text/html')) {
          return false
        }

        // ignore text/html from VS Code
        if (
          clipboardData.types.includes('application/vnd.code.copymetadata') ||
          clipboardData.types.includes('vscode-editor-data')
        ) {
          return false
        }

        const html = clipboardData.getData('text/html').trim()
        const text = clipboardData.getData('text/plain').trim()

        if (html.length === 0) {
          return false
        }

        // convert the HTML to LaTeX
        try {
          const parser = new DOMParser()
          const { documentElement } = parser.parseFromString(html, 'text/html')

          // if the only content is in a code block, use the plain text version
          if (onlyCode(documentElement)) {
            return false
          }

          const latex = htmlToLaTeX(documentElement)

          // if there's no formatting, use the plain text version
          if (latex === text) {
            return false
          }

          view.dispatch(insertPastedContent(view, { latex, text }))
          view.dispatch(storePastedContent({ latex, text }, true))

          return true
        } catch (error) {
          console.error(error)

          // fall back to the default paste handler
          return false
        }
      },
    })
  ),
  pastedContent,
]

const removeUnwantedElements = (
  documentElement: HTMLElement,
  selector: string
) => {
  for (const element of documentElement.querySelectorAll(selector)) {
    element.remove()
  }
}

// return true if the text content of the first <code> element
// is the same as the text content of the whole document element
const onlyCode = (documentElement: HTMLElement) =>
  documentElement.querySelector('code')?.textContent?.trim() ===
  documentElement.textContent?.trim()

const htmlToLaTeX = (documentElement: HTMLElement) => {
  // remove style elements
  removeUnwantedElements(documentElement, 'style')

  // replace non-breaking spaces added by Chrome on copy
  processWhitespace(documentElement)

  // pre-process table elements
  processTables(documentElement)

  processMatchedElements(documentElement)

  const text = documentElement.textContent

  if (!text) {
    return ''
  }

  // normalise multiple newlines
  return text.replaceAll(/\n{2,}/g, '\n\n')
}

const processWhitespace = (documentElement: HTMLElement) => {
  const walker = document.createTreeWalker(
    documentElement,
    NodeFilter.SHOW_TEXT
  )

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent === ' ') {
      node.textContent = ' '
    }
  }
}

const processMatchedElements = (documentElement: HTMLElement) => {
  for (const item of selectors) {
    for (const element of documentElement.querySelectorAll<any>(
      item.selector
    )) {
      if (!item.match || item.match(element)) {
        // start the markup
        if (item.start) {
          const start = document.createTextNode(item.start(element))
          if (item.inside) {
            element.prepend(start)
          } else {
            element.before(start)
          }
        }

        // end the markup
        if (item.end) {
          const end = document.createTextNode(item.end(element))
          if (item.inside) {
            element.append(end)
          } else {
            element.after(end)
          }
        }
      }
    }
  }
}

const matchingParents = (element: HTMLElement, selector: string) => {
  const matches = []

  for (
    let ancestor = element.parentElement?.closest(selector);
    ancestor;
    ancestor = ancestor.parentElement?.closest(selector)
  ) {
    matches.push(ancestor)
  }

  return matches
}

const processTables = (element: HTMLElement) => {
  for (const table of element.querySelectorAll('table')) {
    // create a wrapper element for the table and the caption
    const container = document.createElement('div')
    container.className = 'ol-table-wrap'
    table.after(container)

    // move the caption (if it exists) into the container before the table
    const caption = table.querySelector('caption')
    if (caption) {
      container.append(caption)
    }

    // move the table into the container
    container.append(table)
  }
}

const cellAlignment = new Map([
  ['left', 'l'],
  ['center', 'c'],
  ['right', 'r'],
])

const tabular = (element: HTMLTableElement) => {
  const definitions: Array<{
    alignment: string
    borderLeft: boolean
    borderRight: boolean
  }> = []

  const rows = element.querySelectorAll('tr')

  for (const row of rows) {
    const cells = [...row.childNodes].filter(
      element => element.nodeName === 'TD' || element.nodeName === 'TH'
    ) as Array<HTMLTableCellElement>

    let index = 0

    for (const cell of cells) {
      // NOTE: reading the alignment and borders from the first cell definition in each column
      if (definitions[index] === undefined) {
        const { textAlign, borderLeftStyle, borderRightStyle } = cell.style

        definitions[index] = {
          alignment: textAlign,
          borderLeft: visibleBorderStyle(borderLeftStyle),
          borderRight: visibleBorderStyle(borderRightStyle),
        }
      }
      index += Number(cell.getAttribute('colspan') ?? 1)
    }
  }

  for (let index = 0; index <= definitions.length; index++) {
    // fill in missing definitions
    const item = definitions[index] || {
      alignment: 'left',
      borderLeft: false,
      borderRight: false,
    }

    // remove left border if previous column had a right border
    if (item.borderLeft && index > 0 && definitions[index - 1]?.borderRight) {
      item.borderLeft = false
    }
  }

  return definitions
    .flatMap(definition => [
      definition.borderLeft ? '|' : '',
      cellAlignment.get(definition.alignment) ?? 'l',
      definition.borderRight ? '|' : '',
    ])
    .filter(Boolean)
    .join(' ')
}

const listDepth = (
  element: HTMLOListElement | HTMLUListElement | HTMLLIElement
): number => Math.max(0, matchingParents(element, 'ul,ol').length - 1)

const listIndent = (
  element: HTMLOListElement | HTMLUListElement | HTMLLIElement
): string => '\t'.repeat(listDepth(element))

type ElementSelector<T extends string, E extends HTMLElement = HTMLElement> = {
  selector: T
  match?: (element: E) => boolean
  start?: (element: E) => string
  end?: (element: E) => string
  inside?: boolean
}

const createSelector = <
  T extends string,
  E extends HTMLElement = T extends keyof HTMLElementTagNameMap
    ? HTMLElementTagNameMap[T]
    : HTMLElement
>({
  selector,
  ...elementSelector
}: ElementSelector<T, E>) => ({
  selector,
  ...elementSelector,
})

const headings = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6']

const isHeading = (element: HTMLElement | null) => {
  return element && headings.includes(element.nodeName)
}

const hasContent = (element: HTMLElement): boolean => {
  return Boolean(element.textContent && element.textContent.trim().length > 0)
}

type BorderStyle =
  | 'borderTopStyle'
  | 'borderRightStyle'
  | 'borderBottomStyle'
  | 'borderLeftStyle'

const visibleBorderStyle = (style: CSSStyleDeclaration[BorderStyle]): boolean =>
  !!style && style !== 'none' && style !== 'hidden'

const rowHasBorderStyle = (
  element: HTMLTableRowElement,
  style: BorderStyle
): boolean => {
  if (visibleBorderStyle(element.style[style])) {
    return true
  }

  const cells = element.querySelectorAll<HTMLTableCellElement>('th,td')

  return [...cells].every(cell => visibleBorderStyle(cell.style[style]))
}

const isTableRowElement = (
  element: Element | null
): element is HTMLTableRowElement => element?.tagName === 'TR'

const nextRowHasBorderStyle = (
  element: HTMLTableRowElement,
  style: BorderStyle
) => {
  const { nextElementSibling } = element
  return (
    isTableRowElement(nextElementSibling) &&
    rowHasBorderStyle(nextElementSibling, style)
  )
}

const startMulticolumn = (element: HTMLTableCellElement): string => {
  const colspan = element.getAttribute('colspan') ?? 1
  const alignment = cellAlignment.get(element.style.textAlign) ?? 'l'
  return `\\multicolumn{${Number(colspan)}}{${alignment}}{`
}

const selectors = [
  createSelector({
    selector: 'b',
    match: element =>
      element.style.fontWeight !== 'normal' &&
      !isHeading(element.parentElement) &&
      hasContent(element),
    start: () => '\\textbf{',
    end: () => '}',
  }),
  createSelector({
    selector: '*',
    match: element =>
      parseInt(element.style.fontWeight) > 400 && hasContent(element),
    start: () => '\\textbf{',
    end: () => '}',
    inside: true,
  }),
  createSelector({
    selector: 'strong',
    match: element => hasContent(element),
    start: () => '\\textbf{',
    end: () => '}',
  }),
  createSelector({
    selector: 'i',
    match: element =>
      element.style.fontStyle !== 'normal' && hasContent(element),
    start: () => '\\textit{',
    end: () => '}',
  }),
  createSelector({
    selector: '*',
    match: element =>
      element.style.fontStyle === 'italic' && hasContent(element),
    start: () => '\\textit{',
    end: () => '}',
  }),
  createSelector({
    selector: 'em',
    match: element => hasContent(element),
    start: () => '\\textit{',
    end: () => '}',
  }),
  createSelector({
    selector: 'sup',
    match: element => hasContent(element),
    start: () => '\\textsuperscript{',
    end: () => '}',
  }),
  createSelector({
    selector: 'span',
    match: element =>
      element.style.verticalAlign === 'super' && hasContent(element),
    start: () => '\\textsuperscript{',
    end: () => '}',
  }),
  createSelector({
    selector: 'sub',
    match: element => hasContent(element),
    start: () => '\\textsubscript{',
    end: () => '}',
  }),
  createSelector({
    selector: 'span',
    match: element =>
      element.style.verticalAlign === 'sub' && hasContent(element),
    start: () => '\\textsubscript{',
    end: () => '}',
  }),
  createSelector({
    selector: 'a',
    match: element => !!element.href && hasContent(element),
    start: (element: HTMLAnchorElement) => `\\href{${element.href}}{`,
    end: element => `}`,
  }),
  createSelector({
    selector: 'h1',
    match: element => !element.closest('table') && hasContent(element),
    start: () => `\n\n\\section{`,
    end: () => `}\n\n`,
  }),
  createSelector({
    selector: 'h2',
    match: element => !element.closest('table') && hasContent(element),
    start: () => `\n\n\\subsection{`,
    end: () => `}\n\n`,
  }),
  createSelector({
    selector: 'h3',
    match: element => !element.closest('table') && hasContent(element),
    start: () => `\n\n\\subsubsection{`,
    end: () => `}\n\n`,
  }),
  createSelector({
    selector: 'h4',
    match: element => !element.closest('table') && hasContent(element),
    start: () => `\n\n\\paragraph{`,
    end: () => `}\n\n`,
  }),
  createSelector({
    selector: 'h5',
    match: element => !element.closest('table') && hasContent(element),
    start: () => `\n\n\\subparagraph{`,
    end: () => `}\n\n`,
  }),
  // TODO: h6?
  createSelector({
    selector: 'br',
    match: element => element.parentElement?.nodeName !== 'TD', // TODO: why?
    start: () => `\n\n`,
  }),
  createSelector({
    selector: 'code',
    match: element =>
      element.parentElement?.nodeName !== 'PRE' && hasContent(element),
    start: () => `\\verb|`,
    end: () => `|`,
  }),
  createSelector({
    selector: 'pre > code',
    match: element => hasContent(element),
    start: () => `\n\n\\begin{verbatim}\n`,
    end: () => `\n\\end{verbatim}\n\n`,
  }),
  createSelector({
    selector: '.ol-table-wrap',
    start: () => `\n\n\\begin{table}\n\\centering\n`,
    end: () => `\n\\end{table}\n\n`,
  }),
  createSelector({
    selector: 'table',
    start: element => `\n\\begin{tabular}{${tabular(element)}}`,
    end: () => `\\end{tabular}\n`,
  }),
  createSelector({
    selector: 'thead',
    start: () => `\n`,
    end: () => `\n`,
  }),
  createSelector({
    selector: 'tfoot',
    start: () => `\n`,
    end: () => `\n`,
  }),
  createSelector({
    selector: 'tbody',
    start: () => `\n`,
    end: () => `\n`,
  }),
  createSelector({
    selector: 'tr',
    start: element => {
      const borderTop = rowHasBorderStyle(element, 'borderTopStyle')
      return borderTop ? '\\hline\n' : ''
    },
    end: element => {
      const borderBottom = rowHasBorderStyle(element, 'borderBottomStyle')
      return borderBottom && !nextRowHasBorderStyle(element, 'borderTopStyle')
        ? '\n\\hline\n'
        : '\n'
    },
  }),
  createSelector({
    selector: 'tr > td:not(:last-child), tr > th:not(:last-child)',
    start: (element: HTMLTableCellElement) => {
      const colspan = element.getAttribute('colspan')
      return colspan ? startMulticolumn(element) : ''
    },
    end: element => {
      const colspan = element.getAttribute('colspan')
      return colspan ? `} & ` : ` & `
    },
  }),
  createSelector({
    selector: 'tr > td:last-child, tr > th:last-child',
    start: (element: HTMLTableCellElement) => {
      const colspan = element.getAttribute('colspan')
      return colspan ? startMulticolumn(element) : ''
    },
    end: element => {
      const colspan = element.getAttribute('colspan')
      return colspan ? `} \\\\` : ` \\\\`
    },
  }),
  createSelector({
    selector: 'caption',
    start: () => `\n\n\\caption{`,
    end: () => `}\n\n`,
  }),
  createSelector({
    selector: 'ul',
    start: element => `\n\n${listIndent(element)}\\begin{itemize}`,
    end: element => `\n${listIndent(element)}\\end{itemize}\n`,
  }),
  createSelector({
    selector: 'ol',
    start: element => `\n\n${listIndent(element)}\\begin{enumerate}`,
    end: element => `\n${listIndent(element)}\\end{enumerate}\n`,
  }),
  createSelector({
    selector: 'li',
    start: element => `\n${listIndent(element)}\t\\item `,
  }),
  createSelector({
    selector: 'p',
    match: element =>
      element.nextElementSibling?.nodeName === 'P' && hasContent(element),
    end: () => '\n\n',
  }),
  createSelector({
    selector: 'blockquote',
    start: () => `\n\n\\begin{quote}\n`,
    end: () => `\n\\end{quote}\n\n`,
  }),
]
