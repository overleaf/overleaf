import { EditorView } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import {
  insertPastedContent,
  pastedContent,
  storePastedContent,
} from './pasted-content'
import { debugConsole } from '@/utils/debugging'
import {
  isBlockContainingElement,
  isBlockElement,
  isElementNode,
  isInlineElement,
  isTextNode,
  shouldRemoveEmptyBlockElement,
} from './html-elements'

export const pasteHtml = [
  Prec.highest(
    EditorView.domEventHandlers({
      paste(event, view) {
        const { clipboardData } = event

        if (!clipboardData) {
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

          // fall back to creating a figure when there's an image on the clipoard,
          // unless the HTML indicates that it came from an Office application
          // (which also puts an image on the clipboard)
          if (
            clipboardData.files.length > 0 &&
            !hasProgId(documentElement) &&
            !isOnlyTable(documentElement)
          ) {
            return false
          }

          const bodyElement = documentElement.querySelector('body')
          // DOMParser should always create a body element, so this is mostly for TypeScript
          if (!bodyElement) {
            return false
          }

          // if the only content is in a code block, use the plain text version
          if (onlyCode(bodyElement)) {
            return false
          }

          const latex = htmlToLaTeX(bodyElement)

          // if there's no formatting, use the plain text version
          if (latex === text && clipboardData.files.length === 0) {
            return false
          }

          view.dispatch(insertPastedContent(view, { latex, text }))
          view.dispatch(storePastedContent({ latex, text }, true))

          return true
        } catch (error) {
          debugConsole.error(error)

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

const findCodeContainingElement = (documentElement: HTMLElement) => {
  let result: HTMLElement | null

  // a code element
  result = documentElement.querySelector<HTMLElement>('code')
  if (result) {
    return result
  }

  // a pre element with "monospace" somewhere in the font family
  result = documentElement.querySelector<HTMLPreElement>('pre')
  if (result?.style.fontFamily.includes('monospace')) {
    return result
  }

  return null
}

// return true if the text content of the first <code> element
// is the same as the text content of the whole document element
const onlyCode = (documentElement: HTMLElement) => {
  const codeElement = findCodeContainingElement(documentElement)

  return (
    codeElement?.textContent?.trim() === documentElement.textContent?.trim()
  )
}

const hasProgId = (documentElement: HTMLElement) => {
  const meta = documentElement.querySelector<HTMLMetaElement>(
    'meta[name="ProgId"]'
  )
  return meta && meta.content.trim().length > 0
}

// detect a table (probably pasted from desktop Excel)
const isOnlyTable = (documentElement: HTMLElement) => {
  const body = documentElement.querySelector<HTMLBodyElement>('body')

  return (
    body &&
    body.childElementCount === 1 &&
    body.firstElementChild!.nodeName === 'TABLE'
  )
}

const htmlToLaTeX = (bodyElement: HTMLElement) => {
  // remove style elements
  removeUnwantedElements(bodyElement, 'style')

  let before: string | null = null
  let after: string | null = null

  // repeat until the content stabilises
  do {
    before = bodyElement.textContent

    // normalise whitespace in text
    normaliseWhitespace(bodyElement)

    // replace unwanted whitespace in blocks
    processWhitespaceInBlocks(bodyElement)

    after = bodyElement.textContent
  } while (before !== after)

  // pre-process table elements
  processTables(bodyElement)

  // pre-process lists
  processLists(bodyElement)

  // protect special characters in non-LaTeX text nodes
  protectSpecialCharacters(bodyElement)

  processMatchedElements(bodyElement)

  const text = bodyElement.textContent

  if (!text) {
    return ''
  }

  return (
    text
      // remove zero-width spaces (e.g. those added by Powerpoint)
      .replaceAll('​', '')
      // normalise multiple newlines
      .replaceAll(/\n{2,}/g, '\n\n')
      // only allow a single newline at the start and end
      .replaceAll(/(^\n+|\n+$)/g, '\n')
      // replace tab with 4 spaces (hard-coded indent unit)
      .replaceAll('\t', '    ')
  )
}

const trimInlineElements = (
  element: HTMLElement,
  precedingSpace = true
): boolean => {
  for (const node of element.childNodes) {
    if (isTextNode(node)) {
      let text = node.textContent!

      if (precedingSpace) {
        text = text.replace(/^\s+/, '')
      }

      if (text === '') {
        node.remove()
      } else {
        node.textContent = text
        precedingSpace = /\s$/.test(text)
      }
    } else if (isInlineElement(node)) {
      precedingSpace = trimInlineElements(node, precedingSpace)
    } else if (isBlockElement(node)) {
      precedingSpace = true // TODO
    } else {
      precedingSpace = false // TODO
    }
  }

  // TODO: trim whitespace at the end

  return precedingSpace
}

const processWhitespaceInBlocks = (documentElement: HTMLElement) => {
  trimInlineElements(documentElement)

  const walker = document.createTreeWalker(
    documentElement,
    NodeFilter.SHOW_ELEMENT,
    node =>
      isElementNode(node) && isElementContainingCode(node)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT
  )

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    // TODO: remove leading newline from pre, code and textarea?
    if (isBlockContainingElement(node)) {
      // remove all text nodes directly inside elements that should only contain blocks
      for (const childNode of node.childNodes) {
        if (isTextNode(childNode)) {
          childNode.remove()
        }
      }
    }

    if (isBlockElement(node)) {
      trimInlineElements(node)

      if (shouldRemoveEmptyBlockElement(node)) {
        node.remove()
        // TODO: and parents?
      }
    }
  }
}

const normaliseWhitespace = (documentElement: HTMLElement) => {
  const walker = document.createTreeWalker(
    documentElement,
    NodeFilter.SHOW_TEXT,
    node =>
      isElementNode(node) && isElementContainingCode(node)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT
  )

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent
    if (text !== null) {
      if (/^\s+$/.test(text)) {
        // replace nodes containing only whitespace (including non-breaking space) with a single space
        node.textContent = ' '
      } else {
        // collapse contiguous whitespace (except for non-breaking space) to a single space
        node.textContent = text.replaceAll(/[\n\r\f\t \u2028\u2029]+/g, ' ')
      }
    }
  }
}

// TODO: negative lookbehind once Safari supports it
const specialCharacterRegExp = /(^|[^\\])([#$%&~_^\\{}])/g

const specialCharacterReplacer = (
  _match: string,
  prefix: string,
  char: string
) => {
  if (char === '\\') {
    // convert `\` to `\textbackslash{}`, preserving subsequent whitespace
    char = 'textbackslash{}'
  }

  return `${prefix}\\${char}`
}

const isElementContainingCode = (element: HTMLElement) =>
  element.nodeName === 'CODE' ||
  (element.nodeName === 'PRE' && element.style.fontFamily.includes('monospace'))

const protectSpecialCharacters = (documentElement: HTMLElement) => {
  const walker = document.createTreeWalker(
    documentElement,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    node =>
      isElementNode(node) && isElementContainingCode(node)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT
  )

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (isTextNode(node)) {
      const text = node.textContent
      if (text) {
        // replace non-backslash-prefixed characters
        node.textContent = text.replaceAll(
          specialCharacterRegExp,
          specialCharacterReplacer
        )
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

const urlCharacterReplacements = new Map<string, string>([
  ['\\', '\\\\'],
  ['#', '\\#'],
  ['%', '\\%'],
  ['{', '%7B'],
  ['}', '%7D'],
])

const protectUrlCharacters = (url: string) => {
  // NOTE: add new characters to both this regex and urlCharacterReplacements
  return url.replaceAll(/[\\#%{}]/g, match => {
    const replacement = urlCharacterReplacements.get(match)
    if (!replacement) {
      throw new Error(`No replacement found for ${match}`)
    }
    return replacement
  })
}

const processLists = (element: HTMLElement) => {
  for (const list of element.querySelectorAll('ol,ul')) {
    // if the list has only one item, replace the list with an element containing the contents of the item
    if (list.childElementCount === 1) {
      const div = document.createElement('div')
      div.append(...list.firstElementChild!.childNodes)
      list.before('\n', div, '\n')
      list.remove()
    }
  }
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

    // add empty cells to account for rowspan
    for (const cell of table.querySelectorAll<HTMLTableCellElement>(
      'th[rowspan],td[rowspan]'
    )) {
      const rowspan = Number(cell.getAttribute('rowspan') || '1')
      const colspan = Number(cell.getAttribute('colspan') || '1')

      let row: HTMLTableRowElement | null = cell.closest('tr')
      if (row) {
        let position = 0
        for (const child of row.cells) {
          if (child === cell) {
            break
          }
          position += Number(child.getAttribute('colspan') || '1')
        }
        for (let i = 1; i < rowspan; i++) {
          const nextElement: Element | null = row?.nextElementSibling
          if (!isTableRow(nextElement)) {
            break
          }
          row = nextElement

          let targetCell: HTMLTableCellElement | undefined
          let targetPosition = 0
          for (const child of row.cells) {
            if (targetPosition === position) {
              targetCell = child
              break
            }
            targetPosition += Number(child.getAttribute('colspan') || '1')
          }

          const fillerCells = Array.from({ length: colspan }, () =>
            document.createElement('td')
          )

          if (targetCell) {
            targetCell.before(...fillerCells)
          } else {
            row.append(...fillerCells)
          }
        }
      }
    }
  }
}

const isTableRow = (element: Element | null): element is HTMLTableRowElement =>
  element?.nodeName === 'TR'

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

const listDepth = (element: HTMLElement): number =>
  Math.max(0, matchingParents(element, 'ul,ol').length)

const indentUnit = '    ' // TODO: replace hard-coded indent unit?

const listIndent = (element: HTMLElement | null): string =>
  element ? indentUnit.repeat(listDepth(element)) : ''

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
    : HTMLElement,
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
): element is HTMLTableRowElement => element?.nodeName === 'TR'

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
  const colspan = Number(element.getAttribute('colspan') || 1)
  const alignment = cellAlignment.get(element.style.textAlign) ?? 'l'
  return `\\multicolumn{${colspan}}{${alignment}}{`
}

const startMultirow = (element: HTMLTableCellElement): string => {
  const rowspan = Number(element.getAttribute('rowspan') || 1)
  // NOTE: it would be useful to read cell width if specified, using `*` as a starting point
  return `\\multirow{${rowspan}}{*}{`
}

const listPrefix = (element: HTMLOListElement | HTMLUListElement) => {
  if (isListOrListItemElement(element.parentElement)) {
    // within a list = newline
    return '\n'
  }
  // outside a list = double newline
  return '\n\n'
}

const listSuffix = (element: HTMLOListElement | HTMLUListElement) => {
  if (listDepth(element) === 0) {
    // a top-level list => newline
    return '\n'
  } else {
    // a nested list => no extra newline
    return ''
  }
}

const isListElement = (
  element: Element | null
): element is HTMLOListElement | HTMLUListElement =>
  element !== null && listNodeNames.includes(element.nodeName)

const isListOrListItemElement = (
  element: Element | null
): element is HTMLOListElement | HTMLUListElement =>
  element !== null && (isListElement(element) || element.nodeName === 'LI')

const listNodeNames = ['OL', 'UL']

const selectors = [
  createSelector({
    selector: 'b',
    match: element =>
      !element.style.fontWeight &&
      !isHeading(element.parentElement) &&
      hasContent(element),
    start: () => '\\textbf{',
    end: () => '}',
  }),
  createSelector({
    selector: '*',
    match: element =>
      (element.style.fontWeight === 'bold' ||
        parseInt(element.style.fontWeight) >= 700) &&
      hasContent(element),
    start: () => '\\textbf{',
    end: () => '}',
    inside: true,
  }),
  createSelector({
    selector: 'strong',
    match: element => !element.style.fontWeight && hasContent(element),
    start: () => '\\textbf{',
    end: () => '}',
  }),
  createSelector({
    selector: 'i',
    match: element => !element.style.fontStyle && hasContent(element),
    start: () => '\\textit{',
    end: () => '}',
  }),
  createSelector({
    selector: '*',
    match: element =>
      element.style.fontStyle === 'italic' && hasContent(element),
    start: () => '\\textit{',
    end: () => '}',
    inside: true,
  }),
  createSelector({
    selector: 'em',
    match: element => !element.style.fontStyle && hasContent(element),
    start: () => '\\textit{',
    end: () => '}',
  }),
  createSelector({
    selector: 'sup',
    match: element => !element.style.verticalAlign && hasContent(element),
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
    match: element => !element.style.verticalAlign && hasContent(element),
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
    start: (element: HTMLAnchorElement) => {
      const url = protectUrlCharacters(element.href)
      return `\\href{${url}}{`
    },
    end: () => `}`,
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
    match: element => !element.closest('table'),
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
    selector: 'pre',
    match: element =>
      element.style.fontFamily.includes('monospace') &&
      element.firstElementChild?.nodeName !== 'CODE' &&
      hasContent(element),
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
    selector: 'tr > td, tr > th',
    start: (element: HTMLTableCellElement) => {
      let output = ''
      const colspan = element.getAttribute('colspan')
      if (colspan && Number(colspan) > 1) {
        output += startMulticolumn(element)
      }
      // NOTE: multirow is nested inside multicolumn
      const rowspan = element.getAttribute('rowspan')
      if (rowspan && Number(rowspan) > 1) {
        output += startMultirow(element)
      }
      return output
    },
    end: element => {
      let output = ''
      // NOTE: multirow is nested inside multicolumn
      const rowspan = element.getAttribute('rowspan')
      if (rowspan && Number(rowspan) > 1) {
        output += '}'
      }
      const colspan = element.getAttribute('colspan')
      if (colspan && Number(colspan) > 1) {
        output += '}'
      }
      const row = element.parentElement as HTMLTableRowElement
      const isLastChild = row.cells.item(row.cells.length - 1) === element
      return output + (isLastChild ? ' \\\\' : ' & ')
    },
  }),
  createSelector({
    selector: 'caption',
    start: () => `\n\n\\caption{`,
    end: () => `}\n\n`,
  }),
  createSelector({
    // selector: 'ul:has(> li:nth-child(2))', // only select lists with at least 2 items (once Firefox supports :has())
    selector: 'ul',
    start: element => {
      return `${listPrefix(element)}${listIndent(element)}\\begin{itemize}`
    },
    end: element => {
      return `\n${listIndent(element)}\\end{itemize}${listSuffix(element)}`
    },
  }),
  createSelector({
    // selector: 'ol:has(> li:nth-child(2))', // only select lists with at least 2 items (once Firefox supports :has())
    selector: 'ol',
    start: element => {
      return `${listPrefix(element)}${listIndent(element)}\\begin{enumerate}`
    },
    end: element => {
      return `\n${listIndent(element)}\\end{enumerate}${listSuffix(element)}`
    },
  }),
  createSelector({
    selector: 'li',
    start: element => {
      return `\n${listIndent(element.parentElement)}${indentUnit}\\item `
    },
  }),
  createSelector({
    selector: 'p',
    match: element => {
      // must have content
      if (!hasContent(element)) {
        return false
      }

      // inside lists and tables, must precede another paragraph
      if (element.closest('li') || element.closest('table')) {
        return element.nextElementSibling?.nodeName === 'P'
      }

      return true
    },
    end: () => '\n\n',
  }),
  createSelector({
    selector: 'blockquote',
    start: () => `\n\n\\begin{quote}\n`,
    end: () => `\n\\end{quote}\n\n`,
  }),
]
