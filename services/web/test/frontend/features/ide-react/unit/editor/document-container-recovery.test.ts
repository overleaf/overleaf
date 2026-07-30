import { expect } from 'chai'
import sinon from 'sinon'
import { DocumentContainer } from '@/features/ide-react/editor/document-container'
import EditorWatchdogManager from '@/features/ide-react/connection/editor-watchdog-manager'
import { Socket } from '@/features/ide-react/connection/types/socket'
import { IdeEventEmitter } from '@/features/ide-react/create-ide-event-emitter'

const DOC_ID = 'doc-1'
const PROJECT_ID = 'project-1'
const USER_ID = 'user-1'
const KEY = `doc.offline-backup.${USER_ID}.${PROJECT_ID}.${DOC_ID}`

type JoinResponder = (fromVersion: number, cb: (...args: any[]) => void) => void

function writeRecord(overrides: Record<string, any> = {}) {
  const record = {
    docId: DOC_ID,
    projectId: PROJECT_ID,
    version: 5,
    snapshot: 'hello',
    inflightOp: null,
    pendingOp: [{ i: '!', p: 5 }],
    trackChanges: false,
    updatedAt: 1,
    inflightSubmittedIds: [],
    ...overrides,
  }
  window.sessionStorage.setItem(KEY, JSON.stringify(record))
}

function makeContainer(joinResponder: JoinResponder) {
  const sent: any[] = []
  const socket = {
    socket: { connected: true },
    publicId: 'client-1',
    on: sinon.stub(),
    removeListener: sinon.stub(),
    emit: sinon.stub().callsFake((event: string, ...args: any[]) => {
      if (event === 'joinDoc') {
        const cb = args[args.length - 1]
        const fromVersion = typeof args[1] === 'number' ? args[1] : -1
        joinResponder(fromVersion, cb)
      } else if (event === 'applyOtUpdate') {
        sent.push(args[1])
      }
    }),
  }
  const watchdog = new EditorWatchdogManager({ onTimeoutHandler: () => {} })
  const ideEmitter = { on: sinon.stub(), off: sinon.stub(), emit: sinon.stub() }
  const container = new DocumentContainer(
    DOC_ID,
    socket as unknown as Socket,
    watchdog,
    ideEmitter as unknown as IdeEventEmitter,
    sinon.stub()
  )
  return { container, socket, sent }
}

function joinDocCalls(socket: { emit: sinon.SinonStub }) {
  return socket.emit.getCalls().filter(call => call.args[0] === 'joinDoc')
}

// call.args is [event, docId, fromVersion|options, ...]; a versioned join passes
// fromVersion (a number) there, a full join passes the options object.
const isVersioned = (call: sinon.SinonSpyCall) =>
  typeof call.args[2] === 'number'

