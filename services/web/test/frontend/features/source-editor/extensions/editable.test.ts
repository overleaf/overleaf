import { expect } from 'chai'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import {
  editable,
  setEditable,
} from '../../../../../frontend/js/features/source-editor/extensions/editable'

const doc = `\\documentclass{article}
\\begin{document}
Hello world
\\end{document}`

describe('editable extension', function () {
  let view: EditorView
  let container: HTMLElement

  beforeEach(function () {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(function () {
    view?.destroy()
    container?.remove()
  })

  function createView(extensions = [editable()]) {
    view = new EditorView({
      parent: container,
      state: EditorState.create({
        doc,
        extensions,
      }),
    })
    return view
  }

  describe('initial read-only state', function () {
    beforeEach(function () {
      createView()
    })

    it('should set EditorState.readOnly to true', function () {
      expect(view.state.readOnly).to.be.true
    })

    it('should set EditorView.editable to false', function () {
      expect(view.state.facet(EditorView.editable)).to.be.false
    })

    it('should set contenteditable="false" on the content element', function () {
      expect(view.contentDOM.getAttribute('contenteditable')).to.equal('false')
    })

    it('should set tabindex="0" to allow focus in read-only mode', function () {
      expect(view.contentDOM.getAttribute('tabindex')).to.equal('0')
    })

    it('should allow the editor to receive focus via tabindex', function () {
      view.contentDOM.focus()
      expect(document.activeElement).to.equal(view.contentDOM)
    })
  })

  describe('setEditable(true) - switching to editable mode', function () {
    beforeEach(function () {
      createView()
      view.dispatch(setEditable(true))
    })

    it('should set EditorState.readOnly to false', function () {
      expect(view.state.readOnly).to.be.false
    })

    it('should set EditorView.editable to true', function () {
      expect(view.state.facet(EditorView.editable)).to.be.true
    })

    it('should set contenteditable="true" on the content element', function () {
      expect(view.contentDOM.getAttribute('contenteditable')).to.equal('true')
    })

    it('should not have tabindex attribute (not needed when contenteditable)', function () {
      expect(view.contentDOM.getAttribute('tabindex')).to.be.null
    })

    it('should allow document modifications', function () {
      view.dispatch({
        changes: { from: 0, insert: 'New text ' },
      })

      expect(view.state.doc.toString().startsWith('New text ')).to.be.true
    })

    it('should allow the editor to receive focus', function () {
      view.contentDOM.focus()
      expect(document.activeElement).to.equal(view.contentDOM)
    })
  })

  describe('setEditable(false) - switching to read-only mode', function () {
    beforeEach(function () {
      createView()
      view.dispatch(setEditable(true))
      view.dispatch(setEditable(false))
    })

    it('should set EditorState.readOnly to true', function () {
      expect(view.state.readOnly).to.be.true
    })

    it('should set EditorView.editable to false', function () {
      expect(view.state.facet(EditorView.editable)).to.be.false
    })

    it('should set contenteditable="false" on the content element', function () {
      expect(view.contentDOM.getAttribute('contenteditable')).to.equal('false')
    })

    it('should restore tabindex="0" for focusability', function () {
      expect(view.contentDOM.getAttribute('tabindex')).to.equal('0')
    })

    it('should still allow the editor to receive focus after switching modes', function () {
      view.contentDOM.focus()
      expect(document.activeElement).to.equal(view.contentDOM)
    })
  })
})
