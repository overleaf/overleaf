import { expect } from 'chai'
import { EditorState, EditorSelection } from '@codemirror/state'
import { selectHighlightedOrNearestToken } from '../../../../../frontend/js/features/source-editor/utils/select-highlighted-or-nearest-token'

function cursorState(doc: string, cursorPos: number) {
  return EditorState.create({
    doc,
    selection: EditorSelection.cursor(cursorPos),
  })
}

function selectionState(doc: string, from: number, to: number) {
  return EditorState.create({
    doc,
    selection: EditorSelection.range(from, to),
  })
}

function sliceRange(state: EditorState, range: { from: number; to: number }) {
  return state.doc.sliceString(range.from, range.to)
}

describe('selectHighlightedOrNearestToken', function () {
  it('returns current highlighted selection when it exists', function () {
    const state = selectionState('hello world', 0, 5)
    const result = selectHighlightedOrNearestToken(state)

    expect(result).to.not.be.null
    expect(sliceRange(state, result!)).to.equal('hello')
  })

  it('selects the token containing the cursor', function () {
    const state = cursorState('hello world', 8)
    const result = selectHighlightedOrNearestToken(state)

    expect(result).to.not.be.null
    expect(sliceRange(state, result!)).to.equal('world')
  })

  it('selects nearest token when cursor is in leading whitespace', function () {
    const state = cursorState('   hello world', 0)
    const result = selectHighlightedOrNearestToken(state)

    expect(result).to.not.be.null
    expect(sliceRange(state, result!)).to.equal('hello')
  })

  it('selects token when cursor is at its boundary', function () {
    // pos 5 is immediately after "hello" (from=0, to=5) — pos equals to, so dist is 0
    const state = cursorState('hello world', 5)
    const result = selectHighlightedOrNearestToken(state)

    expect(result).to.not.be.null
    expect(sliceRange(state, result!)).to.equal('hello')
  })

  it('selects nearer token when cursor is between two tokens', function () {
    // "hello   world" — pos 6, "hello" ends at 5 (dist 1), "world" starts at 8 (dist 2)
    const state = cursorState('hello   world', 6)
    const result = selectHighlightedOrNearestToken(state)

    expect(result).to.not.be.null
    expect(sliceRange(state, result!)).to.equal('hello')
  })

  it('selects earlier token when equidistant between two tokens', function () {
    // "hello  world" — pos 6 is equidistant from "hello" (ends at 5, dist 1) and "world" (starts at 7, dist 1)
    const state = cursorState('hello  world', 6)
    const result = selectHighlightedOrNearestToken(state)

    expect(result).to.not.be.null
    expect(sliceRange(state, result!)).to.equal('hello')
  })

  it('returns null when line has no tokens', function () {
    const state = cursorState('   \n\t  ', 2)
    const result = selectHighlightedOrNearestToken(state)

    expect(result).to.be.null
  })
})
