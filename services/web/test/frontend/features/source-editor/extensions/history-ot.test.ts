import { expect } from 'chai'
import { EditorState, Transaction, TransactionSpec } from '@codemirror/state'
import {
  AddCommentOperation,
  Range,
  StringFileData,
  TextOperation,
  TrackingProps,
} from 'overleaf-editor-core'
import {
  historyOT,
  rangesState,
  setTrackChangesUserId,
} from '@/features/source-editor/extensions/history-ot'
import { DocumentContainer } from '@/features/ide-react/editor/document-container'

const TIMESTAMP = new Date('2025-01-01T00:00:00.000Z')
const USER_ID = 'user-1'

// Build a StringFileData whose stored snapshot carries the given tracked-delete
// ranges (expressed in snapshot coordinates). A track-changes delete is encoded
// as a RetainOp with `tracking: delete`, so the deleted characters stay in the
// snapshot and are only hidden from CodeMirror by `filterTrackedDeletes` — the
// snapshot stays longer than the visible document.
function snapshotWithTrackedDeletes(
  text: string,
  trackedDeleteRanges: Array<{ pos: number; length: number }> = []
) {
  const snapshot = new StringFileData(text)
  if (trackedDeleteRanges.length > 0) {
    const op = new TextOperation()
    let cursor = 0
    for (const { pos, length } of trackedDeleteRanges) {
      if (pos > cursor) {
        op.retain(pos - cursor)
      }
      op.retain(length, {
        tracking: new TrackingProps('delete', USER_ID, TIMESTAMP),
      })
      cursor = pos + length
    }
    if (cursor < text.length) {
      op.retain(text.length - cursor)
    }
    snapshot.edit(op)
  }
  return snapshot
}

// Mock a DocumentContainer around a snapshot that captures submitted ops. The
// same share doc backs both `historyOTShareDoc` and `doc._doc`, as in
// production. `submitOp` applies each op to the snapshot the way production
// does, so an op with the wrong base length throws here instead of silently
// passing — that is what makes the base-length assertions meaningful.
function setup(
  snapshot: StringFileData,
  { trackChangesEnabled = true }: { trackChangesEnabled?: boolean } = {}
) {
  const submitted: TextOperation[] = []
  const shareDoc = {
    snapshot,
    submitOp: (ops: TextOperation[]) => {
      for (const op of ops) {
        snapshot.edit(op)
      }
      submitted.push(...ops)
    },
    emit: () => {},
  }
  const currentDoc = {
    historyOTShareDoc: shareDoc,
    doc: { _doc: shareDoc },
  } as unknown as DocumentContainer

  let state = EditorState.create({
    doc: snapshot.getContent({ filterTrackedDeletes: true }),
    extensions: historyOT(currentDoc),
  })
  if (trackChangesEnabled) {
    state = state.update(setTrackChangesUserId(USER_ID)).state
  }
  return {
    submitted,
    edit(spec: TransactionSpec) {
      state = state.update(spec).state
    },
    getState() {
      return state
    },
  }
}

describe('historyOT rangesState', function () {
  it('applies a tracked delete covering a commented range without crashing', function () {
    const snapshot = snapshotWithTrackedDeletes('one two three')
    new AddCommentOperation('c1', [new Range(4, 3)]).apply(snapshot)
    const { edit, getState } = setup(snapshot)

    // tracked-delete "two ": the comment's range is fully hidden, so no mark
    edit({ changes: { from: 4, to: 8 } })

    expect(getState().doc.toString()).to.equal('one three')
    const { decorations } = getState().field(rangesState)
    // the tracked-delete widget only — no empty comment mark
    expect(decorations.size).to.equal(1)
  })
})

