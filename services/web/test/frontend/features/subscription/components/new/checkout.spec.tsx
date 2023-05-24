import CheckoutPanel from '../../../../../../frontend/js/features/subscription/components/new/checkout/checkout-panel'
import { PaymentProvider } from '../../../../../../frontend/js/features/subscription/context/payment-context'
import { plans } from '../../fixtures/plans'
import {
  createFakeRecurly,
  defaultSubscription,
  ElementsBase,
} from '../../fixtures/recurly-mock'
import { fillForm } from '../../helpers/payment'
import { cloneDeep } from 'lodash'
import { TokenHandler, RecurlyError } from 'recurly__recurly-js'

function CheckoutPanelWithPaymentProvider() {
  return (
    <PaymentProvider publicKey="0000">
      <CheckoutPanel />
    </PaymentProvider>
  )
}

describe('checkout panel', function () {
  const itmCampaign = 'fake_itm_campaign'
  const itmContent = 'fake_itm_content'
  const itmReferrer = 'fake_itm_referrer'

  beforeEach(function () {
    const plan = plans.find(({ planCode }) => planCode === 'student-annual')

    if (!plan) {
      throw new Error('No plan was found while running the test!')
    }

    cy.window().then(win => {
      win.metaAttributesCache = new Map()
      win.metaAttributesCache.set('ol-countryCode', '')
      win.metaAttributesCache.set('ol-recurlyApiKey', '0000')
      win.metaAttributesCache.set('ol-recommendedCurrency', 'USD')
      win.metaAttributesCache.set('ol-plan', plan)
      win.metaAttributesCache.set('ol-planCode', plan.planCode)
      win.metaAttributesCache.set('ol-showCouponField', true)
      win.metaAttributesCache.set('ol-itm_campaign', itmCampaign)
      win.metaAttributesCache.set('ol-itm_content', itmContent)
      win.metaAttributesCache.set('ol-itm_referrer', itmReferrer)

      cy.wrap(plan).as('plan')

      // init default recurly
      win.recurly = createFakeRecurly(defaultSubscription)

      cy.interceptEvents()
    })

    cy.mount(<CheckoutPanelWithPaymentProvider />)
    cy.findByTestId('checkout-form').as('form')
  })

  it('renders heading', function () {
    cy.contains(/select a payment method/i)
  })

  it('renders student disclaimer', function () {
    cy.contains(
      'The educational discount applies to all students at secondary and postsecondary institutions ' +
        '(schools and universities). We may contact you to confirm that you’re eligible for the discount.'
    )
  })

  it('renders payment method toggle', function () {
    cy.findByTestId('payment-method-toggle').within(() => {
      cy.findByLabelText(/card payment/i)
      cy.findByLabelText(/paypal/i)
    })
  })

  it('renders address first line input', function () {
    cy.get('@form').within(() => {
      cy.findByLabelText('Address')
      cy.findByLabelText(/this address will be shown on the invoice/i)
    })
  })

  it('renders address second line input', function () {
    cy.get('@form').within(() => {
      cy.findByLabelText(/address second line/i).should('not.exist')
      cy.findByRole('button', { name: /add another address line/i }).click()
      cy.findByLabelText(/address second line/i)
    })
  })

  it('renders postal code input', function () {
    cy.get('@form').within(() => {
      cy.findByLabelText(/postal code/i)
    })
  })

  it('renders country dropdown', function () {
    cy.get('@form').within(() => {
      cy.findByLabelText(/country/i)
    })
  })

  it('renders company details', function () {
    cy.get('@form').within(() => {
      cy.findByLabelText(/add company details/i).as('checkbox')
      cy.get('@checkbox').should('not.be.checked')
      cy.findByLabelText(/company name/i).should('not.exist')
      cy.findByLabelText(/vat number/i).should('not.exist')
      cy.get('@checkbox').click()
      cy.findByLabelText(/company name/i)
      cy.findByLabelText(/vat number/i)
    })
  })

  it('renders coupon field', function () {
    cy.get('@form').within(() => {
      cy.findByLabelText(/coupon code/i)
    })
  })

  it('renders tos agreement notice', function () {
    cy.contains(/by subscribing, you agree to our terms of service/i)
  })

  it('renders recurly error', function () {
    cy.window().then(win => {
      win.recurly = undefined!
    })
    cy.mount(<CheckoutPanelWithPaymentProvider />)
    cy.contains(
      /sorry, there was an error talking to our payment provider. Please try again in a few moments/i
    )
    cy.contains(
      /if you are using any ad or script blocking extensions in your browser, you may need to temporarily disable them/i
    )
  })

  it('calls recurly.token on submit', function () {
    cy.window().then(win => {
      cy.stub(win.recurly, 'token')
    })
    cy.mount(<CheckoutPanelWithPaymentProvider />)
    cy.get('@form').within(() => fillForm())
    cy.findByRole('button', { name: /upgrade now/i }).click()

    cy.window().then(win => {
      expect(win.recurly.token).to.be.calledOnceWith(
        Cypress.sinon.match.instanceOf(ElementsBase),
        {
          first_name: '1',
          last_name: '1',
          postal_code: '1',
          address1: '1',
          address2: '',
          state: '',
          city: '',
          country: 'BG',
          coupon: '',
        },
        Cypress.sinon.match.func
      )
    })
  })

  it('renders generic error', function () {
    const errorMessage = 'generic error'
    cy.window().then(win => {
      win.recurly = createFakeRecurly(defaultSubscription, {
        token: (_1: unknown, _2: unknown, handler: TokenHandler) => {
          const err = new Error(errorMessage) as RecurlyError
          setTimeout(() => handler(err, { id: '1', type: 'abc' }), 100)
        },
      })
    })
    cy.mount(<CheckoutPanelWithPaymentProvider />)
    cy.get('@form').within(() => fillForm())

    cy.findByRole('button', { name: /upgrade now/i }).as('button')
    cy.get('@button').click()
    cy.get('@button').within(() => {
      cy.contains(/processing/i)
    })
    cy.findByRole('alert').should('have.text', errorMessage)
    cy.get('@button').within(() => {
      cy.findByText(/processing/i).should('not.exist')
    })
  })

  it('renders prefilled coupon input', function () {
    const couponCode = 'promo_code'
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-couponCode', couponCode)
    })
    cy.mount(<CheckoutPanelWithPaymentProvider />)
    cy.findByLabelText(/coupon code/i).should('have.value', couponCode)
  })

  it('calls coupon method when entering coupon code', function () {
    const couponCode = 'promo_code'
    cy.window().then(win => {
      const couponStub = cy.stub().as('coupon')
      couponStub.returnsThis()
      win.recurly = createFakeRecurly({
        ...defaultSubscription,
        coupon: couponStub,
      })
    })
    cy.mount(<CheckoutPanelWithPaymentProvider />)
    cy.get('@coupon').should('have.been.calledOnce')
    cy.findByTestId('checkout-form').within(() => {
      cy.findByLabelText(/coupon code/i).type(couponCode, { delay: 0 })
      cy.findByLabelText(/coupon code/i).blur()
    })
    cy.get('@coupon')
      .should('have.been.calledTwice')
      .and('have.been.calledWith', couponCode)
  })

  it('enters invalid coupon code', function () {
    cy.window().then(win => {
      const catchStub = cy.stub().as('catch')
      catchStub.onFirstCall().returnsThis()
      catchStub
        .onSecondCall()
        .callsFake(function (this: unknown, cb: (err: RecurlyError) => void) {
          const err = {
            name: 'api-error',
            code: 'not-found',
          } as RecurlyError

          cb(err)
          return this
        })

      win.recurly = createFakeRecurly({
        ...defaultSubscription,
        catch: catchStub,
      })
    })
    cy.mount(<CheckoutPanelWithPaymentProvider />)
    cy.findByTestId('checkout-form').within(() => {
      cy.findByLabelText(/coupon code/i).type('promo_code', { delay: 0 })
      cy.findByLabelText(/coupon code/i).blur()
    })
    cy.findByRole('alert').within(() => {
      cy.contains(/coupon code is not valid for selected plan/i)
    })
  })

  it('fails coupon verification', function () {
    cy.window().then(win => {
      const catchStub = cy.stub().as('catch')
      // call original method on change event
      catchStub.onFirstCall().returnsThis()
      catchStub
        .onSecondCall()
        .callsFake(function (this: unknown, cb: (err: RecurlyError) => void) {
          const err = {} as RecurlyError

          try {
            cb(err)
          } catch (e) {}

          return this
        })

      win.recurly = createFakeRecurly({
        ...defaultSubscription,
        catch: catchStub,
      })
    })
    cy.mount(<CheckoutPanelWithPaymentProvider />)
    cy.get('@catch').should('have.been.calledOnce')
    cy.findByTestId('checkout-form').within(() => {
      cy.findByLabelText(/coupon code/i).type('promo_code', { delay: 0 })
      cy.findByLabelText(/coupon code/i).blur()
    })
    cy.get('@catch').should('have.been.calledTwice')
    cy.findByRole('alert').within(() => {
      cy.contains(/an error occurred when verifying the coupon code/i)
    })
  })

  /* The test is disabled due to https://github.com/overleaf/internal/issues/12004
  it.skip('creates a new subscription', function () {
    cy.stub(locationModule, 'assign').as('assign')
    cy.intercept('POST', 'user/subscription/create', {
      statusCode: 201,
    }).as('create')

    cy.mount(<CheckoutPanelWithPaymentProvider />)
    cy.findByTestId('checkout-form').within(() => fillForm())
    cy.findByRole('button', { name: /upgrade now/i }).click()
    // verify itm params are also passed
    cy.get('@create')
      .its('request.body.subscriptionDetails')
      .should('contain', {
        ITMCampaign: itmCampaign,
        ITMContent: itmContent,
        ITMReferrer: itmReferrer,
      })
    cy.get('@assign')
      .should('have.been.calledOnce')
      .and('have.been.calledWith', '/user/subscription/thank-you')
  })
  */

  it('fails to create a new subscription', function () {
    cy.intercept('POST', 'user/subscription/create', {
      statusCode: 404,
    })

    cy.mount(<CheckoutPanelWithPaymentProvider />)
    cy.findByTestId('checkout-form').within(() => fillForm())
    cy.findByRole('button', { name: /upgrade now/i }).click()
    cy.findByRole('alert').within(() => {
      cy.contains(/something went wrong processing the request/i)
    })
  })

  describe('3DS challenge', function () {
    it('shows three d secure challenge', function () {
      cy.intercept('POST', 'user/subscription/create', {
        statusCode: 404,
        body: {
          threeDSecureActionTokenId: '123',
        },
      })

      cy.mount(<CheckoutPanelWithPaymentProvider />)
      cy.findByTestId('checkout-form').within(() => fillForm())
      cy.findByRole('button', { name: /upgrade now/i }).click()
      cy.findByRole('alert').within(() => {
        cy.contains(
          /your card must be authenticated with 3D Secure before continuing/i
        )
      })
      cy.contains('3D challenge content')
    })
  })

  describe('card payments', function () {
    beforeEach(function () {
      cy.findByLabelText(/card payment/i).click()
    })

    it('renders card element', function () {
      cy.get('@form').within(() => {
        cy.findByText(/card details/i, { selector: 'label' })
        cy.findByTestId('test-card-element')
      })
    })

    it('verifies the card element does not disappear when switching between payment methods', function () {
      cy.get('@form').within(() => {
        cy.findByText(/card details/i, { selector: 'label' })
        cy.findByTestId('test-card-element')
        cy.findByLabelText(/paypal/i).click()
        cy.findByLabelText(/card payment/i).click()
        cy.findByText(/card details/i, { selector: 'label' })
        cy.findByTestId('test-card-element')
      })
    })

    it('renders first name input', function () {
      cy.get('@form').within(() => {
        cy.findByLabelText(/first name/i)
      })
    })

    it('renders last name input', function () {
      cy.get('@form').within(() => {
        cy.findByLabelText(/last name/i)
      })
    })

    describe('submit button', function () {
      it('renders trial button', function () {
        cy.get('@form').within(() => {
          cy.findByRole('button', { name: /upgrade now, pay after \d+ days/i })
        })
      })

      it('renders non-trial button', function () {
        cy.window().then(win => {
          const clone = cloneDeep(defaultSubscription)
          clone.items.plan!.trial = undefined
          win.recurly = createFakeRecurly(clone)
        })
        cy.mount(<CheckoutPanelWithPaymentProvider />)
        cy.findByTestId('checkout-form').within(() => {
          cy.findByRole('button', { name: 'Upgrade Now' })
        })
      })

      it('handles the disabled state of submit button', function () {
        cy.get('@form').within(() => {
          cy.findByRole('button', { name: /upgrade now/i }).should(
            'be.disabled'
          )
          fillForm()
          cy.findByRole('button', { name: /upgrade now/i }).should(
            'not.be.disabled'
          )
        })
      })
    })
  })

  describe('paypal payments', function () {
    beforeEach(function () {
      cy.findByLabelText(/paypal/i).click()
    })

    it('should not render card element', function () {
      cy.get('@form').within(() => {
        cy.findByLabelText(/card details/i).should('not.exist')
      })
    })

    it('should not render first name input', function () {
      cy.get('@form').within(() => {
        cy.findByLabelText(/first name/i).should('not.exist')
      })
    })

    it('should not render last name input', function () {
      cy.get('@form').within(() => {
        cy.findByLabelText(/last name/i).should('not.exist')
      })
    })

    it('renders proceeding to PayPal notice', function () {
      cy.get('@form').within(() => {
        cy.contains(
          /proceeding to PayPal will take you to the PayPal site to pay for your subscription/i
        )
      })
    })

    it('handles the disabled state of submit button', function () {
      cy.get('@form').within(() => {
        cy.findByRole('button', { name: /proceed to paypal/i }).should(
          'be.disabled'
        )
        cy.findByLabelText(/country/i).select('Bulgaria')
        cy.findByRole('button', { name: /proceed to paypal/i }).should(
          'not.be.disabled'
        )
      })
    })
  })
})
