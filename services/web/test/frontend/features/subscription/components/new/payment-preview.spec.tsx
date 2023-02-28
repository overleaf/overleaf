import PaymentPreviewPanel from '../../../../../../frontend/js/features/subscription/components/new/payment-preview/payment-preview-panel'
import { PaymentProvider } from '../../../../../../frontend/js/features/subscription/context/payment-context'
import { plans } from '../../fixtures/plans'
import {
  createFakeRecurly,
  defaultSubscription,
} from '../../fixtures/recurly-mock'
import { cloneDeep } from 'lodash'
import { Plan } from '../../../../../../types/subscription/plan'

function PaymentPreviewPanelWithPaymentProvider() {
  return (
    <PaymentProvider publicKey="0000">
      <PaymentPreviewPanel />
    </PaymentProvider>
  )
}

describe('payment preview panel', function () {
  beforeEach(function () {
    const plan = plans.find(({ planCode }) => planCode === 'collaborator')

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
      cy.wrap(plan).as('plan')

      // init default recurly
      win.recurly = createFakeRecurly(defaultSubscription)
      cy.interceptEvents()
    })
  })

  it('renders plan name', function () {
    cy.mount(<PaymentPreviewPanelWithPaymentProvider />)

    cy.contains(defaultSubscription.items.plan!.name)
  })

  it('renders collaborators per project', function () {
    cy.mount(<PaymentPreviewPanelWithPaymentProvider />)

    cy.get<Plan>('@plan').then(plan => {
      cy.contains(`${plan.features?.collaborators} collaborators per project`)
    })
  })

  it('renders features list', function () {
    cy.mount(<PaymentPreviewPanelWithPaymentProvider />)

    cy.contains(/all premium features/i)
    cy.findByTestId('features-list').within(() => {
      cy.get(':nth-child(1)').contains(/increased compile timeout/i)
      cy.get(':nth-child(2)').contains(/sync with dropbox and github/i)
      cy.get(':nth-child(3)').contains(/full document history/i)
      cy.get(':nth-child(4)').contains(/track changes/i)
      cy.get(':nth-child(5)').contains(/advanced reference search/i)
      cy.get(':nth-child(6)').contains(/reference manager sync/i)
      cy.get(':nth-child(7)').contains(/symbol palette/i)
    })
  })

  it('renders no features list', function () {
    cy.window().then(win => {
      cy.get<Plan>('@plan').then(plan => {
        const { features: _, ...noFeaturesPlan } = plan
        win.metaAttributesCache.set('ol-plan', noFeaturesPlan)
      })
    })

    cy.mount(<PaymentPreviewPanelWithPaymentProvider />)

    cy.findByTestId('features-list').should('not.exist')
  })

  describe('price summary', function () {
    beforeEach(function () {
      cy.mount(<PaymentPreviewPanelWithPaymentProvider />)
      cy.findByTestId('price-summary').as('priceSummary')
      cy.findByTestId('price-summary-plan').as('priceSummaryPlan')
      cy.findByTestId('price-summary-coupon').as('priceSummaryCoupon')
      cy.findByTestId('price-summary-vat').as('priceSummaryVat')
      cy.findByTestId('price-summary-total').as('priceSummaryTotal')
    })

    it('renders title', function () {
      cy.get('@priceSummary').contains(/payment summary/i)
    })

    it('renders plan info', function () {
      cy.get('@priceSummaryPlan').contains(defaultSubscription.items.plan!.name)
      cy.get('@priceSummaryPlan').contains(
        `$${defaultSubscription.price.base.plan.unit}`
      )
    })

    it('renders coupon info', function () {
      cy.get('@priceSummaryCoupon').contains(
        defaultSubscription.items.coupon!.name
      )
      cy.get('@priceSummaryCoupon').contains(
        `Discount of $${defaultSubscription.price.now.discount}`
      )
    })

    it('does not render coupon info when there is no coupon', function () {
      cy.window().then(win => {
        const { coupon: _, ...items } = defaultSubscription.items
        win.recurly = createFakeRecurly({ ...defaultSubscription, items })
      })
      cy.mount(<PaymentPreviewPanelWithPaymentProvider />)
      cy.findByTestId('price-summary-coupon').should('not.exist')
    })

    it('renders VAT', function () {
      cy.get('@priceSummaryVat').contains(
        `VAT ${parseFloat(defaultSubscription.price.taxes[0].rate) * 100}%`
      )
      cy.get('@priceSummaryVat').contains(
        `$${defaultSubscription.price.now.tax}`
      )
    })

    describe('total amount', function () {
      it('renders "total per month" text', function () {
        cy.window().then(win => {
          const clone = cloneDeep(defaultSubscription)
          clone.items.plan!.period.length = 1
          win.recurly = createFakeRecurly(clone)
        })
        cy.mount(<PaymentPreviewPanelWithPaymentProvider />)
        cy.findByTestId('price-summary-total').contains(/total per month/i)
      })

      it('renders "total per year" text', function () {
        cy.window().then(win => {
          const clone = cloneDeep(defaultSubscription)
          clone.items.plan!.period.length = 2
          win.recurly = createFakeRecurly(clone)
        })
        cy.mount(<PaymentPreviewPanelWithPaymentProvider />)
        cy.findByTestId('price-summary-total').contains(/total per year/i)
      })

      it('renders total amount', function () {
        cy.get('@priceSummaryTotal').contains(
          `$${defaultSubscription.price.now.total}`
        )
      })
    })

    it('renders "change currency" dropdown and changes currency', function () {
      cy.get('@priceSummary').within(() => {
        cy.get('@priceSummary')
          .findByRole('button', { name: /change currency/i })
          .as('button')
        cy.findByRole('menu').should('not.exist')
        cy.get('@button').click()
        cy.findByRole('menu').within(() => {
          cy.findByRole('menuitem', { name: /usd \(\$\)/i }).contains(
            /selected/i
          )
          cy.findByRole('menuitem', { name: /eur \(€\)/i })
          cy.findByRole('menuitem', { name: /gbp \(£\)/i }).click()

          cy.get('@priceSummaryPlan').contains(
            `£${defaultSubscription.price.base.plan.unit}`
          )
          cy.get('@priceSummaryCoupon').contains(
            `Discount of £${defaultSubscription.price.now.discount}`
          )
          cy.get('@priceSummaryVat').contains(
            `£${defaultSubscription.price.now.tax}`
          )
          cy.get('@priceSummaryTotal').contains(
            `£${defaultSubscription.price.now.total}`
          )
        })
      })
      cy.findByTestId('trial-coupon-summary')
        .should('not.contain.text', '$')
        .should('contain.text', '£')
    })
  })

  describe('trial coupon summary', function () {
    it('renders trial price', function () {
      cy.mount(<PaymentPreviewPanelWithPaymentProvider />)
      cy.findByTestId('trial-coupon-summary').contains(
        `First ${defaultSubscription.items.plan!.trial!.length} days free, ` +
          `after that $${defaultSubscription.price.now.total} per month`
      )
    })

    it('renders "X price for Y months"', function () {
      cy.window()
        .then(win => {
          const clone = cloneDeep(defaultSubscription)
          clone.items.coupon!.applies_for_months = 6
          clone.items.coupon!.single_use = false
          clone.items.plan!.period.length = 1
          win.recurly = createFakeRecurly(clone)
          return clone
        })
        .then((clone: typeof defaultSubscription) => {
          cy.mount(<PaymentPreviewPanelWithPaymentProvider />)
          cy.findByTestId('trial-coupon-summary').contains(
            `$${clone.price.now.total} for your first ${
              clone.items.coupon!.applies_for_months
            } months`
          )
        })
    })

    it('renders "X price for first month"', function () {
      cy.window()
        .then(win => {
          const clone = cloneDeep(defaultSubscription)
          clone.items.plan!.period.length = 1
          win.recurly = createFakeRecurly(clone)
        })
        .then(() => {
          cy.mount(<PaymentPreviewPanelWithPaymentProvider />)
          cy.findByTestId('trial-coupon-summary').contains(
            `$${defaultSubscription.price.now.total} for your first month`
          )
        })
    })

    it('renders "X price for first year"', function () {
      cy.mount(<PaymentPreviewPanelWithPaymentProvider />)
      cy.findByTestId('trial-coupon-summary').contains(
        `$${defaultSubscription.price.now.total} for your first year`
      )
    })

    it('renders "then X price per month"', function () {
      cy.window()
        .then(win => {
          const clone = cloneDeep(defaultSubscription)
          clone.items.coupon!.applies_for_months = 6
          clone.items.coupon!.single_use = false
          clone.items.plan!.period.length = 1
          win.recurly = createFakeRecurly(clone)
        })
        .then(() => {
          cy.mount(<PaymentPreviewPanelWithPaymentProvider />)
          cy.findByTestId('trial-coupon-summary').contains(
            `Then $26.00 per month`
          )
        })
    })

    it('renders "then X price per year"', function () {
      cy.mount(<PaymentPreviewPanelWithPaymentProvider />)
      cy.findByTestId('trial-coupon-summary').contains(`Then $26.00 per year`)
    })

    it('renders "normally X price per month"', function () {
      cy.window()
        .then(win => {
          const clone = cloneDeep(defaultSubscription)
          clone.items.coupon!.applies_for_months = 0
          clone.items.coupon!.single_use = false
          clone.items.plan!.period.length = 1
          win.recurly = createFakeRecurly(clone)
        })
        .then(() => {
          cy.mount(<PaymentPreviewPanelWithPaymentProvider />)
          cy.findByTestId('trial-coupon-summary').contains(
            `Normally $26.00 per month`
          )
        })
    })

    it('renders "normally X price per year"', function () {
      cy.window()
        .then(win => {
          const clone = cloneDeep(defaultSubscription)
          clone.items.coupon!.single_use = false
          clone.items.plan!.period.length = 2
          win.recurly = createFakeRecurly(clone)
        })
        .then(() => {
          cy.mount(<PaymentPreviewPanelWithPaymentProvider />)
          cy.findByTestId('trial-coupon-summary').contains(
            `Normally $26.00 per year`
          )
        })
    })
  })

  it('renders "cancel anytime" content', function () {
    cy.mount(<PaymentPreviewPanelWithPaymentProvider />)

    cy.contains(
      /we’re confident that you’ll love Overleaf, but if not you can cancel anytime/i
    ).contains(
      /we’ll give you your money back, no questions asked, if you let us know within 30 days/i
    )
  })
})
