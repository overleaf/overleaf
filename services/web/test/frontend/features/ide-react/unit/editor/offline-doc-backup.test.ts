import { expect } from 'chai'
import sinon from 'sinon'
import EventEmitter from '@/utils/EventEmitter'
import {
  OfflineDocBackup,
  OfflineDocBackupRecord,
} from '@/features/ide-react/editor/offline-doc-backup'
import { ShareJsOperation } from '@/features/ide-react/editor/types/document'
import { OTType, ShareJsDoc } from '@/features/ide-react/editor/share-js-doc'

const DOC_ID = 'doc-123'
const PROJECT_ID = 'project-456'
const USER_ID = 'user-789'
const KEY = `doc.offline-backup.${USER_ID}.${PROJECT_ID}.${DOC_ID}`
const FLUSH_DELAY = 2000

class FakeShareJsDoc extends EventEmitter {
  doc_id = DOC_ID
  connection = {
    state: 'ok' as 'ok' | 'disconnected' | 'stopped',
    id: 'client-1',
  }
  version = 5
  snapshot = 'server text'
  inflightOp: ShareJsOperation | null = null
  pendingOp: ShareJsOperation | null = null
  track_changes = false
  otType: OTType = 'sharejs-text-ot'
  _doc = { inflightSubmittedIds: new Set<string>() }

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

  const enableFlag = (enabled = true) => {
    window.metaAttributesCache.set('ol-splitTestVariants', {
      'intermittent-connection-improvements': enabled ? 'enabled' : 'default',
    })
  }

  const create = () =>
    new OfflineDocBackup(doc as unknown as ShareJsDoc, PROJECT_ID)

  beforeEach(function () {
    window.metaAttributesCache = new Map()
    window.metaAttributesCache.set('ol-user_id', USER_ID)
    window.sessionStorage.clear()
    clock = sinon.useFakeTimers()
    doc = new FakeShareJsDoc()
    enableFlag()
  })

  afterEach(function () {
    clock.restore()
    window.sessionStorage.clear()
  })

  const goOffline = () => {
    doc.connection.state = 'disconnected'
  }

  it('does nothing when the split test is disabled', function () {
    enableFlag(false)
    const backup = create()
    goOffline()
    doc.pendingOp = [{ i: 'x', p: 0 }]
    doc.trigger('change')
    clock.tick(FLUSH_DELAY)
    expect(readRecord()).to.be.null
    backup.destroy()
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

  it('destroy() removes listeners but preserves the stored record', function () {
    const backup = create()
    goOffline()
    doc.pendingOp = [{ i: 'x', p: 0 }]
    doc.trigger('change')
    clock.tick(FLUSH_DELAY)
    expect(readRecord()).to.not.be.null

    // Teardown on the error/timeout path must not delete the backup: it is what
    // recovery reads on reload.
    backup.destroy()
    expect(readRecord()).to.not.be.null

    // No further writes after destroy.
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
    backup.destroy()

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
