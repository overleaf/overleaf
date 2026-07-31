import { expect } from 'chai'
import sinon from 'sinon'
import EventEmitter from '@/utils/EventEmitter'
import {
  OfflineDocBackup,
  OfflineDocBackupRecord,
} from '@/features/ide-react/editor/offline-doc-backup'
import { ShareJsOperation } from '@/features/ide-react/editor/types/document'
import { OTType, ShareJsDoc } from '@/features/ide-react/editor/share-js-doc'
import { IdeEventEmitter } from '@/features/ide-react/create-ide-event-emitter'

const DOC_ID = 'doc-123'
const OTHER_DOC_ID = 'doc-999'
const PROJECT_ID = 'project-456'
const USER_ID = 'user-789'
const KEY = `doc.offline-backup.${USER_ID}.${PROJECT_ID}.${DOC_ID}`
const FLUSH_DELAY = 2000
const STALL_AFTER_MS = 10000
const SYNCED_EVENT = 'ide:offlineChangesSynced'

class FakeShareJsDoc extends EventEmitter {
  doc_id: string
  connection = {
    state: 'ok' as 'ok' | 'disconnected' | 'stopped',
    id: 'client-1',
  }
  version = 5
  snapshot = 'server text'
  inflightOp: ShareJsOperation | null = null
  pendingOp: ShareJsOperation | null = null
  inflightOpCreatedAt: number | null = null
  pendingOpCreatedAt: number | null = null
  track_changes = false
  otType: OTType = 'sharejs-text-ot'
  _doc = { inflightSubmittedIds: new Set<string>() }

  constructor(docId = DOC_ID) {
    super()
    this.doc_id = docId
  }

  getVersion() {
    return this.version
  }

  getSnapshot() {
    return this.snapshot
  }

  getType() {
    return this.otType
  }

  hasBufferedOps() {
    return this.inflightOp != null || this.pendingOp != null
  }

  getInflightOp() {
    return this.inflightOp
  }

  getPendingOp() {
    return this.pendingOp
  }

  getInflightOpCreatedAt() {
    return this.inflightOpCreatedAt
  }

  getPendingOpCreatedAt() {
    return this.pendingOpCreatedAt
  }

  getInflightSubmittedIds() {
    return this._doc.inflightSubmittedIds
  }
}

function readRecord(): OfflineDocBackupRecord | null {
  const raw = window.sessionStorage.getItem(KEY)
  return raw === null ? null : JSON.parse(raw)
}

