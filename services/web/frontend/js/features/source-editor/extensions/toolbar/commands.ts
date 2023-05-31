import { EditorSelection, EditorState, SelectionRange } from '@codemirror/state'
import { Command } from '@codemirror/view'
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
  unwrapNumberedList,
  wrapInBulletList,
  wrapInNumberedList,
} from './lists'
import { snippet } from '@codemirror/autocomplete'
import { snippets } from './snippets'
import { minimumListDepthForSelection } from '../../utils/tree-operations/ancestors'

export const toggleBold = toggleRanges('\\textbf')
export const toggleItalic = toggleRanges('\\textit')
export const wrapInHref = wrapRanges('\\href{}{', '}', false, range =>
  EditorSelection.cursor(range.from - 2)
)
export const toggleBulletList = toggleListForRanges('itemize')
export const toggleNumberedList = toggleListForRanges('enumerate')
export const wrapInInlineMath = wrapRanges('\\(', '\\)')
export const wrapInDisplayMath = wrapRanges('\n\\[', '\\]\n')

export const ensureEmptyLine = (state: EditorState, range: SelectionRange) => {
  let pos = range.anchor
  let suffix = ''

  const line = state.doc.lineAt(pos)

  if (line.text.trim().length) {
    pos = Math.min(line.to + 1, state.doc.length)
    const nextLine = state.doc.lineAt(pos)

    if (nextLine.length) {
      suffix = '\n'
    }
  }
  return { pos, suffix }
}

export const insertFigure: Command = view => {
  const { state, dispatch } = view
  const { pos, suffix } = ensureEmptyLine(state, state.selection.main)
  const template = `\n${snippets.figure}\n${suffix}`
  snippet(template)({ state, dispatch }, { label: 'Figure' }, pos, pos)
  return true
}

export const insertTable: Command = view => {
  const { state, dispatch } = view
  const { pos, suffix } = ensureEmptyLine(state, state.selection.main)
  const template = `\n${snippets.table}\n${suffix}`
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
    default:
      return false
  }
}

export const toggleSearch: Command = view => {
  if (searchPanelOpen(view.state)) {
    closeSearchPanel(view)
  } else {
    openSearchPanel(view)
  }
  return true
}
