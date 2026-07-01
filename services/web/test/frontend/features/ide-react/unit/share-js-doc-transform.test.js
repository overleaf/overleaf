import { expect } from 'chai'
import sinon from 'sinon'
import sharejs, { Doc } from '@/vendor/libs/sharejs'

// When client ops are rebased on top of remote (or inverted/undo) ops via
// `Doc._xf`, a local delete that fully overlaps the other op cancels out and the
// transform produces an empty op list (`[]`).
//
// A *pending* op that cancels this way has not been sent yet, so the Doc drops it
// to `null` rather than leaving an empty `[]`. This means:
//   - hasBufferedOps() (inflightOp != null || pendingOp != null) does not report a
//     phantom buffered op, and `saved` is emitted as soon as the doc is in sync, so
//     OpenDocuments.awaitBufferedOps resolves.
//   - flush() does not rotate/send an empty op to the server.
//   - the dropped op's submit callbacks are resolved with success (it completed as
//     a no-op), rather than being lost.
// An *inflight* op that cancels was already sent as a real op, so it stays `[]`: it
// keeps blocking flush() until its ack arrives (preserving the one-inflight
// invariant) and self-heals on that ack. It is never re-sent in the normal flow.
//
// Each test drives the scenario until the doc fully drains (hasBufferedOps() ===
// false), pins the lifecycle events (flipped_pending_to_inflight / acknowledge /
// saved), and asserts that no empty op is ever sent to the server.
//
// Coverage: the remote-op branch of _onMessage transforms inflight (if present) then
// pending (if present); the rejection branch transforms only pending by the inverted
// undo. These tests cover every combination in which a transform can empty an op:
//   - inflight emptied / pending none ........ "empties inflightOp ... (pending empty)"
//   - inflight emptied / pending emptied ..... "empties inflightOp and drops pendingOp ..."
//   - inflight emptied / pending survives .... "empties inflightOp while pendingOp stays valid"
//   - inflight survives / pending emptied .... "drops pendingOp ... leaving inflightOp intact"
//   - inflight none / pending emptied ........ "drops pendingOp with no inflight op"
//   - rejection / pending emptied ............ "drops pendingOp when the inverted undo ..."
//   - rejection / pending survives ........... "keeps a valid pendingOp when the inverted undo ..."

// A minimal stand-in for the realtime Connection. The Doc only uses `send`,
// `state` and `id` (see services/web/frontend/js/features/ide-react/editor/share-js-doc.ts).
class MockConnection {
  constructor() {
    this.sent = []
    this.state = 'ok'
    this.id = 'client-1'
  }

  send(msg) {
    this.sent.push(msg)
  }
}

