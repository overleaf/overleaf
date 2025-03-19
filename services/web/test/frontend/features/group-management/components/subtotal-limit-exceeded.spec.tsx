import SubtotalLimitExceeded from '@/features/group-management/components/subtotal-limit-exceeded'

describe('<SubtotalLimitExceeded />', function () {
  beforeEach(function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-groupName', 'My Awesome Team')
    })

    cy.mount(<SubtotalLimitExceeded />)
  })

  it('shows subtotal limit exceeded notification', function () {
    cy.findByRole('alert').within(() => {
      cy.findByText(
        /sorry, there was an issue upgrading your subscription\. Please.*for help/i
      ).within(() => {
        cy.findByRole('link', {
          name: /contact our support team/i,
        }).should('have.attr', 'href', '/contact')
      })
    })
  })
})