describe('historyOT updateSender', function () {
  describe('when the transaction does not change the document', function () {
    it('should not submit an operation', function () {
      const { submitted, edit } = setup(
        snapshotWithTrackedDeletes('Hello world')
      )

      // A selection-only transaction: no document change.
      edit({ selection: { anchor: 2, head: 5 } })

      expect(submitted).to.have.length(0)
    })
  })

  describe('when the transaction is a remote change', function () {
    it('should not submit an operation', function () {
      const { submitted, edit } = setup(
        snapshotWithTrackedDeletes('Hello world')
      )

      // A change that originated remotely is annotated as such; the sender must
      // not echo it back as an outgoing operation.
      edit({
        changes: { from: 0, insert: 'remote text ' },
        annotations: Transaction.remote.of(true),
      })

      expect(submitted).to.have.length(0)
    })
  })

  describe('with no tracked changes in the document', function () {
    describe('and tracked changes disabled', function () {
      it('should submit a plain insertion', function () {
        const { submitted, edit } = setup(
          snapshotWithTrackedDeletes('Hello world'),
          { trackChangesEnabled: false }
        )

        edit({ changes: { from: 11, insert: '!!!' } })

        expect(submitted).to.have.length(1)
        const op = submitted[0]
        expect(op.baseLength).to.equal(11)
        expect(op.targetLength).to.equal(14)
        expect(op.toJSON().textOperation).to.deep.equal([11, '!!!'])
      })

      it('should submit a plain deletion', function () {
        const { submitted, edit } = setup(
          snapshotWithTrackedDeletes('Hello world'),
          { trackChangesEnabled: false }
        )

        // Remove "Hello " from the start.
        edit({ changes: { from: 0, to: 6 } })

        expect(submitted).to.have.length(1)
        const op = submitted[0]
        expect(op.baseLength).to.equal(11)
        expect(op.targetLength).to.equal(5)
        expect(op.toJSON().textOperation).to.deep.equal([-6, 5])
      })
    })

    describe('and tracked changes enabled', function () {
      it('should submit the insertion as a tracked insert', function () {
        const { submitted, edit } = setup(
          snapshotWithTrackedDeletes('Hello world')
        )

        edit({ changes: { from: 11, insert: '!!!' } })

        expect(submitted).to.have.length(1)
        const op = submitted[0]
        expect(op.baseLength).to.equal(11)
        expect(op.targetLength).to.equal(14)
        const [retain, insert] = op.toJSON().textOperation as any[]
        expect(retain).to.equal(11)
        expect(insert.i).to.equal('!!!')
        expect(insert.tracking).to.include({ type: 'insert', userId: USER_ID })
      })

      it('should submit the deletion as a tracked retain that keeps the snapshot length', function () {
        const { submitted, edit } = setup(
          snapshotWithTrackedDeletes('Hello world')
        )

        // Removing "Hello " while tracking must not shrink the snapshot: the
        // characters are retained and marked as a tracked delete instead.
        edit({ changes: { from: 0, to: 6 } })

        expect(submitted).to.have.length(1)
        const op = submitted[0]
        expect(op.baseLength).to.equal(11)
        expect(op.targetLength).to.equal(11)
        const [tracked, retain] = op.toJSON().textOperation as any[]
        expect(tracked.r).to.equal(6)
        expect(tracked.tracking).to.include({ type: 'delete', userId: USER_ID })
        expect(retain).to.equal(5)
      })
    })
  })

  describe('with a tracked delete at the end of the document', function () {
    // "Hello world" with the trailing "world" tracked-deleted: the visible
    // CodeMirror document is "Hello " (6 chars) while the snapshot is still 11.
    const trailingDelete = () =>
      snapshotWithTrackedDeletes('Hello world', [{ pos: 6, length: 5 }])

    it('should base the operation on the full snapshot length, not the visible length', function () {
      const { submitted, edit } = setup(trailingDelete())

      // Type at the visible end of the document.
      edit({ changes: { from: 6, insert: 'there' } })

      expect(submitted).to.have.length(1)
      const op = submitted[0]
      // A base length of 6 (the visible length) would be rejected by
      // TextOperation.apply against the 11-char snapshot.
      expect(op.baseLength).to.equal(11)
      expect(op.targetLength).to.equal(16)
    })

    it('should keep applying cleanly across consecutive edits', function () {
      const { submitted, edit } = setup(trailingDelete())

      // Three separate insertions at the growing visible end. submitOp applies
      // each op to the snapshot, so an under-counted base length would throw
      // ApplyError on the offending edit.
      edit({ changes: { from: 6, insert: 'foo' } })
      edit({ changes: { from: 9, insert: 'bar' } })
      edit({ changes: { from: 12, insert: 'baz' } })

      expect(submitted).to.have.length(3)
      expect(submitted.map(op => op.baseLength)).to.deep.equal([11, 14, 17])
      expect(submitted.map(op => op.targetLength)).to.deep.equal([14, 17, 20])
    })

    it('should base the operation correctly even when the current user is not tracking changes', function () {
      // Tracked deletes can already be in the snapshot from an earlier session
      // while the current user has tracking off; the base length must still
      // account for them.
      const { submitted, edit } = setup(trailingDelete(), {
        trackChangesEnabled: false,
      })

      edit({ changes: { from: 6, insert: 'ABC' } })

      expect(submitted).to.have.length(1)
      const op = submitted[0]
      expect(op.baseLength).to.equal(11)
      expect(op.targetLength).to.equal(14)
      // Plain insert (no tracking) because the current user is not tracking.
      expect(op.toJSON().textOperation).to.deep.equal([6, 'ABC', 5])
    })
  })

  describe('with tracked deletes spread across the document', function () {
    it('should include every tracked delete in the operation base length', function () {
      // "aaa bbb ccc" with the middle and last words tracked-deleted: visible
      // "aaa  " (5 chars) over an 11-char snapshot, 6 chars deleted in two runs.
      const snapshot = snapshotWithTrackedDeletes('aaa bbb ccc', [
        { pos: 4, length: 3 },
        { pos: 8, length: 3 },
      ])
      expect(snapshot.getContent({ filterTrackedDeletes: true })).to.equal(
        'aaa  '
      )

      const { submitted, edit } = setup(snapshot)

      edit({ changes: { from: 5, insert: 'END' } })

      expect(submitted).to.have.length(1)
      const op = submitted[0]
      // 5 visible + 6 deleted = 11, not the toSnapshot under-count.
      expect(op.baseLength).to.equal(11)
      expect(op.targetLength).to.equal(14)
    })
  })
})
