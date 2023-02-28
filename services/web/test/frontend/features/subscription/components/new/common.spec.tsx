import {
  createFakeRecurly,
  defaultSubscription,
} from '../../fixtures/recurly-mock'
import { PaymentProvider } from '../../../../../../frontend/js/features/subscription/context/payment-context'
import { plans } from '../../fixtures/plans'

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
})