describe('OfflineDocBackup', function () {
  let clock: sinon.SinonFakeTimers
  let doc: FakeShareJsDoc
  let eventEmitter: IdeEventEmitter
  let syncedEvents: { docId: string }[]

  const enableFlag = (enabled = true) => {
    window.metaAttributesCache.set('ol-splitTestVariants', {
      'intermittent-connection-improvements': enabled ? 'enabled' : 'default',
    })
  }

  const create = (target: FakeShareJsDoc = doc) =>
    new OfflineDocBackup(
      target as unknown as ShareJsDoc,
      PROJECT_ID,
      eventEmitter
    )

  beforeEach(function () {
    window.metaAttributesCache = new Map()
    window.metaAttributesCache.set('ol-user_id', USER_ID)
    window.sessionStorage.clear()
    clock = sinon.useFakeTimers()
    doc = new FakeShareJsDoc()
    eventEmitter = new IdeEventEmitter()
    syncedEvents = []
    eventEmitter.on(SYNCED_EVENT, event => {
      syncedEvents.push(event.detail[0])
    })
    enableFlag()
  })

  afterEach(function () {
    clock.restore()
    window.sessionStorage.clear()
  })

  const goOffline = (target: FakeShareJsDoc = doc) => {
    target.connection.state = 'disconnected'
  }

  // Drives one offline outage on the given doc: buffer an edit, let the
  // throttled write land, then have the server acknowledge it.
  const editOfflineThenSave = (target: FakeShareJsDoc) => {
    goOffline(target)
    target.pendingOp = [{ i: 'x', p: 0 }]
    target.trigger('change')
    clock.tick(FLUSH_DELAY)
    target.connection.state = 'ok'
    target.pendingOp = null
    target.trigger('saved')
  }

  it('does nothing when the split test is disabled', function () {
    enableFlag(false)
    const backup = create()
    goOffline()
    doc.pendingOp = [{ i: 'x', p: 0 }]
    doc.trigger('change')
    clock.tick(FLUSH_DELAY)
    expect(readRecord()).to.be.null
    backup.disconnect()
  })

  it('does not write while online', function () {
    create()
    doc.pendingOp = [{ i: 'x', p: 0 }]
    doc.trigger('change')
    clock.tick(FLUSH_DELAY)
    expect(readRecord()).to.be.null
  })

  it('does not write when offline with no buffered ops', function () {
    create()
    goOffline()
    doc.trigger('change')
    clock.tick(FLUSH_DELAY)
    expect(readRecord()).to.be.null
  })

  it('backs up while still connected once saving stalls past the threshold', function () {
    create()
    doc.pendingOp = [{ i: 'x', p: 0 }]
    doc.pendingOpCreatedAt = performance.now() - (STALL_AFTER_MS + 1000)
    doc.trigger('change')
    clock.tick(FLUSH_DELAY)

    expect(doc.connection.state).to.equal('ok')
    expect(readRecord()?.pendingOp).to.deep.equal([{ i: 'x', p: 0 }])
  })

  it('does not back up while connected and within the stall threshold', function () {
    create()
    doc.pendingOp = [{ i: 'x', p: 0 }]
    doc.pendingOpCreatedAt = performance.now() - (STALL_AFTER_MS - 5000)
    doc.trigger('change')
    clock.tick(FLUSH_DELAY)

    expect(readRecord()).to.be.null
  })

  it('uses the inflight op age (the oldest) to detect a stall', function () {
    create()
    doc.inflightOp = [{ i: 'sent', p: 0 }]
    doc.inflightOpCreatedAt = performance.now() - (STALL_AFTER_MS + 1000)
    doc.pendingOp = [{ i: 'queued', p: 5 }]
    doc.pendingOpCreatedAt = performance.now()
    doc.trigger('change')
    clock.tick(FLUSH_DELAY)

    const record = readRecord()
    expect(record?.inflightOp).to.deep.equal([{ i: 'sent', p: 0 }])
    expect(record?.pendingOp).to.deep.equal([{ i: 'queued', p: 5 }])
  })

  it('writes the baseline plus live ops when offline with buffered ops', function () {
    create()
    goOffline()
    doc.pendingOp = [{ i: 'hello', p: 0 }]
    doc._doc.inflightSubmittedIds.add('old-client')
    doc.trigger('change')
    clock.tick(FLUSH_DELAY)

    const record = readRecord()
    expect(record?.updatedAt).to.be.a('number')
    expect(record).to.deep.equal({
      docId: DOC_ID,
      projectId: PROJECT_ID,
      version: 5,
      snapshot: 'server text',
      inflightOp: null,
      pendingOp: [{ i: 'hello', p: 0 }],
      trackChanges: false,
      updatedAt: record?.updatedAt,
      inflightSubmittedIds: ['old-client'],
    })
  })

  it('persists the track changes state in the record', function () {
    create()
    goOffline()
    doc.track_changes = true
    doc.pendingOp = [{ i: 'x', p: 0 }]
    doc.trigger('change')
    clock.tick(FLUSH_DELAY)

    expect(readRecord()?.trackChanges).to.be.true
  })

  it('captures a non-null inflightOp in the persisted record', function () {
    create()
    goOffline()
    doc.inflightOp = [{ i: 'sent', p: 0 }]
    doc.pendingOp = [{ i: 'queued', p: 5 }]
    doc.trigger('change')
    clock.tick(FLUSH_DELAY)

    const record = readRecord()
    expect(record?.inflightOp).to.deep.equal([{ i: 'sent', p: 0 }])
    expect(record?.pendingOp).to.deep.equal([{ i: 'queued', p: 5 }])
  })

  it('keeps the baseline frozen at V_start while editing offline', function () {
    create()
    goOffline()
    // The server version/snapshot are only observed again on `saved`; while
    // offline they must not leak into the stored baseline even if the doc
    // reports a newer version.
    doc.version = 99
    doc.snapshot = 'diverged offline text'
    doc.pendingOp = [{ i: 'x', p: 0 }]
    doc.trigger('change')
    clock.tick(FLUSH_DELAY)

    const record = readRecord()
    expect(record?.version).to.equal(5)
    expect(record?.snapshot).to.equal('server text')
  })

  it('refreshes the baseline on a remote change received while online and clean', function () {
    create()
    // A collaborator's op advances the server version/snapshot while we're
    // clean and online. ShareJS does not emit `saved` in this case, so the
    // change event must keep the baseline current.
    doc.version = 6
    doc.snapshot = 'server text with remote edit'
    doc.trigger('change')

    // Now go offline and make a local edit relative to the refreshed snapshot.
    goOffline()
    doc.pendingOp = [{ i: 'mine', p: 0 }]
    doc.trigger('change')
    clock.tick(FLUSH_DELAY)

    const record = readRecord()
    expect(record?.version).to.equal(6)
    expect(record?.snapshot).to.equal('server text with remote edit')
    expect(record?.pendingOp).to.deep.equal([{ i: 'mine', p: 0 }])
  })

  it('throttles writes to one per flush delay', function () {
    create()
    goOffline()
    doc.pendingOp = [{ i: 'a', p: 0 }]
    doc.trigger('change')
    doc.pendingOp = [{ i: 'ab', p: 0 }]
    doc.trigger('change')
    clock.tick(FLUSH_DELAY - 1)
    expect(readRecord()).to.be.null
    clock.tick(1)
    // trailing write picks up the latest buffered op
    expect(readRecord()?.pendingOp).to.deep.equal([{ i: 'ab', p: 0 }])
  })

  it('does not back up a non-sharejs-text-ot doc', function () {
    doc.otType = 'history-ot'
    create()
    goOffline()
    doc.pendingOp = [{ i: 'x', p: 0 }]
    doc.trigger('change')
    clock.tick(FLUSH_DELAY)
    expect(readRecord()).to.be.null
  })

  it('refreshes the baseline and clears the key on saved', function () {
    create()
    goOffline()
    doc.pendingOp = [{ i: 'x', p: 0 }]
    doc.trigger('change')
    clock.tick(FLUSH_DELAY)
    expect(readRecord()).to.not.be.null

    // Server acked everything: new clean baseline, key cleared.
    doc.version = 6
    doc.snapshot = 'server text updated'
    doc.pendingOp = null
    doc.inflightOp = null
    doc.trigger('saved')
    expect(readRecord()).to.be.null

    // A later offline edit should record the refreshed baseline.
    goOffline()
    doc.pendingOp = [{ i: 'y', p: 0 }]
    doc.trigger('change')
    clock.tick(FLUSH_DELAY)
    const record = readRecord()
    expect(record?.version).to.equal(6)
    expect(record?.snapshot).to.equal('server text updated')
  })

  it('emits offlineChangesSynced when the server acknowledges offline edits', function () {
    create()
    editOfflineThenSave(doc)

    expect(syncedEvents).to.deep.equal([{ docId: DOC_ID }])
  })

  it('does not emit offlineChangesSynced when saved with no stored record', function () {
    create()
    doc.trigger('saved')

    expect(syncedEvents).to.be.empty
  })

  it('emits offlineChangesSynced for each doc that syncs after one outage', function () {
    const otherDoc = new FakeShareJsDoc(OTHER_DOC_ID)
    create()
    create(otherDoc)

    goOffline()
    goOffline(otherDoc)
    doc.pendingOp = [{ i: 'x', p: 0 }]
    otherDoc.pendingOp = [{ i: 'y', p: 0 }]
    doc.trigger('change')
    otherDoc.trigger('change')
    clock.tick(FLUSH_DELAY)

    doc.connection.state = 'ok'
    otherDoc.connection.state = 'ok'
    doc.pendingOp = null
    otherDoc.pendingOp = null
    doc.trigger('saved')
    otherDoc.trigger('saved')

    expect(syncedEvents).to.deep.equal([
      { docId: DOC_ID },
      { docId: OTHER_DOC_ID },
    ])
  })

  it('disconnect() removes listeners but preserves the stored record', function () {
    const backup = create()
    goOffline()
    doc.pendingOp = [{ i: 'x', p: 0 }]
    doc.trigger('change')
    clock.tick(FLUSH_DELAY)
    expect(readRecord()).to.not.be.null

    // Teardown on the error/timeout path must not delete the backup: it is what
    // recovery reads on reload.
    backup.disconnect()
    expect(readRecord()).to.not.be.null

    // No further writes after disconnect.
    doc.pendingOp = [{ i: 'xy', p: 0 }]
    doc.trigger('change')
    clock.tick(FLUSH_DELAY)
    expect(readRecord()?.pendingOp).to.deep.equal([{ i: 'x', p: 0 }])
  })

  it('preserves the backup across a fatal-timeout teardown', function () {
    const backup = create()
    goOffline()
    doc.pendingOp = [{ i: 'x', p: 0 }]
    doc.trigger('change')
    clock.tick(FLUSH_DELAY)
    expect(readRecord()).to.not.be.null

    // Mirror onError(): buffered ops are cleared before teardown runs.
    doc.pendingOp = null
    doc.inflightOp = null
    backup.disconnect()

    expect(readRecord()).to.not.be.null
  })

  it('static read returns the stored record, or null when absent', function () {
    expect(OfflineDocBackup.read(PROJECT_ID, DOC_ID)).to.be.null

    create()
    goOffline()
    doc.pendingOp = [{ i: 'x', p: 0 }]
    doc.trigger('change')
    clock.tick(FLUSH_DELAY)

    expect(OfflineDocBackup.read(PROJECT_ID, DOC_ID)?.pendingOp).to.deep.equal([
      { i: 'x', p: 0 },
    ])
  })

  it('static remove deletes the stored record for the given doc', function () {
    create()
    goOffline()
    doc.pendingOp = [{ i: 'x', p: 0 }]
    doc.trigger('change')
    clock.tick(FLUSH_DELAY)
    expect(readRecord()).to.not.be.null

    OfflineDocBackup.remove(PROJECT_ID, DOC_ID)

    expect(readRecord()).to.be.null
  })

  it('clearAll removes every backup key but leaves unrelated keys', function () {
    window.sessionStorage.setItem(
      `doc.offline-backup.${USER_ID}.${PROJECT_ID}.${DOC_ID}`,
      '{}'
    )
    window.sessionStorage.setItem(
      'doc.offline-backup.other-user.other-project.other-doc',
      '{}'
    )
    window.sessionStorage.setItem('unrelated-key', 'keep me')

    OfflineDocBackup.clearAll()

    expect(
      window.sessionStorage.getItem(
        `doc.offline-backup.${USER_ID}.${PROJECT_ID}.${DOC_ID}`
      )
    ).to.be.null
    expect(
      window.sessionStorage.getItem(
        'doc.offline-backup.other-user.other-project.other-doc'
      )
    ).to.be.null
    expect(window.sessionStorage.getItem('unrelated-key')).to.equal('keep me')
  })
})
