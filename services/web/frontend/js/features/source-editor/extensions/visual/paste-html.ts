import { EditorView } from '@codemirror/view'
import { EditorSelection, Prec } from '@codemirror/state'

export const pasteHtml = Prec.highest(
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

      const html = clipboardData.getData('text/html').trim()

      if (html.length === 0) {
        return false
      }

      // convert the HTML to LaTeX
      try {
        const latex = htmlToLaTeX(html)

        view.dispatch(
          view.state.changeByRange(range => {
            return {
              range: EditorSelection.cursor(range.from + latex.length),
              changes: { from: range.from, to: range.to, insert: latex },
            }
          })
        )

        return true
      } catch (error) {
        console.error(error)

        // fall back to the default paste handler
        return false
      }
    },
  })
)

const removeUnwantedElements = (
  documentElement: HTMLElement,
  selector: string
) => {
  for (const element of documentElement.querySelectorAll(selector)) {
    element.remove()
  }
}

const htmlToLaTeX = (html: string) => {
  const parser = new DOMParser()
  const { documentElement } = parser.parseFromString(html, 'text/html')

  // remove style elements
  removeUnwantedElements(documentElement, 'style')

  // pre-process table elements
  processTables(documentElement)

  // protect special characters in non-LaTeX text nodes
  protectSpecialCharacters(documentElement)

  processMatchedElements(documentElement)

  const text = documentElement.textContent

  if (!text) {
    return ''
  }

  // normalise multiple newlines
  return text.replaceAll(/\n{2,}/g, '\n\n')
}

const protectSpecialCharacters = (documentElement: HTMLElement) => {
  for (const element of documentElement.childNodes) {
    const text = element.textContent
    if (text) {
      // if there are no code blocks, use backslash as an indicator of LaTeX code that shouldn't be protected
      if (
        element instanceof HTMLElement &&
        !element.querySelector('code') &&
        text.includes('\\')
      ) {
        continue
      }

      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)

      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent
        if (text) {
          // leave text that's in a code block
          if (node.parentElement?.closest('code')) {
            continue
          }

          // replace non-backslash-prefixed characters
          node.textContent = text.replaceAll(
            /(^|[^\\])([#$%&~_^\\{}])/g,
            (_match, prefix: string, char: string) => `${prefix}\\${char}`
          )
        }
      }
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

const tabular = (element: HTMLTableElement) => {
  const options = []

  // NOTE: only analysing cells in the first row
  const row = element.querySelector('tr')

  if (row) {
    // TODO: look for horizontal borders and insert \hline (or \toprule, \midrule, \bottomrule etc)?

    const cells = [...row.childNodes].filter(
      element => element.nodeName === 'TD' || element.nodeName === 'TH'
    ) as Array<HTMLTableCellElement | HTMLTableHeaderCellElement>

    for (const cell of cells) {
      const { borderLeft, textAlign, borderRight } = cell.style

      if (borderLeft && borderLeft !== 'none') {
        // avoid duplicating when both left and right borders are defined
        if (options.length === 0 || options[options.length - 1] !== '|') {
          options.push('|')
        }
      }

      options.push(
        textAlign === 'left' ? 'l' : textAlign === 'right' ? 'r' : 'c'
      )

      if (borderRight && borderRight !== 'none') {
        options.push('|')
      }
    }
  }

  return options.join(' ')
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

export const selectors = [
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
    start: element => `\n\n\\begin{table}\n\\centering\n`,
    end: () => `\n\\end{table}\n\n`,
  }),
  createSelector({
    selector: 'table',
    start: element => `\n\\begin{tabular}{${tabular(element)}}\n`,
    end: () => `\n\\end{tabular}\n`,
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
    match: element => element.nextElementSibling?.nodeName === 'TR',
    end: () => `\n`,
  }),
  createSelector({
    selector: 'tr > td:not(:last-child), tr > th:not(:last-child)',
    start: element => {
      const colspan = element.getAttribute('colspan')
      return colspan ? `\\multicolumn{${Number(colspan)}}{` : ''
    },
    end: element => {
      const colspan = element.getAttribute('colspan')
      return colspan ? `} & ` : ` & `
    },
  }),
  createSelector({
    selector: 'tr > td:last-child, tr > th:last-child',
    start: element => {
      const colspan = element.getAttribute('colspan')
      return colspan ? `\\multicolumn{${Number(colspan)}}{` : ''
    },
    end: element => {
      const colspan = element.getAttribute('colspan')
      return colspan ? `}  \\\\` : ` \\\\`
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
]
