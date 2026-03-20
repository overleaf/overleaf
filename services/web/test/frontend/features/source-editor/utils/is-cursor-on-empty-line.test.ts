import { expect } from 'chai'
import { EditorState, EditorSelection } from '@codemirror/state'
import { isCursorOnEmptyLine } from '../../../../../frontend/js/features/source-editor/utils/is-cursor-on-empty-line'

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

describe('isCursorOnEmptyLine', function () {
  it('returns true when cursor is on an empty line', function () {
    const state = cursorState('hello\n\nworld', 6)
    expect(isCursorOnEmptyLine(state)).to.be.true
  })

  it('returns true when cursor is on a whitespace-only line', function () {
    const state = cursorState('hello\n   \nworld', 8)
    expect(isCursorOnEmptyLine(state)).to.be.true
  })

  it('returns false when cursor is on a line with content', function () {
    const state = cursorState('hello world', 3)
    expect(isCursorOnEmptyLine(state)).to.be.false
  })

  it('returns false when there is an active selection', function () {
    const state = selectionState('hello\n\nworld', 0, 5)
    expect(isCursorOnEmptyLine(state)).to.be.false
  })

  it('returns false when selection spans an empty line', function () {
    const state = selectionState('hello\n\nworld', 4, 8)
    expect(isCursorOnEmptyLine(state)).to.be.false
  })
})
