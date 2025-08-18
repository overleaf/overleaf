import sinon from 'sinon'
import { fireEvent, waitFor } from '@testing-library/react'
import { expect } from 'chai'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import {
  restoreScrollPosition,
  scrollPosition,
} from '../../../../../frontend/js/features/source-editor/extensions/scroll-position'

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

describe('CodeMirror scroll position extension', function () {
  beforeEach(function () {
    sinon.stub(HTMLElement.prototype, 'scrollHeight').returns(800)
    sinon.stub(HTMLElement.prototype, 'scrollWidth').returns(500)
    sinon.stub(HTMLElement.prototype, 'clientHeight').returns(200)
    sinon.stub(HTMLElement.prototype, 'clientWidth').returns(500)

    sinon
      .stub(HTMLElement.prototype, 'getBoundingClientRect')
      .returns({ top: 100, left: 0, right: 500, bottom: 200 } as DOMRect)
  })

  afterEach(function () {
    sinon.restore()
  })

  it('stores scroll position when the view is destroyed', async function () {
    const currentDoc = mockDoc()

    sinon.stub(window.Storage.prototype, 'getItem').callsFake(key => {
      switch (key) {
        case 'doc.position.test-doc':
          return JSON.stringify({
            cursorPosition: { row: 2, column: 2 },
            firstVisibleLine: 5,
          })
        default:
          return null
      }
    })

    const view = new EditorView({
      state: EditorState.create({
        doc,
        extensions: [scrollPosition({ currentDoc }, { visual: false })],
      }),
    })

    const setItem = sinon.spy(window.Storage.prototype, 'setItem')
    fireEvent.scroll(view.scrollDOM, { target: { scrollTop: 10 } })

    view.destroy()

    const expected = JSON.stringify({
      cursorPosition: { row: 2, column: 2 },
      firstVisibleLine: 12,
    })

    await waitFor(() => {
      expect(setItem).to.have.been.calledWith('doc.position.test-doc', expected)
    })
  })

  it('restores scroll position', async function () {
    const currentDoc = mockDoc()

    const getItem = sinon
      .stub(window.Storage.prototype, 'getItem')
      .callsFake(key => {
        switch (key) {
          case 'editor.position.test-doc':
            return JSON.stringify({ firstVisibleLine: 12 })
          default:
            return null
        }
      })

    const view = new EditorView({
      state: EditorState.create({
        doc,
        extensions: [scrollPosition({ currentDoc }, { visual: false })],
      }),
    })
    view.dispatch(restoreScrollPosition())

    await waitFor(() => {
      expect(getItem).to.have.been.calledWith('doc.position.test-doc')
    })

    // TODO: scrollTop should be a higher value but requires more mocking
    // await waitFor(() => {
    //   expect(view.scrollDOM.scrollTop).to.eq(0)
    // })
  })
})
