import { expect } from 'chai'
import sinon from 'sinon'
import { ShareJsDoc } from '@/features/ide-react/editor/share-js-doc'
import EditorWatchdogManager from '@/features/ide-react/connection/editor-watchdog-manager'
import { Socket } from '@/features/ide-react/connection/types/socket'
import { IdeEventEmitter } from '@/features/ide-react/create-ide-event-emitter'
import { ShareJsOperation } from '@/features/ide-react/editor/types/document'
import { OfflineDocBackupRecord } from '@/features/ide-react/editor/offline-doc-backup'

const DOC_ID = 'doc-1'

function makeDoc(version = 5) {
  const socket = { emit: sinon.stub(), publicId: 'client-1' }
  const globalWatchdog = new EditorWatchdogManager({
    onTimeoutHandler: () => {},
  })
  const doc = new ShareJsDoc(
    DOC_ID,
    [],
    version,
    socket as unknown as Socket,
    globalWatchdog,
    { emit() {} } as unknown as IdeEventEmitter,
    'sharejs-text-ot'
  )
  return { doc, socket }
}

function makeBackup(
  overrides: Partial<OfflineDocBackupRecord> = {}
): OfflineDocBackupRecord {
  return {
    docId: DOC_ID,
    projectId: 'project-1',
    version: 5,
    snapshot: '',
    inflightOp: null,
    pendingOp: null,
    trackChanges: false,
    updatedAt: 0,
    inflightSubmittedIds: [],
    ...overrides,
  }
}

