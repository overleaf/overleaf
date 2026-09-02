import { expect } from 'chai'
import { EventEmitter } from 'events'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { history, undo } from '@codemirror/commands'
import {
  AddCommentOperation,
  Range,
  StringFileData,
  TextOperation,
  TrackingProps,
} from 'overleaf-editor-core'
import {
  historyOT,
  setTrackChangesUserId,
} from '../../../../../../frontend/js/features/source-editor/extensions/history-ot'
import { trackDetachedComments } from '../../../../../../frontend/js/features/source-editor/extensions/track-detached-comments'
import { historyOTType } from '../../../../../../frontend/js/features/ide-react/editor/share-js-history-ot-type'

const setup = (
  content: string,
  comments: {
    id: string
    ranges: { pos: number; length: number }[]
    resolved?: boolean
  }[] = [],
  trackedDeletes: { pos: number; length: number }[] = []
) => {
  let snapshot = new StringFileData(content)
  if (trackedDeletes.length > 0) {
    const op = new TextOperation()
    let cursor = 0
    for (const { pos, length } of trackedDeletes) {
      if (pos > cursor) {
        op.retain(pos - cursor)
      }
      op.retain(length, {
        tracking: new TrackingProps(
          'delete',
          'user-1',
          new Date('2025-01-01T00:00:00.000Z')
        ),
      })
      cursor = pos + length
    }
    if (cursor < content.length) {
      op.retain(content.length - cursor)
    }
    snapshot = historyOTType.apply(snapshot, [op])
  }
  for (const comment of comments) {
    snapshot = historyOTType.apply(snapshot, [
      new AddCommentOperation(
        comment.id,
        comment.ranges.map(range => new Range(range.pos, range.length)),
        comment.resolved
      ),
    ])
  }

  const shareDoc: any = Object.assign(new EventEmitter(), {
    otType: 'history-ot',
    snapshot,
    getText: () => shareDoc.snapshot.getContent({ filterTrackedDeletes: true }),
    submitOp: (ops: any[]) => {
      shareDoc.snapshot = historyOTType.apply(shareDoc.snapshot, ops)
    },
  })

  const currentDoc: any = {
    isHistoryOT: () => true,
    historyOTShareDoc: shareDoc,
    doc: { _doc: shareDoc },
  }

  const state = EditorState.create({
    doc: snapshot.getContent({ filterTrackedDeletes: true }),
    extensions: [
      history(),
      historyOT(currentDoc),
      trackDetachedComments({ currentDoc }),
    ],
  })
  const view = new EditorView({ state })

  return { view, shareDoc }
}

