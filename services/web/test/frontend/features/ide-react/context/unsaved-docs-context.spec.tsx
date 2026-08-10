import { FC, useState } from 'react'
import { EditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { IdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { UnsavedDocsProvider } from '@/features/ide-react/context/unsaved-docs-context'
import { SplitTestProvider } from '@/shared/context/split-test-context'
import { IdeEventEmitter } from '@/features/ide-react/create-ide-event-emitter'
import type { DocumentContainer } from '@/features/ide-react/editor/document-container'
import type { PermissionsLevel } from '@/features/ide-react/types/permissions'

function makeDocStub(
  docId: string,
  {
    inflightAt = null,
    pendingAt = null,
  }: { inflightAt?: number | null; pendingAt?: number | null } = {}
): Partial<DocumentContainer> {
  return {
    doc_id: docId,
    getInflightOpCreatedAt: () => inflightAt ?? undefined,
    getPendingOpCreatedAt: () => pendingAt ?? undefined,
    hasBufferedOps: () => inflightAt != null || pendingAt != null,
    pollSavedStatus: () => inflightAt == null && pendingAt == null,
  }
}

function makeOpenDocsStub(
  docsWithUnsavedOps: Partial<DocumentContainer>[] = []
) {
  return {
    unsavedDocs: () => docsWithUnsavedOps,
    hasUnsavedChanges: () => docsWithUnsavedOps.length > 0,
    getUnsavedOpsSize: () => ({ pendingOpsLength: 0, inflightOpsLength: 0 }),
  }
}

function mount(
  openDocs = makeOpenDocsStub(),
  onSetPermissionsLevel: (level: PermissionsLevel) => void = () => {},
  {
    isPremiumUser = false,
    intermittentConnectionImprovementsEnabled = false,
  }: {
    isPremiumUser?: boolean
    intermittentConnectionImprovementsEnabled?: boolean
  } = {}
) {
  // the provider reads getMeta('ol-user') to decide the lock threshold
  window.metaAttributesCache.set('ol-user', {
    features: isPremiumUser ? { offlineMode: true } : {},
  })
  // the provider reads the split test variant via useFeatureFlag
  window.metaAttributesCache.set('ol-splitTestVariants', {
    'intermittent-connection-improvements':
      intermittentConnectionImprovementsEnabled ? 'enabled' : 'default',
  })

  const debugTimers = { current: {} as Record<string, number> }

  const Wrapper: FC = () => {
    const [contextValue] = useState(() => ({
      projectId: 'test-project',
      eventEmitter: new IdeEventEmitter(),
      startedFreeTrial: false,
      setStartedFreeTrial: () => {},
      reportError: () => {},
      projectJoined: true,
      permissionsLevel: 'owner' as PermissionsLevel,
      setPermissionsLevel: onSetPermissionsLevel,
      outOfSync: false,
      setOutOfSync: () => {},
    }))

    return (
      <SplitTestProvider>
        <IdeReactContext.Provider value={contextValue}>
          <EditorManagerContext.Provider
            value={{ openDocs, debugTimers } as any}
          >
            <UnsavedDocsProvider />
          </EditorManagerContext.Provider>
        </IdeReactContext.Provider>
      </SplitTestProvider>
    )
  }

  cy.mount(<Wrapper />)
}

describe('<UnsavedDocsProvider />', function () {
  beforeEach(function () {
    cy.clock()
  })

  it('locks the editor when a doc exceeds MAX_UNSAVED_SECONDS', function () {
    const setPermissionsLevel = cy.stub().as('setPermissionsLevel')
    const now = performance.now()
    const openDocs = makeOpenDocsStub([
      makeDocStub('doc1', { pendingAt: now - 31_000 }),
    ])

    mount(openDocs, setPermissionsLevel)
    cy.tick(1000)

    cy.get('@setPermissionsLevel').should('have.been.calledWith', 'readOnly')
  })

  it('does not lock the editor before MAX_UNSAVED_SECONDS', function () {
    const setPermissionsLevel = cy.stub().as('setPermissionsLevel')
    const now = performance.now()
    const openDocs = makeOpenDocsStub([
      makeDocStub('doc1', { pendingAt: now - 29_000 }),
    ])

    mount(openDocs, setPermissionsLevel)
    cy.tick(1000)

    cy.get('@setPermissionsLevel').should('not.have.been.called')
  })

  it('restores permissions when all docs are saved after locking', function () {
    const setPermissionsLevel = cy.stub().as('setPermissionsLevel')
    const now = performance.now()
    const openDocs = makeOpenDocsStub([
      makeDocStub('doc1', { pendingAt: now - 31_000 }),
    ])

    mount(openDocs, setPermissionsLevel)
    cy.tick(1000)

    cy.get('@setPermissionsLevel')
      .should('have.been.calledWith', 'readOnly')
      .then(() => {
        openDocs.unsavedDocs = () => []
        openDocs.hasUnsavedChanges = () => false
      })

    cy.tick(1000)

    cy.get('@setPermissionsLevel').should('have.been.calledWith', 'owner')
  })

  describe('with intermittent-connection-improvements enabled', function () {
    it('does not lock a free user before the raised 120s threshold', function () {
      const setPermissionsLevel = cy.stub().as('setPermissionsLevel')
      const now = performance.now()
      // 100s would exceed the default 30s limit, but not the raised free limit
      const openDocs = makeOpenDocsStub([
        makeDocStub('doc1', { pendingAt: now - 100_000 }),
      ])

      mount(openDocs, setPermissionsLevel, {
        isPremiumUser: false,
        intermittentConnectionImprovementsEnabled: true,
      })
      cy.tick(1000)

      cy.get('@setPermissionsLevel').should('not.have.been.called')
    })

    it('locks a free user after the raised 120s threshold', function () {
      const setPermissionsLevel = cy.stub().as('setPermissionsLevel')
      const now = performance.now()
      const openDocs = makeOpenDocsStub([
        makeDocStub('doc1', { pendingAt: now - 121_000 }),
      ])

      mount(openDocs, setPermissionsLevel, {
        isPremiumUser: false,
        intermittentConnectionImprovementsEnabled: true,
      })
      cy.tick(1000)

      cy.get('@setPermissionsLevel').should('have.been.calledWith', 'readOnly')
    })

    it('does not lock a premium user before the raised 600s threshold', function () {
      const setPermissionsLevel = cy.stub().as('setPermissionsLevel')
      const now = performance.now()
      // 200s exceeds the free 120s limit, but not the premium 600s limit
      const openDocs = makeOpenDocsStub([
        makeDocStub('doc1', { pendingAt: now - 200_000 }),
      ])

      mount(openDocs, setPermissionsLevel, {
        isPremiumUser: true,
        intermittentConnectionImprovementsEnabled: true,
      })
      cy.tick(1000)

      cy.get('@setPermissionsLevel').should('not.have.been.called')
    })

    it('locks a premium user after the raised 600s threshold', function () {
      const setPermissionsLevel = cy.stub().as('setPermissionsLevel')
      const now = performance.now()
      const openDocs = makeOpenDocsStub([
        makeDocStub('doc1', { pendingAt: now - 601_000 }),
      ])

      mount(openDocs, setPermissionsLevel, {
        isPremiumUser: true,
        intermittentConnectionImprovementsEnabled: true,
      })
      cy.tick(1000)

      cy.get('@setPermissionsLevel').should('have.been.calledWith', 'readOnly')
    })
  })

  it('calls event.preventDefault() on beforeunload when there are unsaved changes', function () {
    const openDocs = makeOpenDocsStub([
      makeDocStub('doc1', { pendingAt: performance.now() - 5_000 }),
    ])

    mount(openDocs)

    cy.window().then(win => {
      const event = new win.Event('beforeunload', { cancelable: true })
      win.dispatchEvent(event)
      expect(event.defaultPrevented).to.be.true
    })
  })

  it('does not prevent beforeunload when all docs are saved', function () {
    mount()

    cy.window().then(win => {
      const event = new win.Event('beforeunload', { cancelable: true })
      win.dispatchEvent(event)
      expect(event.defaultPrevented).to.be.false
    })
  })
})
