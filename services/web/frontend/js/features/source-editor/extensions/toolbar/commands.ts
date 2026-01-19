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

// TODO: apply as a snippet?
// TODO: read URL from clipboard?
export const wrapInHref = wrapRanges('\\href{}{', '}', false, (range, view) =>
  isVisual(view) ? range : EditorSelection.cursor(range.from - 2)
)
export const toggleBulletList = toggleListForRanges('itemize')
export const toggleNumberedList = toggleListForRanges('enumerate')
export const wrapInInlineMath = wrapRanges('\\(', '\\)')
export const wrapInDisplayMath = wrapRanges('\n\\[', '\\]\n')

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
  const template = `${placeholderAtStart}\n\\begin{table}
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
  snippet(template)({ state, dispatch }, { label: 'Table' }, pos, pos)
  return true
}

export const insertCite: Command = view => {
  const { state, dispatch } = view
  const pos = state.selection.main.anchor
  const template = snippets.cite
  snippet(template)({ state, dispatch }, { label: 'Cite' }, pos, pos)
  return true
}

export const insertRef: Command = view => {
  const { state, dispatch } = view
  const pos = state.selection.main.anchor
  const template = snippets.ref
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

export const deleteSelection: Command = view => {
  if (view.state.selection.ranges.every(range => range.empty)) return false

  const transaction = view.state.changeByRange(range => {
    if (range.empty) {
      return { changes: [], range }
    }

    return {
      changes: { from: range.from, to: range.to, insert: '' },
      range: EditorSelection.cursor(range.from),
    }
  })

  view.dispatch(transaction)
  return true
}
