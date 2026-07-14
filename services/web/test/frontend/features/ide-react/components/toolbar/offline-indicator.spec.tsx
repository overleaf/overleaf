import OfflineIndicator from '@/features/ide-react/components/toolbar/offline-indicator'
import { UnsavedDocsContext } from '@/features/ide-react/context/unsaved-docs-context'
import { IdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { IdeEventEmitter } from '@/features/ide-react/create-ide-event-emitter'
import { SplitTestProvider } from '@/shared/context/split-test-context'

const defaultIdeReactContextValue = {
  projectId: 'test-project',
  eventEmitter: new IdeEventEmitter(),
  startedFreeTrial: false,
  setStartedFreeTrial: () => {},
  reportError: () => {},
  projectJoined: true,
  permissionsLevel: 'owner' as const,
  setPermissionsLevel: () => {},
  outOfSync: false,
  setOutOfSync: () => {},
}

const defaultUnsavedDocsContextValue = {
  unsavedDocs: new Map<string, number>(),
  isLocked: false,
  isSavingStalled: false,
}

const mount = ({
  unsavedDocs = new Map<string, number>(),
}: {
  unsavedDocs?: Map<string, number>
} = {}) => {
  cy.mount(
    <SplitTestProvider>
      <IdeReactContext.Provider value={defaultIdeReactContextValue}>
        <UnsavedDocsContext.Provider
          value={{ ...defaultUnsavedDocsContextValue, unsavedDocs }}
        >
          <OfflineIndicator />
        </UnsavedDocsContext.Provider>
      </IdeReactContext.Provider>
    </SplitTestProvider>
  )
}

const enableFlag = () => {
  cy.window().then(win => {
    win.metaAttributesCache.set('ol-splitTestVariants', {
      'intermittent-connection-improvements': 'enabled',
    })
  })
}

const unsavedDoc = () => new Map<string, number>([['doc-1', 20]])

describe('<OfflineIndicator />', function () {
  it('is hidden when the feature flag is disabled', function () {
    mount({ unsavedDocs: unsavedDoc() })
    cy.findByText('You’re offline').should('not.exist')
    cy.findByRole('status').should('not.exist')
  })

  it('is hidden when the flag is enabled but there are no unsaved docs', function () {
    enableFlag()
    mount()
    cy.findByText('You’re offline').should('not.exist')
    cy.findByRole('status').should('be.empty')
  })

  it('is shown when the flag is enabled and there are unsaved docs', function () {
    enableFlag()
    mount({ unsavedDocs: unsavedDoc() })
    cy.findAllByText('You’re offline').first().should('be.visible')
  })

  it('announces the offline status to screen readers via a live region', function () {
    enableFlag()
    mount({ unsavedDocs: unsavedDoc() })
    cy.findByRole('status').within(() => {
      cy.findByText('You’re offline').should('exist')
      cy.findByText(
        'Your changes are saved in the browser. We’ll sync your work when you’re back online.'
      ).should('exist')
    })
  })
})
