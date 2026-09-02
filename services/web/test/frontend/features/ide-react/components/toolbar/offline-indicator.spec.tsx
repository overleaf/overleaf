import OfflineIndicator from '@/features/ide-react/components/toolbar/offline-indicator'
import { IdeReactContext } from '@/features/ide-react/context/ide-react-context'

const mount = ({
  isOffline = false,
  outOfSync = false,
}: {
  isOffline?: boolean
  outOfSync?: boolean
} = {}) => {
  cy.mount(
    <IdeReactContext.Provider
      value={{
        projectId: '',
        eventEmitter: {} as any,
        startedFreeTrial: false,
        setStartedFreeTrial: () => {},
        reportError: () => {},
        projectJoined: true,
        permissionsLevel: 'readAndWrite',
        setPermissionsLevel: () => {},
        outOfSync,
        setOutOfSync: () => {},
      }}
    >
      <OfflineIndicator isOffline={isOffline} />
    </IdeReactContext.Provider>
  )
}

describe('<OfflineIndicator />', function () {
  it('renders an empty live region when online', function () {
    mount({ isOffline: false })
    cy.findByText('You’re offline').should('not.exist')
    cy.findByRole('status').should('be.empty')
  })

  it('shows the offline indicator when offline', function () {
    mount({ isOffline: true })
    cy.findAllByText('You’re offline').first().should('be.visible')
  })

  it('announces the offline status to screen readers via a live region', function () {
    mount({ isOffline: true })
    cy.findByRole('status').within(() => {
      cy.findByText('You’re offline').should('exist')
      cy.findByText(
        'Your changes are saved in the browser. We’ll sync your work when you’re back online.'
      ).should('exist')
    })
  })

  it('shows "Disconnected" without a tooltip when out of sync', function () {
    mount({ isOffline: true, outOfSync: true })
    cy.findAllByText('Disconnected')
      .first()
      .should('be.visible')
      .trigger('mouseover')
    cy.get('#tooltip-offline-indicator-tooltip').should('not.exist')
    cy.findByText('You’re offline').should('not.exist')
  })

  it('announces "Disconnected" to screen readers when out of sync', function () {
    mount({ isOffline: true, outOfSync: true })
    cy.findByRole('status').within(() => {
      cy.findByText('Disconnected').should('exist')
      cy.findByText(
        'Your changes are saved in the browser. We’ll sync your work when you’re back online.'
      ).should('not.exist')
    })
  })
})
