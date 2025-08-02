import { IndentContext, indentString, language } from '@codemirror/language'
import { EditorSelection, EditorState, SelectionRange } from '@codemirror/state'
import { Command, EditorView } from '@codemirror/view'
import {
  closeSearchPanel,
  openSearchPanel,
  searchPanelOpen,
} from '@codemirror/search'
import { toggleRanges, wrapRanges } from '../../commands/ranges'
import {
  ancestorListType,
  toggleListForRanges,
  unwrapBulletList,
  unwrapDescriptionList,
  unwrapNumberedList,
  wrapInBulletList,
  wrapInDescriptionList,
  wrapInNumberedList,
} from './lists'
import { snippet } from '@codemirror/autocomplete'
import { snippets } from './snippets'
import { minimumListDepthForSelection } from '../../utils/tree-operations/ancestors'
import { isVisual } from '../visual/visual'
import { sendSearchEvent } from '@/features/event-tracking/search-events'

export const toggleBold = toggleRanges('\\textbf')
export const toggleItalic = toggleRanges('\\textit')
export const toggleTypstStrong = wrapRanges(' *', '* ')
export const toggleTypstEmph = wrapRanges(' _', '_ ')

// TODO: apply as a snippet?
// TODO: read URL from clipboard?
export const wrapInHref = (view: EditorView) => {
  if (view.state.facet(language)?.name == "typst") {
    return wrapRanges('#link("")[', ']', false, (range, view) =>
      isVisual(view) ? range : EditorSelection.cursor(range.from - 3)
    )(view)
  } else {
    return wrapRanges('\\href{}{', '}', false, (range, view) =>
      isVisual(view) ? range : EditorSelection.cursor(range.from - 2)
    )(view)
  }
}
export const toggleBulletList = toggleListForRanges('itemize')
export const toggleNumberedList = toggleListForRanges('enumerate')
export const wrapInInlineMath = (view: EditorView) => {
  if (view.state.facet(language)?.name == "typst") {
    return wrapRanges('$', '$')(view)
  } else {
    return wrapRanges('\\(', '\\)')(view)
  }
}
export const wrapInDisplayMath = (view: EditorView) => {
  if (view.state.facet(language)?.name == "typst") {
    return wrapRanges('$\n', '\n$')(view)
  } else {
    return wrapRanges('\n\\[', '\\]\n')(view)
  }
}

export const ensureEmptyLine = (
  state: EditorState,
  range: SelectionRange,
  direction: 'above' | 'below' = 'below'
) => {
  let pos = range.anchor
  let suffix = ''
  let prefix = ''

  const line = state.doc.lineAt(pos)

  if (line.text.trim().length) {
    if (direction === 'below') {
      pos = Math.min(line.to + 1, state.doc.length)
    } else {
      pos = Math.max(line.from - 1, 0)
    }
    const neighbouringLine = state.doc.lineAt(pos)

    if (neighbouringLine.length && direction === 'below') {
      suffix = '\n'
    } else if (neighbouringLine.length && direction === 'above') {
      prefix = '\n'
    }
  }
  return { pos, suffix, prefix }
}

export const insertFigure: Command = view => {
  const { state, dispatch } = view
  const { pos, suffix } = ensureEmptyLine(state, state.selection.main)
  const template = `\n${snippets.figure}\n${suffix}`
  snippet(template)({ state, dispatch }, { label: 'Figure' }, pos, pos)
  return true
}

export const insertTable = (view: EditorView, sizeX: number, sizeY: number) => {
  const { state, dispatch } = view
  const visual = isVisual(view)
  const placeholder = visual ? '' : '#{}'
  const placeholderAtStart = visual ? '#{}' : ''
  const { pos, suffix } = ensureEmptyLine(state, state.selection.main)
  const cx = new IndentContext(state)
  const columns = cx.lineIndent(state.selection.main.from)
  const indent = indentString(state, columns)
  const languageName = state.facet(language)?.name;
  const latexTemplate = `${placeholderAtStart}\n\\begin{table}
\t\\centering
\t\\begin{tabular}{${'c'.repeat(sizeX)}}
${(
  '\t\t' +
  `${placeholder} & ${placeholder}`.repeat(sizeX - 1) +
  '\\\\\n'
).repeat(sizeY)}\t\\end{tabular}
\t\\caption{Caption}
\t\\label{tab:placeholder}
\\end{table}${suffix}`
  const typstTemplate = `${indent}#figure(
${indent}  caption: [Caption],
${indent}  table(
${indent}    columns: ${sizeX},
${indent}    table.header(
${indent}      ${("[" + placeholder + "], ").repeat(sizeX)}
${indent}    ),
${(
  indent + "    " +
  `[${placeholder}], `.repeat(sizeX) +
  '\n'
).repeat(sizeY - 1)}${indent}  )
${indent}) <tab:table-name-here>${suffix}`
  snippet(languageName == "typst" ? typstTemplate : latexTemplate)({ state, dispatch }, { label: 'Table' }, pos, pos)
  return true
}

export const insertCite: Command = view => {
  const { state, dispatch } = view
  const pos = state.selection.main.anchor
  const template = snippets[`${view.state.facet(language)?.name}_cite`]
  snippet(template)({ state, dispatch }, { label: 'Cite' }, pos, pos)
  return true
}

export const insertRef: Command = view => {
  const { state, dispatch } = view
  const pos = state.selection.main.anchor
  const template = snippets[`${view.state.facet(language)?.name}_ref`]
  snippet(template)({ state, dispatch }, { label: 'Ref' }, pos, pos)
  return true
}

export const indentDecrease: Command = view => {
  if (minimumListDepthForSelection(view.state) < 2) {
    return false
  }
  switch (ancestorListType(view.state)) {
    case 'itemize':
      return unwrapBulletList(view)
    case 'enumerate':
      return unwrapNumberedList(view)
    case 'description':
      return unwrapDescriptionList(view)
    default:
      return false
  }
}

export const cursorIsAtStartOfListItem = (state: EditorState) => {
  return state.selection.ranges.every(range => {
    const line = state.doc.lineAt(range.from)
    const prefix = state.sliceDoc(line.from, range.from)
    return /\\item\s*$/.test(prefix)
  })
}

export const indentIncrease: Command = view => {
  if (minimumListDepthForSelection(view.state) < 1) {
    return false
  }
  switch (ancestorListType(view.state)) {
    case 'itemize':
      return wrapInBulletList(view)
    case 'enumerate':
      return wrapInNumberedList(view)
    case 'description':
      return wrapInDescriptionList(view)
    default:
      return false
  }
}

export const toggleSearch: Command = view => {
  if (searchPanelOpen(view.state)) {
    closeSearchPanel(view)
  } else {
    sendSearchEvent('search-open', {
      searchType: 'document',
      method: 'button',
      location: 'toolbar',
      mode: isVisual(view) ? 'visual' : 'source',
    })
    openSearchPanel(view)
  }
  return true
}

export const addComment = () => {
  window.dispatchEvent(new Event('add-new-review-comment'))
}