describe('DocumentContainer offline recovery', function () {
  let clock: sinon.SinonFakeTimers

  beforeEach(function () {
    window.metaAttributesCache = new Map()
    window.metaAttributesCache.set('ol-user_id', USER_ID)
    window.metaAttributesCache.set('ol-project_id', PROJECT_ID)
    window.metaAttributesCache.set('ol-splitTestVariants', {
      'intermittent-connection-improvements': 'enabled',
    })
    window.sessionStorage.clear()
    clock = sinon.useFakeTimers()
  })

  afterEach(function () {
    clock.restore()
    window.sessionStorage.clear()
  })

  it('replays the buffered edits onto the current server version', function () {
    // Offline we appended '!' to 'hello'; meanwhile a collaborator inserted 'X'
    // at the start, taking the server from v5 to v6.
    writeRecord()
    const { container, sent } = makeContainer((fromVersion, cb) => {
      expect(fromVersion).to.equal(5)
      cb(
        null,
        ['Xhello'],
        6,
        [{ op: [{ i: 'X', p: 0 }], meta: { source: 'other' } }],
        { changes: [], comments: [] },
        'sharejs-text-ot'
      )
    })

    container.join()

    // Our append is transformed past the collaborator's insert and sent.
    expect(sent).to.have.length(1)
    expect(sent[0].op).to.deep.equal([{ i: '!', p: 6 }])
    expect(container.getSnapshot()).to.equal('Xhello!')
  })

  it('loads normally (no recovery) when the split test is disabled', function () {
    window.metaAttributesCache.set('ol-splitTestVariants', {})
    writeRecord()
    const { container, socket, sent } = makeContainer((fromVersion, cb) => {
      cb(
        null,
        ['hello'],
        5,
        [],
        { changes: [], comments: [] },
        'sharejs-text-ot'
      )
    })

    container.join()

    const calls = joinDocCalls(socket)
    expect(calls).to.have.length(1)
    expect(isVersioned(calls[0])).to.equal(false)
    expect(sent).to.have.length(0)
    expect(container.getSnapshot()).to.equal('hello')
  })

  it('replays tracked offline edits as tracked', function () {
    writeRecord({ trackChanges: true })
    const { container, sent } = makeContainer((fromVersion, cb) => {
      cb(
        null,
        ['hello'],
        5,
        [],
        { changes: [], comments: [] },
        'sharejs-text-ot'
      )
    })

    container.join()

    expect(sent).to.have.length(1)
    // meta.tc is the id seed the server mints its own change ids from, and is
    // only attached when the batch is tracked.
    expect(sent[0].meta.tc).to.be.a('string')
    expect(container.ranges!.changes).to.have.length(1)
  })

  it('adopts the server ranges once the recovered tracked edits are acked', function () {
    writeRecord({ trackChanges: true })
    const serverChange = {
      id: 'server-minted-id',
      op: { i: '!', p: 5 },
      metadata: { user_id: USER_ID },
    }
    let joins = 0
    const { container } = makeContainer((fromVersion, cb) => {
      joins++
      if (joins === 1) {
        cb(
          null,
          ['hello'],
          5,
          [],
          { changes: [], comments: [] },
          'sharejs-text-ot'
        )
      } else {
        cb(
          null,
          ['hello!'],
          5,
          [],
          { changes: [serverChange], comments: [] },
          'sharejs-text-ot'
        )
      }
    })

    container.join()
    const guessedId = container.ranges!.changes[0].id
    expect(guessedId).to.not.equal(serverChange.id)

    // the server has stored our op under its own change id
    container.doc!.clearInflightAndPendingOps()
    container.doc!.trigger('saved')

    expect(container.ranges!.changes.map(change => change.id)).to.deep.equal([
      serverChange.id,
    ])
  })

  it('falls back to a normal load when the server cannot catch us up', function () {
    writeRecord()
    const { container, socket, sent } = makeContainer((fromVersion, cb) => {
      if (fromVersion >= 0) {
        cb(new Error('OpRangeNotAvailable')) // baseline aged out
      } else {
        cb(
          null,
          ['head'],
          9,
          [],
          { changes: [], comments: [] },
          'sharejs-text-ot'
        )
      }
    })

    container.join()

    const calls = joinDocCalls(socket)
    expect(calls).to.have.length(2)
    expect(isVersioned(calls[0])).to.equal(true)
    expect(isVersioned(calls[1])).to.equal(false)
    expect(sent).to.have.length(0)
    expect(container.getSnapshot()).to.equal('head')
  })

  it('falls back to a normal load when the doc is no longer sharejs-text-ot', function () {
    writeRecord()
    const { container, socket, sent } = makeContainer((fromVersion, cb) => {
      if (fromVersion >= 0) {
        cb(null, [], 6, [], { changes: [], comments: [] }, 'history-ot')
      } else {
        cb(
          null,
          ['head'],
          6,
          [],
          { changes: [], comments: [] },
          'sharejs-text-ot'
        )
      }
    })

    container.join()

    const calls = joinDocCalls(socket)
    expect(calls).to.have.length(2)
    expect(sent).to.have.length(0)
    expect(container.getSnapshot()).to.equal('head')
  })

  it('falls back to a normal load when the backup cannot be applied', function () {
    // A pending delete that does not match the baseline text throws during seeding.
    writeRecord({ pendingOp: [{ d: 'zzz', p: 0 }] })
    const { container, socket, sent } = makeContainer((fromVersion, cb) => {
      cb(
        null,
        ['head'],
        5,
        [],
        { changes: [], comments: [] },
        'sharejs-text-ot'
      )
    })

    container.join()

    // Seeding throws before the versioned join is emitted, so only the fallback
    // full join runs.
    const calls = joinDocCalls(socket)
    expect(calls).to.have.length(1)
    expect(isVersioned(calls[0])).to.equal(false)
    expect(sent).to.have.length(0)
    expect(container.getSnapshot()).to.equal('head')
  })
})
