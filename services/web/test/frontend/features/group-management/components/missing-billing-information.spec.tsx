import { SplitTestProvider } from '@/shared/context/split-test-context'
import MissingBillingInformation from '@/features/group-management/components/missing-billing-information'

describe('<MissingBillingInformation />', function () {
  beforeEach(function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-groupName', 'My Awesome Team')
    })

    cy.mount(
      <SplitTestProvider>
        <MissingBillingInformation />
      </SplitTestProvider>
    )
  })

  it('shows missing payment details notification', function () {
    cy.findByRole('alert').within(() => {
      cy.findByText(/missing payment details/i)
      cy.findByText(
        /it looks like your payment details are missing\. Please.*, or.*with our Support team for more help/i
      ).within(() => {
        cy.findByRole('link', {
          name: /update your billing information/i,
        }).should(
          'have.attr',
          'href',
          '/user/subscription/payment/billing-details'
        )
        cy.findByRole('link', { name: /get in touch/i }).should(
          'have.attr',
          'href',
          '/contact'
        )
      })
    })
  })
})
