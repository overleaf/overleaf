import OfflineIndicator from '@/features/ide-react/components/toolbar/offline-indicator'

describe('<OfflineIndicator />', function () {
  it('renders an empty live region when online', function () {
    cy.mount(<OfflineIndicator isOffline={false} />)
    cy.findByText('You’re offline').should('not.exist')
    cy.findByRole('status').should('be.empty')
  })

  it('shows the offline indicator when offline', function () {
    cy.mount(<OfflineIndicator isOffline />)
    cy.findAllByText('You’re offline').first().should('be.visible')
  })

  it('announces the offline status to screen readers via a live region', function () {
    cy.mount(<OfflineIndicator isOffline />)
    cy.findByRole('status').within(() => {
      cy.findByText('You’re offline').should('exist')
      cy.findByText(
        'Your changes are saved in the browser. We’ll sync your work when you’re back online.'
      ).should('exist')
    })
  })
})
