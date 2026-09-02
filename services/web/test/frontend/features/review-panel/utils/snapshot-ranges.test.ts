import { expect } from 'chai'
import {
  AddCommentOperation,
  Range,
  StringFileData,
  TextOperation,
  TrackingProps,
} from 'overleaf-editor-core'
import { buildRangesFromSnapshot } from '../../../../../frontend/js/features/review-panel/utils/snapshot-ranges'

describe('buildRangesFromSnapshot', function () {
  it('includes anchored comments', function () {
    const snapshot = new StringFileData('hello world')
    new AddCommentOperation('c1', [new Range(0, 5)]).apply(snapshot)

    const ranges = buildRangesFromSnapshot(snapshot, 'doc1')

    expect(ranges.comments).to.have.length(1)
    expect(ranges.comments[0].id).to.equal('c1')
  })

  it('skips detached comments without throwing', function () {
    const snapshot = new StringFileData('hello world')
    new AddCommentOperation('c1', [new Range(0, 5)]).apply(snapshot)

    // delete the commented text; the comment detaches (its ranges empty out)
    const op = new TextOperation()
    op.remove(5)
    op.retain(6)
    snapshot.edit(op)
    expect(snapshot.getComments().toArray()[0].isEmpty()).to.be.true

    const ranges = buildRangesFromSnapshot(snapshot, 'doc1')

    expect(ranges.comments).to.have.length(0)
  })

  it('maps comment text containing a tracked delete', function () {
    const snapshot = new StringFileData('one two three')

    // track-delete "two " inside the comment: both comment ends need mapping
    // and the snippet must come from the visible content
    const op = new TextOperation()
    op.retain(4)
    op.retain(4, {
      tracking: new TrackingProps(
        'delete',
        'user-1',
        new Date('2025-01-01T00:00:00.000Z')
      ),
    })
    op.retain(5)
    snapshot.edit(op)

    new AddCommentOperation('c1', [new Range(0, 13)]).apply(snapshot)

    const ranges = buildRangesFromSnapshot(snapshot, 'doc1')

    expect(ranges.comments).to.have.length(1)
    expect(ranges.comments[0].op.p).to.equal(0)
    expect(ranges.comments[0].op.c).to.equal('one three')
  })

  it('maps comment position and text past a tracked delete', function () {
    const snapshot = new StringFileData('one two three')

    // track-delete "one ": the characters stay in the snapshot but are hidden
    // from CodeMirror, so the two coordinate spaces diverge by 4
    const op = new TextOperation()
    op.retain(4, {
      tracking: new TrackingProps(
        'delete',
        'user-1',
        new Date('2025-01-01T00:00:00.000Z')
      ),
    })
    op.retain(9)
    snapshot.edit(op)

    new AddCommentOperation('c1', [new Range(8, 5)]).apply(snapshot)

    const ranges = buildRangesFromSnapshot(snapshot, 'doc1')

    expect(ranges.comments).to.have.length(1)
    expect(ranges.comments[0].op.p).to.equal(4)
    expect(ranges.comments[0].op.c).to.equal('three')
  })
})