describe('ShareJS Doc empty operation transforms', function () {
  let clock

  beforeEach(function () {
    clock = sinon.useFakeTimers()
  })

  afterEach(function () {
    clock.restore()
  })

  // Mirrors how ShareJsDoc holds/initializes a Doc: construct with the OT type,
  // set the collaborative flush delay, then open it via an `open` message which
  // sets state/version/snapshot.
  function makeDoc(snapshot = 'foo', version = 0) {
    const connection = new MockConnection()
    const doc = new Doc(connection, 'doc-1', { type: sharejs.types.text })
    doc.setFlushDelay(500) // MULTI_USER_FLUSH_DELAY, the collaborative delay
    doc._onMessage({ open: true, v: version, snapshot })
    return { doc, connection }
  }

  // Simulate a remote op arriving from another client. `meta` is required: the
  // ack-detection branch in _onMessage dereferences `msg.meta.source`.
  function remote(doc, op, v) {
    doc._onMessage({ doc: 'doc-1', op, v, meta: { source: 'other-client' } })
  }

  // Mirrors ShareJsDoc.hasBufferedOps (share-js-doc.ts).
  function hasBufferedOps(doc) {
    return doc.inflightOp != null || doc.pendingOp != null
  }

  // Ack the current inflight op the way the server would: an op-less message at
  // the doc's current version.
  function ack(doc) {
    doc._onMessage({ doc: 'doc-1', v: doc.version })
  }

  // Record the buffered-op lifecycle events, in order, into the returned array.
  //   - flipped_pending_to_inflight: one per flush/send
  //   - acknowledge: per successful ack (not on rejection)
  //   - saved: emitted once the doc has no buffered ops
  function recordEvents(doc) {
    const events = []
    for (const name of [
      'flipped_pending_to_inflight',
      'acknowledge',
      'saved',
    ]) {
      doc.on(name, () => events.push(name))
    }
    return events
  }

  // Assert that every op sent to the server was non-empty.
  function expectNoEmptyOpsSent(connection) {
    for (const msg of connection.sent) {
      expect(msg.op.length, 'sent an empty op').to.be.greaterThan(0)
    }
  }

  it('empties inflightOp when a remote op cancels it (pending empty)', function () {
    const { doc, connection } = makeDoc('foo')
    const events = recordEvents(doc)

    doc.submitOp([{ d: 'f', p: 0 }])
    clock.tick(500) // flush: pending -> inflight
    expect(doc.inflightOp).to.deep.equal([{ d: 'f', p: 0 }])
    expect(doc.pendingOp).to.equal(null)

    // Remote client deletes the whole word, fully overlapping the inflight delete.
    remote(doc, [{ d: 'foo', p: 0 }], 0)

    expect(doc.inflightOp).to.deep.equal([])
    expect(doc.pendingOp).to.equal(null)
    // The op is still inflight, so `saved` has not fired yet.
    expect(events).to.deep.equal(['flipped_pending_to_inflight'])

    // --- flushes eventually ---
    // The emptied inflight op still reports as buffered.
    expect(hasBufferedOps(doc)).to.equal(true)
    // A flush sends nothing new: the (now empty) op is still inflight, and the
    // real op was already sent before it was emptied.
    const sentBefore = connection.sent.length
    clock.tick(500)
    expect(connection.sent.length).to.equal(sentBefore)
    // The already-sent op is acknowledged by the server, clearing the inflight
    // slot. With nothing pending, the doc is fully drained.
    ack(doc)
    expect(doc.inflightOp).to.equal(null)
    expect(doc.pendingOp).to.equal(null)
    expect(hasBufferedOps(doc)).to.equal(false)
    expect(events).to.deep.equal([
      'flipped_pending_to_inflight',
      'saved',
      'acknowledge',
    ])
    expectNoEmptyOpsSent(connection)
  })

  it('drops pendingOp when a remote op cancels it, leaving inflightOp intact', function () {
    const { doc, connection } = makeDoc('foo')
    const events = recordEvents(doc)

    // Alice appends `bar` and it goes inflight.
    doc.submitOp([{ i: 'bar', p: 3 }])
    clock.tick(500)
    expect(doc.inflightOp).to.deep.equal([{ i: 'bar', p: 3 }])

    // While the append is inflight, Alice deletes `f` (stays pending).
    doc.submitOp([{ d: 'f', p: 0 }])
    expect(doc.pendingOp).to.deep.equal([{ d: 'f', p: 0 }])

    // Bob's removal of `foo` arrives and cancels Alice's pending delete.
    remote(doc, [{ d: 'foo', p: 0 }], 0)

    // The inflight insert survives the transform (its position shifts); the pending
    // delete fully cancels and is dropped to null (not left as an empty `[]`).
    expect(doc.inflightOp).to.deep.equal([{ i: 'bar', p: 0 }])
    expect(doc.pendingOp).to.equal(null)
    // The inflight op still survives, so no `saved` yet; only the initial flush.
    expect(events).to.deep.equal(['flipped_pending_to_inflight'])

    // --- flushes eventually ---
    expect(hasBufferedOps(doc)).to.equal(true)
    // Acking the inflight insert now finds pendingOp === null, so it emits `saved`
    // and the doc is fully drained. No empty op was flushed or sent.
    ack(doc)
    expect(doc.inflightOp).to.equal(null)
    expect(doc.pendingOp).to.equal(null)
    expect(hasBufferedOps(doc)).to.equal(false)
    expect(events).to.deep.equal([
      'flipped_pending_to_inflight',
      'saved',
      'acknowledge',
    ])
    expectNoEmptyOpsSent(connection)
  })

  it('empties inflightOp and drops pendingOp from a single remote op', function () {
    const { doc, connection } = makeDoc('foo')
    const events = recordEvents(doc)

    doc.submitOp([{ d: 'f', p: 0 }])
    clock.tick(500) // inflight: delete `f` -> snapshot `oo`
    expect(doc.inflightOp).to.deep.equal([{ d: 'f', p: 0 }])

    doc.submitOp([{ d: 'o', p: 0 }]) // pending: delete `o` -> snapshot `o`
    expect(doc.pendingOp).to.deep.equal([{ d: 'o', p: 0 }])

    // Remote delete of `foo` cancels the inflight `f`; the remainder (`oo`) then
    // cancels the pending `o`.
    remote(doc, [{ d: 'foo', p: 0 }], 0)

    // The inflight op was already sent, so it stays as an empty `[]` (occupying the
    // inflight slot until acked); the pending op is dropped to null.
    expect(doc.inflightOp).to.deep.equal([])
    expect(doc.pendingOp).to.equal(null)
    // The empty inflight op is still buffered, so no `saved` yet.
    expect(events).to.deep.equal(['flipped_pending_to_inflight'])

    // --- flushes eventually ---
    expect(hasBufferedOps(doc)).to.equal(true)
    // Acking the (already-sent, now empty) inflight op finds pendingOp === null and
    // emits `saved`; the doc is fully drained. No empty op was flushed or sent.
    ack(doc)
    expect(doc.inflightOp).to.equal(null)
    expect(doc.pendingOp).to.equal(null)
    expect(hasBufferedOps(doc)).to.equal(false)
    expect(events).to.deep.equal([
      'flipped_pending_to_inflight',
      'saved',
      'acknowledge',
    ])
    expectNoEmptyOpsSent(connection)
  })

  it('drops pendingOp when the inverted undo of a rejected op cancels it', function () {
    const { doc, connection } = makeDoc('foo')
    const events = recordEvents(doc)

    // Insert `x`, it goes inflight.
    doc.submitOp([{ i: 'x', p: 0 }])
    clock.tick(500)
    expect(doc.inflightOp).to.deep.equal([{ i: 'x', p: 0 }])

    // Pending op deletes that same `x`, with a submit callback attached.
    const submitCallback = sinon.spy()
    doc.submitOp([{ d: 'x', p: 0 }], submitCallback)
    expect(doc.pendingOp).to.deep.equal([{ d: 'x', p: 0 }])

    // Server rejects the inflight insert. The undo (invert) is `delete x`, which is
    // transformed against the pending delete and cancels it out. The inflight op is
    // cleared, and the pending op is dropped to null (not left as an empty `[]`);
    // with nothing left to send, the rejection handler emits `saved` and resolves
    // the dropped op's submit callback.
    doc._onMessage({ doc: 'doc-1', v: 0, error: 'rejected' })

    expect(doc.inflightOp).to.equal(null)
    expect(doc.pendingOp).to.equal(null)
    expect(hasBufferedOps(doc)).to.equal(false)
    // The rejection emits no `acknowledge`; `saved` fires because the pending op
    // was dropped, leaving the doc in sync.
    expect(events).to.deep.equal(['flipped_pending_to_inflight', 'saved'])
    // The dropped op's submit callback is resolved immediately (success).
    expect(submitCallback).to.have.been.calledOnceWith(null)

    // --- flushes eventually ---
    // Nothing is buffered, so the next flush sends nothing (no empty op).
    const sentBefore = connection.sent.length
    clock.tick(500)
    expect(connection.sent.length).to.equal(sentBefore)
    expect(doc.inflightOp).to.equal(null)
    expect(doc.pendingOp).to.equal(null)
    expect(hasBufferedOps(doc)).to.equal(false)
    expect(events).to.deep.equal(['flipped_pending_to_inflight', 'saved'])
    expectNoEmptyOpsSent(connection)
  })

  it('empties inflightOp while pendingOp stays valid', function () {
    const { doc, connection } = makeDoc('foo')
    const events = recordEvents(doc)

    // Delete `f` goes inflight (snapshot `foo` -> `oo`).
    doc.submitOp([{ d: 'f', p: 0 }])
    clock.tick(500)
    expect(doc.inflightOp).to.deep.equal([{ d: 'f', p: 0 }])

    // Insert `X` at the end stays pending (snapshot `oo` -> `ooX`).
    doc.submitOp([{ i: 'X', p: 2 }])
    expect(doc.pendingOp).to.deep.equal([{ i: 'X', p: 2 }])

    // Remote delete of `foo` cancels the inflight `f`; the remaining `oo` shifts
    // the pending insert, which survives.
    remote(doc, [{ d: 'foo', p: 0 }], 0)

    expect(doc.inflightOp).to.deep.equal([])
    expect(doc.pendingOp).to.deep.equal([{ i: 'X', p: 0 }])
    // Only the initial flush has happened so far; the emptied inflight op and the
    // surviving pending op emit nothing here.
    expect(events).to.deep.equal(['flipped_pending_to_inflight'])

    // --- flushes eventually ---
    expect(hasBufferedOps(doc)).to.equal(true)
    // Acking the (already-sent, now empty) inflight op leaves the still-valid
    // pending op, so `saved` is suppressed.
    ack(doc)
    expect(doc.inflightOp).to.equal(null)
    expect(doc.pendingOp).to.deep.equal([{ i: 'X', p: 0 }])
    expect(hasBufferedOps(doc)).to.equal(true)
    // The next flush sends the real (non-empty) pending op to the server.
    clock.tick(500)
    expect(connection.sent[connection.sent.length - 1].op).to.deep.equal([
      { i: 'X', p: 0 },
    ])
    expect(doc.inflightOp).to.deep.equal([{ i: 'X', p: 0 }])
    // Acking the real op drains the doc.
    ack(doc)
    expect(hasBufferedOps(doc)).to.equal(false)
    expect(events).to.deep.equal([
      'flipped_pending_to_inflight',
      'acknowledge',
      'flipped_pending_to_inflight',
      'saved',
      'acknowledge',
    ])
    expectNoEmptyOpsSent(connection)
  })

  it('drops pendingOp with no inflight op', function () {
    const { doc, connection } = makeDoc('foo')
    const events = recordEvents(doc)

    // Delete `f` stays pending (never flushed, so nothing is inflight), with a
    // submit callback attached.
    const submitCallback = sinon.spy()
    doc.submitOp([{ d: 'f', p: 0 }], submitCallback)
    expect(doc.inflightOp).to.equal(null)
    expect(doc.pendingOp).to.deep.equal([{ d: 'f', p: 0 }])

    // Remote delete of `foo` cancels the pending delete.
    remote(doc, [{ d: 'foo', p: 0 }], 0)

    // With no inflight op, the cancelled pending op is dropped to null and, since
    // the doc is now fully in sync, `saved` is emitted immediately and the submit
    // callback is resolved.
    expect(doc.inflightOp).to.equal(null)
    expect(doc.pendingOp).to.equal(null)
    expect(hasBufferedOps(doc)).to.equal(false)
    expect(events).to.deep.equal(['saved'])
    expect(submitCallback).to.have.been.calledOnceWith(null)

    // --- flushes eventually ---
    // Nothing is buffered, so the next flush sends nothing (no empty op).
    const sentBefore = connection.sent.length
    clock.tick(500)
    expect(connection.sent.length).to.equal(sentBefore)
    expect(doc.inflightOp).to.equal(null)
    expect(doc.pendingOp).to.equal(null)
    expect(hasBufferedOps(doc)).to.equal(false)
    expect(events).to.deep.equal(['saved'])
    expectNoEmptyOpsSent(connection)
  })

  it('keeps a valid pendingOp when the inverted undo of a rejected op shifts it', function () {
    const { doc, connection } = makeDoc('foo')
    const events = recordEvents(doc)

    // Insert `x` at the start goes inflight (snapshot `foo` -> `xfoo`).
    doc.submitOp([{ i: 'x', p: 0 }])
    clock.tick(500)
    expect(doc.inflightOp).to.deep.equal([{ i: 'x', p: 0 }])

    // Insert `y` at the end stays pending (snapshot `xfoo` -> `xfooy`).
    doc.submitOp([{ i: 'y', p: 4 }])
    expect(doc.pendingOp).to.deep.equal([{ i: 'y', p: 4 }])

    // Server rejects the inflight insert. The undo (invert) is `delete x`, which
    // transforms the pending insert: it survives but shifts left by one.
    doc._onMessage({ doc: 'doc-1', v: 0, error: 'rejected' })

    expect(doc.inflightOp).to.equal(null)
    expect(doc.pendingOp).to.deep.equal([{ i: 'y', p: 3 }])
    // A rejection emits neither `acknowledge` nor `saved`.
    expect(events).to.deep.equal(['flipped_pending_to_inflight'])

    // --- flushes eventually ---
    expect(hasBufferedOps(doc)).to.equal(true)
    // The surviving pending op is flushed and sent as a real (non-empty) op.
    clock.tick(500)
    expect(connection.sent[connection.sent.length - 1].op).to.deep.equal([
      { i: 'y', p: 3 },
    ])
    expect(doc.inflightOp).to.deep.equal([{ i: 'y', p: 3 }])
    // Acking the real op drains the doc.
    ack(doc)
    expect(hasBufferedOps(doc)).to.equal(false)
    expect(events).to.deep.equal([
      'flipped_pending_to_inflight',
      'flipped_pending_to_inflight',
      'saved',
      'acknowledge',
    ])
    expectNoEmptyOpsSent(connection)
  })

  // An inflight op that cancels to `[]` was already sent, so it stays `[]` until
  // acked. If the connection drops and reopens before that ack, the reconnect
  // handler (_onMessage with open: true) drops the emptied inflight op rather than
  // resending an empty `{ op: [] }`: it resolves the op's callbacks and flushes any
  // pending op normally.
  describe('reconnecting with an emptied inflight op', function () {
    it('drops the emptied inflight op when there is no pending op', function () {
      const { doc, connection } = makeDoc('foo')
      const events = recordEvents(doc)
      const submitCallback = sinon.spy()

      // Delete `f` is submitted, flushed inflight, and sent.
      doc.submitOp([{ d: 'f', p: 0 }], submitCallback)
      clock.tick(500)
      expect(doc.inflightOp).to.deep.equal([{ d: 'f', p: 0 }])

      // A remote delete of `foo` cancels the inflight delete to an empty op.
      remote(doc, [{ d: 'foo', p: 0 }], 0)
      expect(doc.inflightOp).to.deep.equal([])
      expect(doc.pendingOp).to.equal(null)

      // The connection drops and reopens before the inflight op was acked.
      doc._connectionStateChanged('disconnected')
      const sentBefore = connection.sent.length
      doc._onMessage({ doc: 'doc-1', open: true, v: doc.version })

      // The emptied inflight op is dropped rather than resent: nothing is sent, the
      // doc is fully drained, and the submit callback is resolved.
      expect(connection.sent.length).to.equal(sentBefore)
      expect(doc.inflightOp).to.equal(null)
      expect(doc.pendingOp).to.equal(null)
      expect(hasBufferedOps(doc)).to.equal(false)
      expect(events).to.deep.equal(['flipped_pending_to_inflight', 'saved'])
      expect(submitCallback).to.have.been.calledOnceWith(null)
      expectNoEmptyOpsSent(connection)
    })

    it('drops the emptied inflight op and flushes the pending op', function () {
      const { doc, connection } = makeDoc('foo')
      const events = recordEvents(doc)
      const submitCallback = sinon.spy()

      // Delete `f` is submitted, flushed inflight, and sent (snapshot `oo`).
      doc.submitOp([{ d: 'f', p: 0 }], submitCallback)
      clock.tick(500)
      expect(doc.inflightOp).to.deep.equal([{ d: 'f', p: 0 }])

      // Insert `X` is submitted and stays pending (snapshot `oo` -> `ooX`).
      doc.submitOp([{ i: 'X', p: 2 }])
      expect(doc.pendingOp).to.deep.equal([{ i: 'X', p: 2 }])

      // A remote delete of `foo` cancels the inflight delete to empty; the pending
      // insert survives (shifted left).
      remote(doc, [{ d: 'foo', p: 0 }], 0)
      expect(doc.inflightOp).to.deep.equal([])
      expect(doc.pendingOp).to.deep.equal([{ i: 'X', p: 0 }])

      // Disconnect + reopen before the inflight op was acked.
      doc._connectionStateChanged('disconnected')
      const sentBefore = connection.sent.length
      doc._onMessage({ doc: 'doc-1', open: true, v: doc.version })

      // The emptied inflight op is dropped (resolving its callback) rather than
      // resent; the surviving pending op is flushed as a real (non-empty) op.
      expect(connection.sent.length).to.equal(sentBefore + 1)
      expect(connection.sent[connection.sent.length - 1].op).to.deep.equal([
        { i: 'X', p: 0 },
      ])
      expect(doc.inflightOp).to.deep.equal([{ i: 'X', p: 0 }])
      expect(doc.pendingOp).to.equal(null)
      expect(events).to.deep.equal([
        'flipped_pending_to_inflight',
        'flipped_pending_to_inflight',
      ])
      expect(submitCallback).to.have.been.calledOnceWith(null)

      // Acking the real op drains the doc.
      ack(doc)
      expect(doc.inflightOp).to.equal(null)
      expect(doc.pendingOp).to.equal(null)
      expect(hasBufferedOps(doc)).to.equal(false)
      expect(events).to.deep.equal([
        'flipped_pending_to_inflight',
        'flipped_pending_to_inflight',
        'saved',
        'acknowledge',
      ])
      expectNoEmptyOpsSent(connection)
    })
  })
})
