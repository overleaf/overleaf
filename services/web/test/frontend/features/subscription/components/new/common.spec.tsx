import {
  createFakeRecurly,
  defaultSubscription,
} from '../../fixtures/recurly-mock'
import { PaymentProvider } from '../../../../../../frontend/js/features/subscription/context/payment-context'
import { plans } from '../../fixtures/plans'
import PaymentPreviewPanel from '../../../../../../frontend/js/features/subscription/components/new/payment-preview/payment-preview-panel'
import CheckoutPanel from '../../../../../../frontend/js/features/subscription/components/new/checkout/checkout-panel'
import { fillForm } from '../../helpers/payment'

describe('common recurly validations', function () {
  beforeEach(function () {
    const plan = plans.find(({ planCode }) => planCode === 'collaborator')

    if (!plan) {
      throw new Error('No plan was found while running the test!')
    }

    cy.window().then(win => {
      win.metaAttributesCache = new Map()
      win.metaAttributesCache.set('ol-countryCode', '')
      win.metaAttributesCache.set('ol-recurlyApiKey', '1234')
      win.metaAttributesCache.set('ol-recommendedCurrency', 'USD')
      win.metaAttributesCache.set('ol-plan', plan)
      win.metaAttributesCache.set('ol-planCode', plan.planCode)
      win.metaAttributesCache.set('ol-showCouponField', true)
      win.recurly = createFakeRecurly(defaultSubscription)
      cy.interceptEvents()
    })
  })

  it('initializes recurly', function () {
    cy.window().then(win => {
      cy.spy(win.recurly, 'configure')
      cy.spy(win.recurly.Pricing, 'Subscription')
    })

    cy.mount(<PaymentProvider publicKey="0000" />)

    cy.window().then(win => {
      expect(win.recurly.configure).to.be.calledOnce
      expect(win.recurly.Pricing.Subscription).to.be.calledOnce
    })
  })

  it('shows three d secure challenge content only once when changing currency', function () {
    cy.intercept('POST', 'user/subscription/create', {
      statusCode: 404,
      body: {
        threeDSecureActionTokenId: '123',
      },
    })

    cy.mount(
      <PaymentProvider publicKey="0000">
        <PaymentPreviewPanel />
        <CheckoutPanel />
      </PaymentProvider>
    )
    cy.findByTestId('checkout-form').within(() => fillForm())
    cy.findByRole('button', { name: /upgrade now/i }).click()
    cy.findByRole('button', { name: /change currency/i }).click()
    cy.findByRole('menu').within(() => {
      cy.findByRole('menuitem', { name: /gbp/i }).click()
    })
    cy.findAllByText('3D challenge content').should('have.length', 1)
  })
})
