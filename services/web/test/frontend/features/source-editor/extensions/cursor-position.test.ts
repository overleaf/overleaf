import sinon from 'sinon'
import { waitFor } from '@testing-library/react'
import { expect } from 'chai'
import { EditorView } from '@codemirror/view'
import { EditorSelection, EditorState } from '@codemirror/state'
import {
  cursorPosition,
  restoreCursorPosition,
} from '../../../../../frontend/js/features/source-editor/extensions/cursor-position'

const doc = `
\\documentclass{article}
\\title{Your Paper}
\\author{You}
\\begin{document}
\\maketitle
\\begin{abstract}
Your abstract.
\\end{abstract}
\\section{Introduction}
Your introduction goes here!
\\end{document}`

const mockDoc = () => {
  return {
    doc_id: 'test-doc',
  }
}

describe('CodeMirror cursor position extension', function () {
  afterEach(function () {
    sinon.restore()
  })

  it('stores cursor position when the view is destroyed', async function () {
    const currentDoc = mockDoc()

    sinon.stub(window.Storage.prototype, 'getItem').callsFake(key => {
      switch (key) {
        case 'doc.position.test-doc':
          return JSON.stringify({
            cursorPosition: { row: 1, column: 1 },
            firstVisibleLine: 5,
          })
        default:
          return null
      }
    })

    const setItem = sinon.spy(window.Storage.prototype, 'setItem')

    const view = new EditorView({
      state: EditorState.create({
        doc,
        extensions: [cursorPosition({ currentDoc })],
      }),
    })

    view.dispatch({
      selection: EditorSelection.cursor(50),
    })

    view.destroy()

    await waitFor(() => {
      expect(setItem).to.have.been.calledWith(
        'doc.position.test-doc',
        JSON.stringify({
          cursorPosition: {
            row: 3,
            column: 6,
          },
          firstVisibleLine: 5,
        })
      )
    })
  })

  it('restores cursor position', async function () {
    const currentDoc = mockDoc()

    const getItem = sinon
      .stub(window.Storage.prototype, 'getItem')
      .callsFake(key => {
        switch (key) {
          case 'doc.position.test-doc':
            return JSON.stringify({
              cursorPosition: { row: 3, column: 5 },
              firstVisibleLine: 0,
            })
          default:
            return null
        }
      })

    const view = new EditorView({
      state: EditorState.create({
        doc,
        extensions: [cursorPosition({ currentDoc })],
      }),
    })
    view.dispatch(restoreCursorPosition(view.state.doc, 'test-doc'))

    expect(getItem).to.have.been.calledWith('doc.position.test-doc')

    await waitFor(() => {
      const [range] = view.state.selection.ranges
      expect(range.head).to.eq(49)
      expect(range.anchor).to.eq(49)
      expect(range.empty).to.eq(true)
    })
  })
})
