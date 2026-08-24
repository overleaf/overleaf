import sinon from 'sinon'
import { expect } from 'chai'
import { EventEmitter } from 'events'
import { EditorFacade } from '../../../../../frontend/js/features/source-editor/extensions/realtime'
import {
  historyOT,
  rangesState,
} from '../../../../../frontend/js/features/source-editor/extensions/history-ot'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import {
  AddCommentOperation,
  EditOperation,
  Range,
  SetCommentStateOperation,
  StringFileData,
  TextOperation,
  TrackingProps,
} from 'overleaf-editor-core'
import { historyOTType } from '../../../../../frontend/js/features/ide-react/editor/share-js-history-ot-type'

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

describe('HistoryOTAdapter remote ops', function () {
  const tick = () => new Promise(resolve => setTimeout(resolve, 0))

  const snapshotWithTrackedDelete = (
    content: string,
    { pos, length }: { pos: number; length: number }
  ) => {
    const snapshot = new StringFileData(content)
    const op = new TextOperation()
    if (pos > 0) {
      op.retain(pos)
    }
    op.retain(length, {
      tracking: new TrackingProps(
        'delete',
        'user-1',
        new Date('2025-01-01T00:00:00.000Z')
      ),
    })
    if (pos + length < content.length) {
      op.retain(content.length - pos - length)
    }
    snapshot.edit(op)
    return snapshot
  }

  const setup = (contentOrSnapshot: string | StringFileData) => {
    const snapshot =
      typeof contentOrSnapshot === 'string'
        ? new StringFileData(contentOrSnapshot)
        : contentOrSnapshot

    const shareDoc = Object.assign(new EventEmitter(), {
      otType: 'history-ot',
      snapshot,
      getText: () =>
        shareDoc.snapshot.getContent({ filterTrackedDeletes: true }),
    })

    const errors: unknown[] = []
    shareDoc.on('error', (error: unknown) => errors.push(error))

    // Emit a remote batch like sharejs `_otApply`: set the post-batch snapshot
    // first, then pass the old snapshot as the 2nd arg (vendor/libs/sharejs.js).
    const applyRemote = (operations: EditOperation[]) => {
      const oldSnapshot = shareDoc.snapshot
      shareDoc.snapshot = historyOTType.apply(oldSnapshot, operations)
      shareDoc.emit('remoteop', operations, oldSnapshot)
    }

    const currentDoc = {
      historyOTShareDoc: shareDoc,
      doc: { _doc: shareDoc },
    }
    const state = EditorState.create({
      doc: snapshot.getContent({ filterTrackedDeletes: true }),
      extensions: [historyOT(currentDoc as any)],
    })
    const view = new EditorView({ state })
    const editor = new EditorFacade(view)
    editor.attachShareJs(shareDoc as any)

    return { view, shareDoc, errors, applyRemote }
  }

  it('refreshes comment decorations when a remote AddCommentOperation arrives', async function () {
    const { view, errors, applyRemote } = setup('hello world')
    expect(view.state.field(rangesState).decorations.size).to.equal(0)

    applyRemote([new AddCommentOperation('thread-1', [new Range(0, 5)])])

    expect(view.state.field(rangesState).comments.length).to.equal(1)
    expect(view.state.field(rangesState).decorations.size).to.equal(1)
    await tick()
    expect(errors).to.deep.equal([])
  })

  it('drops the decoration when a remote SetCommentStateOperation resolves it', async function () {
    const snapshot = new StringFileData('hello world')
    new AddCommentOperation('thread-1', [new Range(0, 5)]).apply(snapshot)
    const { view, errors, applyRemote } = setup(snapshot)
    expect(view.state.field(rangesState).decorations.size).to.equal(1)

    applyRemote([new SetCommentStateOperation('thread-1', true)])

    expect(view.state.field(rangesState).decorations.size).to.equal(0)
    await tick()
    expect(errors).to.deep.equal([])
  })

  it('interprets each operation against the document produced by the previous one', async function () {
    const { view, shareDoc, errors, applyRemote } = setup('abc')

    const opA = new TextOperation()
    opA.remove(1)
    opA.retain(2)

    const opB = new TextOperation()
    opB.retain(2)
    opB.insert('X')

    applyRemote([opA, opB])

    expect(shareDoc.snapshot.getContent()).to.equal('bcX')
    expect(view.state.doc.toString()).to.equal('bcX')
    await tick()
    expect(errors).to.deep.equal([])
  })

  it('maps positions through tracked deletes advanced by earlier operations', async function () {
    const { view, shareDoc, errors, applyRemote } = setup(
      snapshotWithTrackedDelete('AAAAddBBBB', { pos: 4, length: 2 })
    )
    expect(view.state.doc.toString()).to.equal('AAAABBBB')

    const opA = new TextOperation()
    opA.remove(4)
    opA.retain(6)

    const opB = new TextOperation()
    opB.retain(6)
    opB.insert('X')

    applyRemote([opA, opB])

    expect(
      shareDoc.snapshot.getContent({ filterTrackedDeletes: true })
    ).to.equal('BBBBX')
    expect(view.state.doc.toString()).to.equal('BBBBX')
    await tick()
    expect(errors).to.deep.equal([])
  })

  it('stops applying a batch that does not fit the snapshot', async function () {
    const { view, shareDoc, errors } = setup('abc')
    // flush the attach-time content check while still in sync
    await tick()

    const opA = new TextOperation()
    opA.remove(1)
    opA.retain(2)

    const opB = new TextOperation()
    opB.retain(2)
    opB.insert('X')

    // an oldSnapshot the ops cannot apply to: the local advance throws and the
    // rest of the batch must not reach the editor
    shareDoc.emit('remoteop', [opA, opB], new StringFileData('xy'))

    expect(errors).to.have.length(1)
    expect(view.state.doc.toString()).to.equal('abc')
  })

  it('reports divergence between the editor and the snapshot after a remote op', async function () {
    const { shareDoc, errors } = setup('abc')
    // flush the attach-time content check while still in sync
    await tick()
    expect(errors).to.deep.equal([])

    shareDoc.snapshot = new StringFileData('abcd')
    shareDoc.emit('remoteop', [])

    await tick()
    expect(errors).to.have.length(1)
  })
})
