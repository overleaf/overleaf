import { FC, useRef, useState } from 'react'
import sinon from 'sinon'
import { ConnectionContext } from '@/features/ide-react/context/connection-context'
import { IdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { UnsavedDocsContext } from '@/features/ide-react/context/unsaved-docs-context'
import { EditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { ProjectContext } from '@/shared/context/project-context'
import customSessionStorage from '@/infrastructure/session-storage'
import {
  ConnectionOutageTracker,
  type ConnectionOutageRecord,
} from '@/features/ide-react/editor/connection-outage-tracker'
import useConnectionOutageTracker from '@/features/ide-react/hooks/use-connection-outage-tracker'
import { IdeEventEmitter } from '@/features/ide-react/create-ide-event-emitter'

const PROJECT_ID = 'project-123'

type Signals = {
  isConnected: boolean
  reconnectAt: number | null
  isSavingStalled: boolean
  outOfSync: boolean
  pendingChars: number
  inflightChars: number
  // age of the oldest unacknowledged local op at the time it is read
  oldestOpAgeMs: number | null
}

const INITIAL: Signals = {
  isConnected: true,
  reconnectAt: null,
  isSavingStalled: false,
  outOfSync: false,
  pendingChars: 0,
  inflightChars: 0,
  oldestOpAgeMs: null,
}

type Controller = {
  set: (patch: Partial<Signals>) => void
  eventEmitter: IdeEventEmitter
}

const HookHost: FC = () => {
  useConnectionOutageTracker()
  return null
}

function mount(controller: Controller, initial: Partial<Signals> = {}) {
  const Harness: FC = () => {
    const [signals, setSignals] = useState<Signals>({ ...INITIAL, ...initial })
    const signalsRef = useRef(signals)
    signalsRef.current = signals
    controller.set = patch => setSignals(s => ({ ...s, ...patch }))

    const [eventEmitter] = useState(() => new IdeEventEmitter())
    controller.eventEmitter = eventEmitter

    const [openDocs] = useState(() => ({
      getUnsavedOpsSize: () => ({
        pendingChars: signalsRef.current.pendingChars,
        inflightChars: signalsRef.current.inflightChars,
      }),
      getOldestUnsavedOpCreatedAt: () => {
        const { oldestOpAgeMs } = signalsRef.current
        if (oldestOpAgeMs === null) {
          return null
        }
        return performance.now() - oldestOpAgeMs
      },
    }))

    const websocketDisconnected =
      !signals.isConnected || signals.reconnectAt !== null
    const stalled =
      signals.isSavingStalled || signals.outOfSync || websocketDisconnected

    const connectionValue = {
      isConnected: signals.isConnected,
      connectionState: { reconnectAt: signals.reconnectAt },
    }
    const ideReactValue = { outOfSync: signals.outOfSync, eventEmitter }
    const unsavedValue = { isSavingStalled: signals.isSavingStalled }
    const editorManagerValue = { openDocs }
    const projectValue = { projectId: PROJECT_ID }

    // These testids expose the currently-committed signal values so tests can
    // block on `.should('have.text', ...)` before advancing the fake clock.
    // Without that sync, cy.tick can fire timers before React has flushed a
    // preceding setState, leaving effect/interval callbacks reading stale state.
    return (
      <ConnectionContext.Provider value={connectionValue as any}>
        <IdeReactContext.Provider value={ideReactValue as any}>
          <UnsavedDocsContext.Provider value={unsavedValue as any}>
            <EditorManagerContext.Provider value={editorManagerValue as any}>
              <ProjectContext.Provider value={projectValue as any}>
                <div data-testid="stalled">{String(stalled)}</div>
                <div data-testid="isConnected">
                  {String(signals.isConnected)}
                </div>
                <div data-testid="pendingChars">
                  {String(signals.pendingChars)}
                </div>
                <div data-testid="oldestOpAgeMs">
                  {String(signals.oldestOpAgeMs)}
                </div>
                <HookHost />
              </ProjectContext.Provider>
            </EditorManagerContext.Provider>
          </UnsavedDocsContext.Provider>
        </IdeReactContext.Provider>
      </ConnectionContext.Provider>
    )
  }

  cy.mount(<Harness />)
}

const BEACON_URL = '/event/connection-restored'
const SYNCED_BEACON_URL = '/event/post-offline-sync-succeeded'
const FAILED_BEACON_URL = '/event/post-offline-sync-failed'

// sendMB emits via navigator.sendBeacon internally. In webpack CT the named
// import of sendMB cannot be stubbed (live binding), so intercept at the
// browser boundary instead. Returns the segmentation parsed from the Blob body
// of the beacon call for the given event URL.
function beaconSegmentation(
  url: string
): Cypress.Chainable<Record<string, unknown>> {
  return cy
    .get('@sendBeacon')
    .should(stub => {
      const call = (stub as unknown as sinon.SinonStub)
        .getCalls()
        .find(({ args }) => args[0] === url)
      expect(call, `beacon to ${url}`).to.exist
    })
    .then(stub => {
      const call = (stub as unknown as sinon.SinonStub)
        .getCalls()
        .find(({ args }) => args[0] === url)!
      const [, blob] = call.args
      return cy
        .wrap((blob as Blob).text())
        .then(text => JSON.parse(text as string))
    })
}

describe('useConnectionOutageTracker', function () {
  beforeEach(function () {
    // Back customSessionStorage with an in-memory store so persistence is
    // deterministic and independent of the CT iframe's real sessionStorage.
    const store = new Map<string, string>()
    cy.stub(customSessionStorage, 'getItem').callsFake((key: string) => {
      const value = store.get(key)
      return value === undefined ? null : JSON.parse(value)
    })
    cy.stub(customSessionStorage, 'setItem').callsFake(
      (key: string, value: unknown) => {
        store.set(key, JSON.stringify(value))
      }
    )
    cy.stub(customSessionStorage, 'removeItem').callsFake((key: string) => {
      store.delete(key)
    })
    cy.stub(customSessionStorage, 'removeByPrefix').callsFake(
      (prefix: string) => {
        for (const key of [...store.keys()]) {
          if (key.startsWith(prefix)) {
            store.delete(key)
          }
        }
      }
    )

    // sendBeacon short-circuits unless isOverleaf is set; CT's resetMeta omits
    // it. Set it plus a csrf token so the real emit path runs into our stub.
    window.metaAttributesCache.get('ol-ExposedSettings').isOverleaf = true
    window.metaAttributesCache.set('ol-csrfToken', 'test-csrf')

    ConnectionOutageTracker.clearAll()
    cy.clock()
    cy.stub(window.navigator, 'sendBeacon').as('sendBeacon')
  })

  afterEach(function () {
    ConnectionOutageTracker.clearAll()
  })

  it('emits connection-restored once on websocket reconnect', function () {
    const controller = {} as Controller
    mount(controller)

    cy.then(() =>
      controller.set({
        isConnected: false,
        pendingChars: 5,
        inflightChars: 3,
        oldestOpAgeMs: 0,
      })
    )
    cy.tick(1) // flush START + SNAPSHOT passive effects
    cy.findByTestId('stalled').should('have.text', 'true')
    cy.tick(31_000)
    cy.then(() => controller.set({ isConnected: true }))
    cy.tick(1) // flush FIRE passive effect
    cy.findByTestId('stalled').should('have.text', 'false')

    cy.get('@sendBeacon').should('have.been.calledOnce')
    cy.get('@sendBeacon').should('have.been.calledWith', BEACON_URL)
    beaconSegmentation(BEACON_URL).should(segmentation => {
      expect(segmentation).to.include({
        resolution: 'reconnected',
        spannedReload: false,
        pendingChars: 5,
        inflightChars: 3,
      })
      expect(segmentation.unsavedDurationMs).to.be.at.least(31_000)
      expect(segmentation.outageDurationMs).to.be.at.least(31_000)
    })
  })

  it('drops an outage that ended with no unsaved work', function () {
    // Socket drops with no ops pending and none arrive during the outage, so no
    // work was ever at risk. Such an outage is indistinguishable from an idle
    // tab or a sleeping machine and is not reported, but the record is still
    // cleaned up.
    const controller = {} as Controller
    mount(controller)

    cy.then(() => controller.set({ isConnected: false }))
    cy.tick(1) // flush START passive effect
    cy.findByTestId('stalled').should('have.text', 'true')
    cy.tick(31_000)
    cy.then(() => controller.set({ isConnected: true }))
    cy.tick(1) // flush FIRE passive effect
    cy.findByTestId('stalled').should('have.text', 'false')

    cy.get('@sendBeacon').should('not.have.been.called')
    cy.then(() => {
      expect(ConnectionOutageTracker.read(PROJECT_ID)).to.equal(null)
    })
  })

  it('backfills oldestUnsavedOpAt from the first edit that arrives mid-outage', function () {
    // Socket drops before the user types anything, so START captures null. Once
    // an op appears, recordEdits backfills the timestamp; unsavedDurationMs is
    // then measured from that first edit, not from detectedAt.
    const controller = {} as Controller
    mount(controller)

    cy.then(() => controller.set({ isConnected: false }))
    cy.tick(1) // flush START passive effect
    cy.findByTestId('stalled').should('have.text', 'true')
    cy.then(() => {
      expect(
        ConnectionOutageTracker.read(PROJECT_ID)?.oldestUnsavedOpAt
      ).to.equal(null)
    })

    // 10s of idle outage, then the user types
    cy.tick(10_000)
    cy.then(() =>
      controller.set({ pendingChars: 4, inflightChars: 0, oldestOpAgeMs: 0 })
    )
    // Force React to commit before the interval fires, otherwise the snapshot
    // callback reads a stale signalsRef and skips backfill.
    cy.findByTestId('pendingChars').should('have.text', '4')
    cy.tick(2_000) // let SNAPSHOT interval fire and backfill
    cy.wrap(null).should(() => {
      const stored = ConnectionOutageTracker.read(PROJECT_ID)
      expect(stored?.oldestUnsavedOpAt).to.not.equal(null)
      expect(stored?.pendingChars).to.equal(4)
    })

    // 21s more, still stalled, then reconnect
    cy.tick(21_000)
    cy.then(() => controller.set({ isConnected: true }))
    cy.tick(1) // flush FIRE passive effect

    beaconSegmentation(BEACON_URL).should(segmentation => {
      // ~21s from the first edit, not ~31s from the drop
      expect(segmentation.unsavedDurationMs).to.be.at.least(21_000)
      expect(segmentation.unsavedDurationMs).to.be.lessThan(31_000)
      expect(segmentation.outageDurationMs).to.be.at.least(31_000)
    })
  })

  it('does not overwrite oldestUnsavedOpAt captured at START with a later edit', function () {
    // Socket drops with a 20s-old op already pending. START captures that
    // timestamp, and a fresh op arriving later must not push it forward.
    const controller = {} as Controller
    mount(controller)

    cy.then(() =>
      controller.set({
        isConnected: false,
        pendingChars: 2,
        oldestOpAgeMs: 20_000,
      })
    )
    // Force React to commit before ticking so START reads oldestOpAgeMs=20_000
    cy.findByTestId('oldestOpAgeMs').should('have.text', '20000')
    cy.tick(11_000)
    cy.then(() => controller.set({ pendingChars: 6, oldestOpAgeMs: 0 }))
    cy.findByTestId('pendingChars').should('have.text', '6')
    cy.tick(2_000) // let SNAPSHOT interval fire once
    cy.then(() => controller.set({ isConnected: true }))
    cy.tick(1)

    beaconSegmentation(BEACON_URL).should(segmentation => {
      // From the original 20s-old op, plus the ~13s of outage
      expect(segmentation.unsavedDurationMs).to.be.at.least(33_000)
    })
  })

  it('emits a terminal teardown right away while the network is up', function () {
    const controller = {} as Controller
    mount(controller)

    cy.then(() =>
      controller.set({ isConnected: false, pendingChars: 9, inflightChars: 4 })
    )
    cy.tick(1) // flush START + SNAPSHOT passive effects
    cy.findByTestId('stalled').should('have.text', 'true')
    cy.tick(46_000)
    cy.then(() => {
      ConnectionOutageTracker.recordTeardown(PROJECT_ID)
      controller.set({ outOfSync: true })
    })
    cy.tick(1)

    // The teardown only closes the websocket, and sendMB goes over HTTP
    cy.get('@sendBeacon').should('have.been.calledOnce')
    beaconSegmentation(BEACON_URL).should(segmentation => {
      expect(segmentation).to.include({
        resolution: 'out-of-sync',
        spannedReload: false,
        pendingChars: 9,
        inflightChars: 4,
      })
      expect(segmentation.detectedAt).to.equal(
        ConnectionOutageTracker.read(PROJECT_ID)?.detectedAt
      )
    })
  })

  it('keeps the teardown record after an inline flush so the next load can retry', function () {
    const controller = {} as Controller
    mount(controller)

    cy.then(() =>
      controller.set({ isConnected: false, pendingChars: 9, inflightChars: 4 })
    )
    cy.tick(1) // flush START + SNAPSHOT passive effects
    cy.findByTestId('stalled').should('have.text', 'true')
    cy.tick(46_000)
    cy.then(() => {
      ConnectionOutageTracker.recordTeardown(PROJECT_ID)
      controller.set({ outOfSync: true })
    })
    cy.tick(1)

    // The stall never clears after a teardown, so the snapshot interval keeps
    // running against a record that has to stay frozen and must not be
    // reported a second time on this load
    cy.tick(31_000)
    cy.then(() => {
      const record = ConnectionOutageTracker.read(PROJECT_ID)
      expect(record).to.not.equal(null)
      expect(record?.teardownAt).to.not.equal(undefined)
      expect(record?.pendingChars).to.equal(9)
    })
    cy.get('@sendBeacon').should('have.been.calledOnce')
  })

  it('emits a deferred teardown on the next load, timed to the teardown', function () {
    const controller = {} as Controller
    cy.then(() => {
      const now = Date.now()
      const record: ConnectionOutageRecord = {
        projectId: PROJECT_ID,
        detectedAt: now - 50_000,
        oldestUnsavedOpAt: now - 60_000,
        pendingChars: 9,
        inflightChars: 4,
        updatedAt: now - 1_000,
        teardownAt: now - 5_000,
      }
      customSessionStorage.setItem(
        ConnectionOutageTracker.buildKey(PROJECT_ID),
        record
      )
    })
    mount(controller)
    cy.tick(1) // flush RELOAD-survival mount effect

    cy.get('@sendBeacon').should('have.been.calledOnce')
    beaconSegmentation(BEACON_URL).should(segmentation => {
      expect(segmentation).to.include({
        resolution: 'out-of-sync',
        spannedReload: true,
        pendingChars: 9,
        inflightChars: 4,
      })
      // measured to the teardown, not to the flush
      expect(segmentation.unsavedDurationMs).to.equal(55_000)
      expect(segmentation.outageDurationMs).to.equal(45_000)
    })
    cy.then(() => {
      expect(ConnectionOutageTracker.read(PROJECT_ID)).to.equal(null)
    })
  })

  it('emits a teardown that followed no outage, so cold doc errors stay visible', function () {
    const controller = {} as Controller
    cy.then(() => {
      const now = Date.now()
      const record: ConnectionOutageRecord = {
        projectId: PROJECT_ID,
        detectedAt: now,
        oldestUnsavedOpAt: null,
        pendingChars: 0,
        inflightChars: 0,
        updatedAt: now,
        teardownAt: now,
      }
      customSessionStorage.setItem(
        ConnectionOutageTracker.buildKey(PROJECT_ID),
        record
      )
    })
    mount(controller)
    cy.tick(1) // flush RELOAD-survival mount effect

    cy.get('@sendBeacon').should('have.been.calledOnce')
    beaconSegmentation(BEACON_URL).should(segmentation => {
      // No unsaved work, but teardowns bypass the no-unsaved-work filter
      expect(segmentation).to.include({
        resolution: 'out-of-sync',
        pendingChars: 0,
        inflightChars: 0,
      })
      expect(segmentation.unsavedDurationMs).to.equal(0)
    })
  })

  it('does not emit when out-of-sync is set without a recorded teardown', function () {
    const controller = {} as Controller
    mount(controller)

    cy.tick(31_000)
    cy.then(() => controller.set({ outOfSync: true }))
    cy.tick(1)

    cy.get('@sendBeacon').should('not.have.been.called')
  })

  it('records the second outage when a drop follows a reconnect mid-stall', function () {
    const controller = {} as Controller
    mount(controller)

    // First outage: drop while saving is already stalled. Unsaved work
    // throughout, so neither outage is filtered out.
    cy.then(() =>
      controller.set({
        isConnected: false,
        isSavingStalled: true,
        pendingChars: 4,
        oldestOpAgeMs: 0,
      })
    )
    cy.tick(1) // flush START + SNAPSHOT passive effects
    cy.findByTestId('stalled').should('have.text', 'true')
    cy.tick(31_000)

    // Reconnect, but the ops are still unacknowledged so stalled stays true
    cy.then(() => controller.set({ isConnected: true }))
    cy.findByTestId('isConnected').should('have.text', 'true')
    cy.get('@sendBeacon').should('have.been.calledOnce')

    // Second drop: stalled never changed, so only websocketDisconnected can
    // re-arm tracking here
    cy.then(() => controller.set({ isConnected: false }))
    cy.findByTestId('isConnected').should('have.text', 'false')
    cy.wrap(null).should(() => {
      expect(ConnectionOutageTracker.read(PROJECT_ID)).to.not.equal(null)
    })
    cy.tick(31_000)
    cy.then(() => controller.set({ isConnected: true }))
    cy.tick(1)

    cy.get('@sendBeacon').should('have.been.calledTwice')
  })

  it('counts the outage from the oldest unsaved op, not from when the stall was detected', function () {
    const controller = {} as Controller
    mount(controller)

    cy.then(() =>
      controller.set({
        isSavingStalled: true,
        pendingChars: 3,
        oldestOpAgeMs: 20_000,
      })
    )
    cy.tick(1) // flush START + SNAPSHOT passive effects
    cy.findByTestId('stalled').should('have.text', 'true')
    cy.tick(15_000)
    cy.then(() => controller.set({ isSavingStalled: false }))
    cy.tick(1) // flush FIRE passive effect

    cy.get('@sendBeacon').should('have.been.calledWith', BEACON_URL)

    // 15s of detected stall, but the oldest op was already 20s old
    beaconSegmentation(BEACON_URL).should(segmentation => {
      expect(segmentation.unsavedDurationMs).to.be.at.least(35_000)
    })
  })

  it('emits a short outage, so brief blips are reported too', function () {
    const controller = {} as Controller
    mount(controller)

    cy.then(() =>
      controller.set({ isConnected: false, pendingChars: 2, oldestOpAgeMs: 0 })
    )
    cy.tick(1) // flush START + SNAPSHOT passive effects
    cy.findByTestId('stalled').should('have.text', 'true')
    cy.tick(2_000)
    cy.then(() => controller.set({ isConnected: true }))
    cy.tick(1) // flush FIRE passive effect
    cy.findByTestId('stalled').should('have.text', 'false')

    cy.get('@sendBeacon').should('have.been.calledOnce')
    beaconSegmentation(BEACON_URL).should(segmentation => {
      expect(segmentation).to.include({ resolution: 'reconnected' })
      expect(segmentation.outageDurationMs).to.be.lessThan(30_000)
    })
  })

  it('emits a saved resolution for a saving-stalled-only episode (no websocket drop)', function () {
    const controller = {} as Controller
    mount(controller)

    cy.then(() =>
      controller.set({
        isSavingStalled: true,
        pendingChars: 3,
        oldestOpAgeMs: 0,
      })
    )
    cy.tick(1) // flush START + SNAPSHOT passive effects
    cy.findByTestId('stalled').should('have.text', 'true')
    cy.tick(31_000)
    cy.then(() => controller.set({ isSavingStalled: false }))
    cy.tick(1) // flush FIRE passive effect
    cy.findByTestId('stalled').should('have.text', 'false')

    cy.get('@sendBeacon').should('have.been.calledOnce')
    beaconSegmentation(BEACON_URL).should(segmentation => {
      expect(segmentation).to.include({ resolution: 'saved' })
    })
  })

  it('emits only once when websocket reconnect and full recovery coincide', function () {
    const controller = {} as Controller
    mount(controller)

    cy.then(() =>
      controller.set({
        isConnected: false,
        isSavingStalled: true,
        pendingChars: 3,
        oldestOpAgeMs: 0,
      })
    )
    cy.tick(1) // flush START + SNAPSHOT passive effects
    cy.findByTestId('stalled').should('have.text', 'true')
    cy.tick(31_000)
    cy.then(() => controller.set({ isConnected: true, isSavingStalled: false }))
    cy.tick(1) // flush FIRE passive effects
    cy.findByTestId('stalled').should('have.text', 'false')

    cy.get('@sendBeacon').should('have.been.calledOnce')
  })

  it('emits on mount when a record recovered during a reload', function () {
    const controller = {} as Controller
    cy.then(() => {
      const now = Date.now()
      const record: ConnectionOutageRecord = {
        projectId: PROJECT_ID,
        detectedAt: now - 60_000,
        oldestUnsavedOpAt: now - 60_000,
        pendingChars: 7,
        inflightChars: 2,
        updatedAt: now - 1_000,
      }
      customSessionStorage.setItem(
        ConnectionOutageTracker.buildKey(PROJECT_ID),
        record
      )
    })
    mount(controller)
    cy.tick(1) // flush RELOAD-survival mount effect

    cy.get('@sendBeacon').should('have.been.calledOnce')
    cy.get('@sendBeacon').should('have.been.calledWith', BEACON_URL)
    beaconSegmentation(BEACON_URL).should(segmentation => {
      expect(segmentation).to.include({
        resolution: 'reconnected',
        spannedReload: true,
        pendingChars: 7,
        inflightChars: 2,
      })
      expect(segmentation.unsavedDurationMs).to.be.at.least(60_000)
    })
  })

  it('discards a record older than the reload cap without emitting', function () {
    const controller = {} as Controller
    cy.then(() => {
      const now = Date.now()
      const record: ConnectionOutageRecord = {
        projectId: PROJECT_ID,
        detectedAt: now - 26 * 60 * 60 * 1000,
        oldestUnsavedOpAt: now - 26 * 60 * 60 * 1000,
        pendingChars: 4,
        inflightChars: 1,
        updatedAt: now - 25 * 60 * 60 * 1000,
      }
      customSessionStorage.setItem(
        ConnectionOutageTracker.buildKey(PROJECT_ID),
        record
      )
    })
    mount(controller)
    cy.tick(1) // flush RELOAD-survival mount effect

    cy.get('@sendBeacon').should('not.have.been.called')
    cy.then(() => {
      expect(ConnectionOutageTracker.read(PROJECT_ID)).to.equal(null)
    })
  })

  // The socket reads as CLOSED on the first render of every load, so the mount
  // effects all see stalled === true. The reload-survival effect has to read the
  // persisted record before the snapshot effect can write over it.
  it('discards a record older than the reload cap even when the mount is stalled', function () {
    const controller = {} as Controller
    cy.then(() => {
      const now = Date.now()
      const record: ConnectionOutageRecord = {
        projectId: PROJECT_ID,
        detectedAt: now - 26 * 60 * 60 * 1000,
        oldestUnsavedOpAt: now - 26 * 60 * 60 * 1000,
        pendingChars: 4,
        inflightChars: 1,
        updatedAt: now - 25 * 60 * 60 * 1000,
      }
      customSessionStorage.setItem(
        ConnectionOutageTracker.buildKey(PROJECT_ID),
        record
      )
    })
    // pendingChars is non-zero so that a snapshot taken ahead of the reload
    // effect would refresh updatedAt and hide the staleness
    mount(controller, { isConnected: false, pendingChars: 3 })
    cy.tick(1) // flush mount effects
    cy.findByTestId('stalled').should('have.text', 'true')

    cy.get('@sendBeacon').should('not.have.been.called')
    cy.then(() => {
      expect(ConnectionOutageTracker.read(PROJECT_ID)).to.equal(null)
    })
  })

  it('flushes a deferred teardown with the edit sizes recorded before the reload', function () {
    const controller = {} as Controller
    cy.then(() => {
      const now = Date.now()
      const record: ConnectionOutageRecord = {
        projectId: PROJECT_ID,
        detectedAt: now - 50_000,
        oldestUnsavedOpAt: now - 60_000,
        pendingChars: 9,
        inflightChars: 4,
        updatedAt: now - 1_000,
        teardownAt: now - 5_000,
      }
      customSessionStorage.setItem(
        ConnectionOutageTracker.buildKey(PROJECT_ID),
        record
      )
    })
    // No docs are open this early in a load, so the live edit sizes read as zero
    mount(controller, { outOfSync: true, pendingChars: 0, inflightChars: 0 })
    cy.tick(1) // flush mount effects
    cy.findByTestId('stalled').should('have.text', 'true')

    beaconSegmentation(BEACON_URL).should(segmentation => {
      expect(segmentation).to.include({ pendingChars: 9, inflightChars: 4 })
    })
  })

  it('keeps the edit sizes recorded before a reload while the stall continues', function () {
    const controller = {} as Controller
    cy.then(() => {
      const now = Date.now()
      const record: ConnectionOutageRecord = {
        projectId: PROJECT_ID,
        detectedAt: now - 60_000,
        oldestUnsavedOpAt: now - 60_000,
        pendingChars: 9,
        inflightChars: 4,
        updatedAt: now - 1_000,
      }
      customSessionStorage.setItem(
        ConnectionOutageTracker.buildKey(PROJECT_ID),
        record
      )
    })
    // Still offline at mount, and no docs open yet, so the live sizes read zero
    mount(controller, { isConnected: false, pendingChars: 0, inflightChars: 0 })
    cy.tick(1) // flush mount effects
    cy.findByTestId('stalled').should('have.text', 'true')
    cy.get('@sendBeacon').should('not.have.been.called')

    // Let the snapshot interval run a few times before recovering
    cy.tick(10_000)
    cy.then(() => controller.set({ isConnected: true }))
    cy.tick(1) // flush FIRE passive effects

    beaconSegmentation(BEACON_URL).should(segmentation => {
      expect(segmentation).to.include({ pendingChars: 9, inflightChars: 4 })
      expect(segmentation.resolution).to.equal('reconnected')
      // Recovered live on this load, but the outage still began on the previous one
      expect(segmentation.spannedReload).to.equal(true)
    })
  })

  it('keeps the peak edit sizes when the recovery flush drains ops mid-snapshot', function () {
    const controller = {} as Controller
    mount(controller)

    cy.then(() =>
      controller.set({ isConnected: false, pendingChars: 9, inflightChars: 4 })
    )
    cy.tick(1) // flush START + SNAPSHOT passive effects
    cy.findByTestId('stalled').should('have.text', 'true')
    cy.tick(31_000)

    // An ack nulls the inflight op a flush delay before the next pending op is
    // promoted, so a snapshot tick here reads zero inflight against a full queue
    cy.then(() => controller.set({ pendingChars: 5, inflightChars: 0 }))
    cy.findByTestId('pendingChars').should('have.text', '5')
    cy.tick(2_000)

    cy.then(() => controller.set({ isConnected: true }))
    cy.findByTestId('isConnected').should('have.text', 'true')
    cy.tick(1) // flush FIRE passive effects

    beaconSegmentation(BEACON_URL).should(segmentation => {
      expect(segmentation).to.include({
        resolution: 'reconnected',
        pendingChars: 9,
        inflightChars: 4,
      })
    })
  })

  it('ignores a disconnected first render, so an ordinary load records nothing', function () {
    const controller = {} as Controller
    mount(controller, { isConnected: false })
    cy.tick(1) // flush mount effects
    cy.findByTestId('stalled').should('have.text', 'true')
    cy.then(() => {
      expect(ConnectionOutageTracker.read(PROJECT_ID)).to.equal(null)
    })

    // Not an outage however long the first connection takes
    cy.tick(31_000)
    cy.then(() => {
      expect(ConnectionOutageTracker.read(PROJECT_ID)).to.equal(null)
    })

    // Connect, then drop for real: that is tracked
    cy.then(() => controller.set({ isConnected: true }))
    cy.findByTestId('isConnected').should('have.text', 'true')
    cy.then(() => controller.set({ isConnected: false }))
    cy.findByTestId('isConnected').should('have.text', 'false')
    cy.wrap(null).should(() => {
      expect(ConnectionOutageTracker.read(PROJECT_ID)).to.not.equal(null)
    })

    cy.get('@sendBeacon').should('not.have.been.called')
  })

  it('emits post-offline-sync-succeeded with the doc id after a resolved outage', function () {
    const controller = {} as Controller
    mount(controller)

    cy.then(() =>
      controller.set({
        isConnected: false,
        pendingChars: 6,
        inflightChars: 2,
        oldestOpAgeMs: 0,
      })
    )
    cy.tick(1) // flush START + SNAPSHOT passive effects
    cy.findByTestId('stalled').should('have.text', 'true')
    cy.tick(31_000)
    cy.then(() => controller.set({ isConnected: true }))
    cy.tick(1) // flush FIRE passive effect
    cy.findByTestId('stalled').should('have.text', 'false')

    // The outage is over and its record removed, so the sync event stands alone.
    cy.then(() => {
      expect(ConnectionOutageTracker.read(PROJECT_ID)).to.equal(null)
      controller.eventEmitter.emit('ide:offlineChangesSynced', {
        docId: 'doc-1',
      })
    })

    beaconSegmentation(SYNCED_BEACON_URL).should(segmentation => {
      expect(segmentation).to.include({
        docId: 'doc-1',
      })
    })
  })

  it('emits post-offline-sync-failed with the doc id while an outage is still ongoing', function () {
    const controller = {} as Controller
    mount(controller)

    cy.then(() =>
      controller.set({
        isConnected: false,
        pendingChars: 8,
        inflightChars: 1,
        oldestOpAgeMs: 0,
      })
    )
    cy.tick(1) // flush START + SNAPSHOT passive effects
    cy.findByTestId('stalled').should('have.text', 'true')
    cy.tick(41_000)

    cy.then(() =>
      controller.eventEmitter.emit('ide:unableToSyncOfflineChanges', {
        docId: 'doc-2',
        editorContent: 'offline edits',
        baseContent: 'original',
        docName: 'main.tex',
      })
    )

    beaconSegmentation(FAILED_BEACON_URL).should(segmentation => {
      expect(segmentation).to.include({
        docId: 'doc-2',
      })
    })
  })

  it('emits the sync outcome with just the doc when no outage was tracked', function () {
    const controller = {} as Controller
    mount(controller)
    cy.tick(1)

    cy.then(() =>
      controller.eventEmitter.emit('ide:offlineChangesSynced', {
        docId: 'doc-3',
      })
    )

    cy.get('@sendBeacon').should('have.been.calledOnce')
    beaconSegmentation(SYNCED_BEACON_URL).should(segmentation => {
      expect(segmentation).to.include({ docId: 'doc-3' })
      expect(segmentation).to.not.have.any.keys(
        'unsavedDurationMs',
        'pendingChars',
        'inflightChars'
      )
    })
  })
})