describe('historyOT comments', function () {
  it('moves a comment to matching pasted text', function () {
    const { view, shareDoc } = setup('hello world', [
      { id: 'c1', ranges: [{ pos: 0, length: 5 }] },
    ])
    expect(shareDoc.snapshot.getComments().length).to.equal(1)

    // cut "hello"
    view.dispatch({ changes: { from: 0, to: 5 }, userEvent: 'delete.cut' })

    // paste "hello" at the end of " world"
    const end = view.state.doc.length
    view.dispatch({
      changes: { from: end, insert: 'hello' },
      userEvent: 'input.paste',
    })

    const comments = shareDoc.snapshot.getComments().toArray()
    expect(comments).to.have.length(1)
    expect(comments[0].id).to.equal('c1')
    expect(comments[0].ranges).to.have.length(1)
    expect(comments[0].ranges[0].pos).to.equal(end)
    expect(comments[0].ranges[0].length).to.equal(5)
  })

  it('restores a comment when its deletion is undone', function () {
    const { view, shareDoc } = setup('hello world', [
      { id: 'c1', ranges: [{ pos: 0, length: 5 }] },
    ])

    // delete "hello" — the comment detaches
    view.dispatch({ changes: { from: 0, to: 5 } })
    expect(shareDoc.snapshot.getComments().toArray()[0].isEmpty()).to.be.true

    undo(view)

    const comment = shareDoc.snapshot.getComments().toArray()[0]
    expect(comment.isEmpty()).to.be.false
    expect(comment.ranges[0].pos).to.equal(0)
    expect(comment.ranges[0].length).to.equal(5)
  })

  it('moves multiple comments cut together onto matching pasted text', function () {
    const { view, shareDoc } = setup('hello world', [
      { id: 'c1', ranges: [{ pos: 0, length: 5 }] },
      { id: 'c2', ranges: [{ pos: 6, length: 5 }] },
    ])

    // cut the whole "hello world" — both comments detach
    view.dispatch({ changes: { from: 0, to: 11 }, userEvent: 'delete.cut' })

    // paste it back into the now-empty document
    view.dispatch({
      changes: { from: 0, insert: 'hello world' },
      userEvent: 'input.paste',
    })

    const comments = shareDoc.snapshot.getComments().toArray()
    const c1 = comments.find((c: any) => c.id === 'c1')
    const c2 = comments.find((c: any) => c.id === 'c2')
    expect(c1.ranges[0].pos).to.equal(0)
    expect(c1.ranges[0].length).to.equal(5)
    expect(c2.ranges[0].pos).to.equal(6)
    expect(c2.ranges[0].length).to.equal(5)
  })

  it('restores multiple cut segments pasted in a single transaction', function () {
    const { view, shareDoc } = setup('foo bar', [
      { id: 'c1', ranges: [{ pos: 0, length: 3 }] },
      { id: 'c2', ranges: [{ pos: 4, length: 3 }] },
    ])

    // cut "foo" and "bar" in one transaction (two change regions)
    view.dispatch({
      changes: [
        { from: 0, to: 3 },
        { from: 4, to: 7 },
      ],
      userEvent: 'delete.cut',
    })

    // paste both back in one transaction (two inserted regions)
    view.dispatch({
      changes: [
        { from: 0, insert: 'foo' },
        { from: 1, insert: 'bar' },
      ],
      userEvent: 'input.paste',
    })

    expect(view.state.doc.toString()).to.equal('foo bar')
    const comments = shareDoc.snapshot.getComments().toArray()
    const c1 = comments.find((c: any) => c.id === 'c1')
    const c2 = comments.find((c: any) => c.id === 'c2')
    expect(c1.ranges[0].pos).to.equal(0)
    expect(c1.ranges[0].length).to.equal(3)
    expect(c2.ranges[0].pos).to.equal(4)
    expect(c2.ranges[0].length).to.equal(3)
  })

  it('moves a resolved comment to matching pasted text', function () {
    const { view, shareDoc } = setup('hello world', [
      { id: 'c1', ranges: [{ pos: 0, length: 5 }], resolved: true },
    ])

    view.dispatch({ changes: { from: 0, to: 5 }, userEvent: 'delete.cut' })

    const end = view.state.doc.length
    view.dispatch({
      changes: { from: end, insert: 'hello' },
      userEvent: 'input.paste',
    })

    // resolution lives on the thread, not the range: the range moves with its
    // text exactly like an unresolved comment's, as in ShareLaTeX
    const comment = shareDoc.snapshot.getComments().toArray()[0]
    expect(comment.resolved).to.be.true
    expect(comment.ranges).to.have.length(1)
    expect(comment.ranges[0].pos).to.equal(end)
    expect(comment.ranges[0].length).to.equal(5)
  })

  it('does not restore when pasted text does not match a cut comment', function () {
    const { view, shareDoc } = setup('hello world', [
      { id: 'c1', ranges: [{ pos: 0, length: 5 }] },
    ])

    view.dispatch({ changes: { from: 0, to: 5 }, userEvent: 'delete.cut' })

    const end = view.state.doc.length
    view.dispatch({
      changes: { from: end, insert: 'xyz' },
      userEvent: 'input.paste',
    })

    expect(shareDoc.snapshot.getComments().toArray()[0].isEmpty()).to.be.true
  })

  it('moves a comment across tracked deletes on cut and paste', function () {
    // 'hello ' is tracked-deleted: hidden in the editor but still in the
    // snapshot, so editor and snapshot coordinates diverge by 6
    const { view, shareDoc } = setup(
      'aa hello bb cc',
      [{ id: 'c1', ranges: [{ pos: 12, length: 2 }] }],
      [{ pos: 3, length: 6 }]
    )
    expect(view.state.doc.toString()).to.equal('aa bb cc')

    // cut the commented "cc" and paste it at the start of the visible doc
    view.dispatch({ changes: { from: 6, to: 8 }, userEvent: 'delete.cut' })
    view.dispatch({
      changes: { from: 0, insert: 'cc' },
      userEvent: 'input.paste',
    })

    const comment = shareDoc.snapshot.getComments().toArray()[0]
    expect(comment.ranges).to.have.length(1)
    const range = comment.ranges[0]
    expect(
      shareDoc.snapshot.getContent().slice(range.pos, range.pos + range.length)
    ).to.equal('cc')
  })

  it('restores a comment at every paste site with track changes enabled', function () {
    const { view, shareDoc } = setup('hello world', [
      { id: 'c1', ranges: [{ pos: 0, length: 5 }] },
    ])
    view.dispatch(setTrackChangesUserId('user-1'))

    // with track changes on, the cut is a tracked delete (the text stays in
    // the snapshot, so the comment never detaches) and each paste is a tracked
    // insert; the comment must still move onto the pasted text
    view.dispatch({ changes: { from: 0, to: 5 }, userEvent: 'delete.cut' })
    view.dispatch({
      changes: [
        { from: 0, insert: 'hello' },
        { from: 6, insert: 'hello' },
      ],
      userEvent: 'input.paste',
    })

    const comment = shareDoc.snapshot.getComments().toArray()[0]
    expect(comment.ranges).to.have.length(2)
    expect(comment.ranges[0].pos).to.equal(0)
    expect(comment.ranges[1].pos).to.equal(16)
    const content = shareDoc.snapshot.getContent()
    for (const range of comment.ranges) {
      expect(content.slice(range.pos, range.pos + range.length)).to.equal(
        'hello'
      )
    }
  })

  it('restores a comment at every paste site in a multi-cursor paste', function () {
    const { view, shareDoc } = setup('hello world', [
      { id: 'c1', ranges: [{ pos: 0, length: 5 }] },
    ])

    view.dispatch({ changes: { from: 0, to: 5 }, userEvent: 'delete.cut' })
    // paste "hello" at two cursors in one transaction
    view.dispatch({
      changes: [
        { from: 0, insert: 'hello' },
        { from: 6, insert: 'hello' },
      ],
      userEvent: 'input.paste',
    })

    const comment = shareDoc.snapshot.getComments().toArray()[0]
    expect(comment.ranges).to.have.length(2)
    const content = shareDoc.snapshot.getContent()
    for (const range of comment.ranges) {
      expect(content.slice(range.pos, range.pos + range.length)).to.equal(
        'hello'
      )
    }
  })

  it('restores a comment correctly when typing immediately after a paste', function () {
    const { view, shareDoc } = setup('hello world', [
      { id: 'c1', ranges: [{ pos: 0, length: 5 }] },
    ])

    view.dispatch({ changes: { from: 0, to: 5 }, userEvent: 'delete.cut' })
    const end = view.state.doc.length
    view.dispatch({
      changes: { from: end, insert: 'hello' },
      userEvent: 'input.paste',
    })
    // an edit before the restore has settled must not shift the comment
    view.dispatch({ changes: { from: 0, insert: 'X' } })

    const comment = shareDoc.snapshot.getComments().toArray()[0]
    expect(comment.ranges).to.have.length(1)
    const range = comment.ranges[0]
    expect(
      shareDoc.snapshot.getContent().slice(range.pos, range.pos + range.length)
    ).to.equal('hello')
  })

  it('restores a comment correctly when typing immediately after an undo', function () {
    const { view, shareDoc } = setup('hello world', [
      { id: 'c1', ranges: [{ pos: 0, length: 5 }] },
    ])

    view.dispatch({ changes: { from: 0, to: 5 } })
    undo(view)
    // an edit before the restore has settled must not shift the comment
    view.dispatch({ changes: { from: 0, insert: 'X' } })

    const comment = shareDoc.snapshot.getComments().toArray()[0]
    expect(comment.ranges).to.have.length(1)
    const range = comment.ranges[0]
    expect(
      shareDoc.snapshot.getContent().slice(range.pos, range.pos + range.length)
    ).to.equal('hello')
  })

  describe('typing in and around a comment', function () {
    it('extends a comment when text is typed inside it', function () {
      const { view, shareDoc } = setup('hello world', [
        { id: 'c1', ranges: [{ pos: 0, length: 11 }] },
      ])

      view.dispatch({ changes: { from: 5, insert: 'X' } })

      const comment = shareDoc.snapshot.getComments().toArray()[0]
      expect(comment.ranges).to.have.length(1)
      expect(comment.ranges[0].pos).to.equal(0)
      expect(comment.ranges[0].length).to.equal(12)
    })

    it('shifts a comment right when text is typed at its start', function () {
      const { view, shareDoc } = setup('hello world', [
        { id: 'c1', ranges: [{ pos: 6, length: 5 }] },
      ])

      view.dispatch({ changes: { from: 6, insert: 'X' } })

      const comment = shareDoc.snapshot.getComments().toArray()[0]
      expect(comment.ranges).to.have.length(1)
      expect(comment.ranges[0].pos).to.equal(7)
      expect(comment.ranges[0].length).to.equal(5)
    })

    it('excludes text typed at the end of a comment', function () {
      const { view, shareDoc } = setup('hello world', [
        { id: 'c1', ranges: [{ pos: 0, length: 5 }] },
      ])

      view.dispatch({ changes: { from: 5, insert: 'X' } })

      const comment = shareDoc.snapshot.getComments().toArray()[0]
      expect(comment.ranges).to.have.length(1)
      expect(comment.ranges[0].pos).to.equal(0)
      expect(comment.ranges[0].length).to.equal(5)
    })

    it('does not re-attach a detached comment', function () {
      const { view, shareDoc } = setup('hello world', [
        { id: 'c1', ranges: [{ pos: 0, length: 5 }] },
      ])

      // delete "hello" without a cut: the comment detaches
      view.dispatch({ changes: { from: 0, to: 5 } })
      expect(shareDoc.snapshot.getComments().toArray()[0].isEmpty()).to.be.true

      view.dispatch({ changes: { from: 0, insert: 'X' } })

      expect(shareDoc.snapshot.getComments().toArray()[0].isEmpty()).to.be.true
    })
  })

  it('moves every range of a multi-range comment onto matching pasted text', function () {
    const { view, shareDoc } = setup('helloX world', [
      {
        id: 'c1',
        ranges: [
          { pos: 0, length: 5 },
          { pos: 6, length: 6 },
        ],
      },
    ])

    view.dispatch({ changes: { from: 0, to: 12 }, userEvent: 'delete.cut' })
    view.dispatch({
      changes: { from: 0, insert: 'helloX world' },
      userEvent: 'input.paste',
    })

    const comments = shareDoc.snapshot.getComments().toArray()
    expect(comments).to.have.length(1)
    expect(comments[0].ranges).to.have.length(2)
    expect(comments[0].ranges[0].pos).to.equal(0)
    expect(comments[0].ranges[0].length).to.equal(5)
    expect(comments[0].ranges[1].pos).to.equal(6)
    expect(comments[0].ranges[1].length).to.equal(6)
  })

  it('restores every range of a multi-range comment when its deletion is undone', function () {
    const { view, shareDoc } = setup('helloX world', [
      {
        id: 'c1',
        ranges: [
          { pos: 0, length: 5 },
          { pos: 6, length: 6 },
        ],
      },
    ])

    view.dispatch({ changes: { from: 0, to: 12 } })
    expect(shareDoc.snapshot.getComments().toArray()[0].isEmpty()).to.be.true

    undo(view)

    const comment = shareDoc.snapshot.getComments().toArray()[0]
    expect(comment.ranges).to.have.length(2)
    expect(comment.ranges[0].pos).to.equal(0)
    expect(comment.ranges[0].length).to.equal(5)
    expect(comment.ranges[1].pos).to.equal(6)
    expect(comment.ranges[1].length).to.equal(6)
  })

  it('restores a multi-range comment cut as two separate regions', function () {
    const { view, shareDoc } = setup('fooX bar', [
      {
        id: 'c1',
        ranges: [
          { pos: 0, length: 3 },
          { pos: 4, length: 4 },
        ],
      },
    ])

    // cut both commented regions in one transaction, leaving "X"
    view.dispatch({
      changes: [
        { from: 0, to: 3 },
        { from: 4, to: 8 },
      ],
      userEvent: 'delete.cut',
    })
    expect(view.state.doc.toString()).to.equal('X')

    // paste both back in one transaction
    view.dispatch({
      changes: [
        { from: 0, insert: 'foo' },
        { from: 1, insert: ' bar' },
      ],
      userEvent: 'input.paste',
    })

    expect(view.state.doc.toString()).to.equal('fooX bar')
    const comment = shareDoc.snapshot.getComments().toArray()[0]
    expect(comment.ranges).to.have.length(2)
    expect(comment.ranges[0].pos).to.equal(0)
    expect(comment.ranges[0].length).to.equal(3)
    expect(comment.ranges[1].pos).to.equal(4)
    expect(comment.ranges[1].length).to.equal(4)
  })
})
