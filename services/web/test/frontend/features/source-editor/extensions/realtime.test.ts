import sinon from 'sinon'
import { expect } from 'chai'
import { EditorFacade } from '../../../../../frontend/js/features/source-editor/extensions/realtime'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'

describe('CodeMirror EditorFacade', function () {
  let state: EditorState, view: EditorView
  beforeEach(function () {
    state = EditorState.create()
    view = new EditorView({ state })
  })

  it('should allow us to manipulate the CodeMirror document', function () {
    const editor = new EditorFacade(view)
    const text = 'basic test, nothing more'

    editor.cmInsert(0, text)

    expect(editor.getValue()).to.equal(text)

    editor.cmDelete(0, 'b')

    expect(editor.getValue()).to.equal(text.slice(1))
  })

  it('should allow us to attach change listeners', function () {
    const editor = new EditorFacade(view)
    const listenerA = sinon.stub()
    const listenerB = sinon.stub()

    editor.on('change', listenerA)
    editor.on('change', listenerB)

    expect(listenerA).to.not.have.been.called
    expect(listenerB).to.not.have.been.called

    const magicNumber = Math.random()
    editor.emit('change', magicNumber)

    expect(listenerA).to.have.been.calledWith(magicNumber)
    expect(listenerB).to.have.been.calledWith(magicNumber)
  })

  it('should attach to ShareJs document', function () {
    const editor = new EditorFacade(view)
    const text = 'something nice'
    const shareDoc = {
      on: sinon.stub(),
      getText: sinon.stub().returns(text),
      removeListener: sinon.stub(),
      detach_cm6: undefined,
    }

    editor.cmInsert(0, text)

    // @ts-ignore
    editor.attachShareJs(shareDoc)

    expect(shareDoc.on.callCount).to.equal(2)
    expect(shareDoc.on).to.have.been.calledWith('insert')
    expect(shareDoc.on).to.have.been.calledWith('delete')

    expect(shareDoc.detach_cm6).to.be.a('function')
  })
})