describe('ShareJsDoc offline recovery', function () {
  let clock: sinon.SinonFakeTimers

  beforeEach(function () {
    window.metaAttributesCache = new Map()
    clock = sinon.useFakeTimers()
  })

  afterEach(function () {
    clock.restore()
  })

  describe('restoreFromOfflineBackup', function () {
    it('rebuilds the local view from the baseline plus the buffered ops', function () {
      const { doc } = makeDoc(5)
      doc.restoreFromOfflineBackup(
        makeBackup({
          snapshot: 'ab',
          inflightOp: [{ i: 'X', p: 0 }] as ShareJsOperation,
          pendingOp: [{ i: 'Y', p: 3 }] as ShareJsOperation,
          inflightSubmittedIds: ['old-client'],
        })
      )

      // baseline 'ab' -> inflight inserts 'X' at 0 -> 'Xab' -> pending inserts
      // 'Y' at 3 -> 'XabY'
      expect(doc.getSnapshot()).to.equal('XabY')
      expect(doc.getVersion()).to.equal(5)
      expect(doc.getInflightOp()).to.deep.equal([{ i: 'X', p: 0 }])
      expect(doc.getPendingOp()).to.deep.equal([{ i: 'Y', p: 3 }])
      expect(Array.from(doc.getInflightSubmittedIds())).to.deep.equal([
        'old-client',
      ])
    })

    it('keeps the baseline snapshot when there are no buffered ops', function () {
      const { doc } = makeDoc()
      doc.restoreFromOfflineBackup(makeBackup({ snapshot: 'ab' }))

      expect(doc.getSnapshot()).to.equal('ab')
      expect(doc.getInflightOp()).to.equal(null)
      expect(doc.getPendingOp()).to.equal(null)
    })

    it('applies a lone inflight or pending op', function () {
      const inflightOnly = makeDoc()
      inflightOnly.doc.restoreFromOfflineBackup(
        makeBackup({
          snapshot: 'ab',
          inflightOp: [{ i: 'X', p: 0 }] as ShareJsOperation,
        })
      )
      expect(inflightOnly.doc.getSnapshot()).to.equal('Xab')

      const pendingOnly = makeDoc()
      pendingOnly.doc.restoreFromOfflineBackup(
        makeBackup({
          snapshot: 'ab',
          pendingOp: [{ i: 'Y', p: 2 }] as ShareJsOperation,
        })
      )
      expect(pendingOnly.doc.getSnapshot()).to.equal('abY')
    })
  })

  describe('sendRecoveredOps', function () {
    it('resends a surviving inflight op with dupIfSource', function () {
      const { doc, socket } = makeDoc(5)
      doc.restoreFromOfflineBackup(
        makeBackup({
          snapshot: 'ab',
          inflightOp: [{ i: 'X', p: 0 }] as ShareJsOperation,
          pendingOp: [{ i: 'Y', p: 3 }] as ShareJsOperation,
          inflightSubmittedIds: ['old-client'],
        })
      )
      socket.emit.resetHistory()

      doc.sendRecoveredOps()

      expect(socket.emit).to.have.been.calledOnce
      const [event, docId, update] = socket.emit.getCall(0).args
      expect(event).to.equal('applyOtUpdate')
      expect(docId).to.equal(DOC_ID)
      expect(update.op).to.deep.equal([{ i: 'X', p: 0 }])
      expect(update.v).to.equal(5)
      expect(update.dupIfSource).to.deep.equal(['old-client'])
    })

    it('flushes the pending op when nothing is inflight', function () {
      const { doc, socket } = makeDoc()
      doc.restoreFromOfflineBackup(
        makeBackup({
          snapshot: 'ab',
          pendingOp: [{ i: 'Y', p: 2 }] as ShareJsOperation,
        })
      )
      socket.emit.resetHistory()

      doc.sendRecoveredOps()

      expect(socket.emit).to.have.been.calledOnce
      const [event, , update] = socket.emit.getCall(0).args
      expect(event).to.equal('applyOtUpdate')
      expect(update.op).to.deep.equal([{ i: 'Y', p: 2 }])
    })

    it('drops an inflight op that cancelled out and flushes the pending op instead', function () {
      const { doc, socket } = makeDoc(5)
      // An inflight op that transformed away during catch-up is left as an empty
      // op list rather than null.
      doc.restoreFromOfflineBackup(
        makeBackup({
          snapshot: 'ab',
          inflightOp: [] as unknown as ShareJsOperation,
          pendingOp: [{ i: 'Y', p: 2 }] as ShareJsOperation,
          inflightSubmittedIds: ['old-client'],
        })
      )
      socket.emit.resetHistory()

      doc.sendRecoveredOps()

      // The empty inflight op is never sent (the server rejects zero-length
      // ops); the pending op is flushed instead.
      expect(socket.emit).to.have.been.calledOnce
      const [event, , update] = socket.emit.getCall(0).args
      expect(event).to.equal('applyOtUpdate')
      expect(update.op).to.deep.equal([{ i: 'Y', p: 2 }])
      // The cancelled op's stale dedup ids are cleared so they don't leak onto
      // the flushed pending op.
      expect(Array.from(doc.getInflightSubmittedIds())).to.deep.equal([])
    })

    it('sends nothing when there are no buffered ops', function () {
      const { doc, socket } = makeDoc()
      doc.restoreFromOfflineBackup(makeBackup({ snapshot: 'ab' }))
      socket.emit.resetHistory()

      doc.sendRecoveredOps()

      expect(socket.emit).to.not.have.been.called
    })
  })

  describe('catchUp', function () {
    // A remote delete that doesn't match the snapshot throws when applied; this
    // stands in for any replay failure during catch-up. catchUp overwrites `v`,
    // and `meta` just needs to be present so the op isn't mistaken for an ack.
    const failingUpdate = {
      v: 0,
      op: [{ d: 'ZZ', p: 0 }],
      meta: {},
    }

    function makeRestoredDoc() {
      const { doc } = makeDoc(5)
      doc.restoreFromOfflineBackup(makeBackup({ snapshot: 'ab' }))
      return doc
    }

    it('rethrows a replay failure when asked, so recovery can fall back', function () {
      const doc = makeRestoredDoc()

      expect(() => doc.catchUp([failingUpdate], { rethrow: true })).to.throw()
    })

    it('reports a replay failure via the error event and swallows it by default', function () {
      const doc = makeRestoredDoc()
      const onError = sinon.stub()
      doc.on('error', onError)

      expect(() => doc.catchUp([failingUpdate])).to.not.throw()
      expect(onError).to.have.been.called
    })
  })
})
