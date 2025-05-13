import UpgradeSubscription from '@/features/group-management/components/upgrade-subscription/upgrade-subscription'
import { SubscriptionChangePreview } from '../../../../../types/subscription/subscription-change-preview'

describe('<UpgradeSubscription />', function () {
  const resetPreviewAndRemount = (preview: SubscriptionChangePreview) => {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-subscriptionChangePreview', preview)
    })

    cy.mount(<UpgradeSubscription />)
  }
  beforeEach(function () {
    this.totalLicenses = 2
    this.preview = {
      change: {
        type: 'group-plan-upgrade',
        prevPlan: { name: 'Overleaf Standard Group' },
      },
      currency: 'USD',
      immediateCharge: {
        subtotal: 353.99,
        tax: 70.8,
        total: 424.79,
        discount: 0,
      },
      paymentMethod: 'Visa **** 1111',
      nextPlan: { annual: true },
      nextInvoice: {
        date: '2025-11-05T11:35:32.000Z',
        plan: { name: 'Overleaf Professional Group', amount: 0 },
        addOns: [
          {
            code: 'additional-license',
            name: 'Seat',
            quantity: 2,
            unitAmount: 399,
            amount: 798,
          },
        ],
        subtotal: 798,
        tax: { rate: 0.2, amount: 159.6 },
        total: 957.6,
      },
    }

    cy.window().then(win => {
      win.metaAttributesCache.set('ol-groupName', 'My Awesome Team')
      win.metaAttributesCache.set('ol-totalLicenses', this.totalLicenses)
    })
    resetPreviewAndRemount(this.preview)
  })

  it('shows the group name', function () {
    cy.findByTestId('group-heading').within(() => {
      cy.findByRole('heading', { name: 'My Awesome Team' })
    })
  })

  it('shows the "Add more licenses to my plan" label', function () {
    cy.findByText(/add more licenses to my plan/i).should(
      'have.attr',
      'href',
      '/user/subscription/group/add-users'
    )
  })

  it('shows the "Upgrade" and "Cancel" buttons', function () {
    cy.findByRole('button', { name: /upgrade/i })
    cy.findByRole('link', { name: /cancel/i }).should(
      'have.attr',
      'href',
      '/user/subscription'
    )
  })

  describe('shows plan details', function () {
    it('shows per user price', function () {
      cy.findByTestId('per-user-price').within(() => {
        cy.findByText('$399')
      })
    })

    it('shows additional features', function () {
      cy.findByText(/unlimited collaborators per project/i)
      cy.findByText(/sso/i)
      cy.findByText(/managed user accounts/i)
    })
  })

  describe('shows upgrade summary', function () {
    it('shows subtotal, tax and total price', function () {
      cy.findByTestId('subtotal').within(() => {
        cy.findByText('$353.99')
      })
      cy.findByTestId('tax').within(() => {
        cy.findByText('$70.80')
      })
      cy.findByTestId('total').within(() => {
        cy.findByText('$424.79')
      })
      cy.findByTestId('discount').should('not.exist')
    })

    it('shows subtotal, discount, tax and total price', function () {
      resetPreviewAndRemount({
        ...this.preview,
        immediateCharge: {
          subtotal: 353.99,
          tax: 70.8,
          total: 424.79,
          discount: 50,
        },
      })
      cy.findByTestId('subtotal').within(() => {
        cy.findByText('$353.99')
      })
      cy.findByTestId('tax').within(() => {
        cy.findByText('$70.80')
      })
      cy.findByTestId('total').within(() => {
        cy.findByText('$424.79')
      })
      cy.findByTestId('discount').within(() => {
        cy.findByText('($50.00)')
      })
    })

    it('shows total users', function () {
      cy.findByText(/you have 2 licenses on your subscription./i)
    })
  })

  describe('submit upgrade request', function () {
    it('request succeeded', function () {
      cy.intercept('POST', '/user/subscription/group/upgrade-subscription', {
        statusCode: 200,
      }).as('upgradeRequest')
      cy.findByRole('button', { name: /upgrade/i }).click()
      cy.findByText(/you’ve upgraded your plan!/i)
    })

    it('request failed', function () {
      cy.intercept('POST', '/user/subscription/group/upgrade-subscription', {
        statusCode: 400,
      }).as('upgradeRequest')
      cy.findByRole('button', { name: /upgrade/i }).click()
      cy.findByText(/something went wrong/i)
    })
  })
})
