import { expect } from 'chai'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import * as eventTracking from '@/infrastructure/event-tracking'
import { PaidSubscription } from '../../../../../../../../types/subscription/dashboard/subscription'
import {
  annualActiveSubscription,
  annualActiveSubscriptionEuro,
  annualActiveSubscriptionWithAddons,
  annualActiveSubscriptionWithCoupons,
  groupActiveSubscription,
  groupActiveSubscriptionWithPendingLicenseChange,
  groupProfessionalActiveSubscription,
  monthlyActiveCollaborator,
  pendingSubscriptionChange,
  trialCollaboratorSubscription,
  trialSubscription,
} from '../../../../fixtures/subscriptions'
import sinon from 'sinon'
import { cleanUpContext } from '../../../../helpers/render-with-subscription-dash-context'
import { renderActiveSubscription } from '../../../../helpers/render-active-subscription'
import { cloneDeep } from 'lodash'
import fetchMock from 'fetch-mock'
import {
  cancelSubscriptionUrl,
  extendTrialUrl,
  subscriptionUpdateUrl,
} from '@/features/subscription/data/subscription-url'
import { location } from '@/shared/components/location'
import { MetaTag } from '@/utils/meta'

describe('<ActiveSubscription />', function () {
  let sendMBSpy: sinon.SinonSpy

  beforeEach(function () {
    sendMBSpy = sinon.spy(eventTracking, 'sendMB')
  })

  afterEach(function () {
    cleanUpContext()
    sendMBSpy.restore()
  })

  function expectedInActiveSubscription(subscription: PaidSubscription) {
    if (subscription.plan.annual) {
      within(screen.getByTestId('billing-period')).getByText((_, el) =>
        Boolean(
          el?.textContent?.includes(
            `Billed annually at ${subscription.payment.displayPrice}`
          )
        )
      )
      within(screen.getByTestId('plan-only-price')).getByText((_, el) =>
        Boolean(
          el?.textContent?.includes(
            `${subscription.payment.planOnlyDisplayPrice} per year`
          )
        )
      )
    } else {
      within(screen.getByTestId('billing-period')).getByText((_, el) =>
        Boolean(
          el?.textContent?.includes(
            `Billed monthly at ${subscription.payment.displayPrice}`
          )
        )
      )
      within(screen.getByTestId('plan-only-price')).getByText((_, el) =>
        Boolean(
          el?.textContent?.includes(
            `${subscription.payment.planOnlyDisplayPrice} per month`
          )
        )
      )
    }
    within(screen.getByTestId('renews-on')).getByText((_, el) =>
      Boolean(
        el?.textContent?.includes(
          `Renews on ${subscription.payment.nextPaymentDueDate}`
        )
      )
    )

    screen.getByRole('heading', { name: subscription.plan.name, level: 3 })

    screen.getByText(
      '* Prices may be subject to additional VAT, depending on your country.'
    )

    screen.getByRole('link', { name: 'View invoices' })

    if (subscription.payment.billingDetailsLink) {
      screen.getByRole('link', { name: 'View billing details' })
    }
  }

  it('renders the dash annual active subscription', function () {
    renderActiveSubscription(annualActiveSubscription)
    expectedInActiveSubscription(annualActiveSubscription)

    const button = screen.getByRole('button', { name: 'Change plan' })
    expect(button).to.exist
  })

  it('renders the dash annual active subscription in EUR', function () {
    renderActiveSubscription(annualActiveSubscriptionEuro)
    expectedInActiveSubscription(annualActiveSubscriptionEuro)
  })

  it('shows change plan UI when button clicked', async function () {
    renderActiveSubscription(annualActiveSubscription)
    expectedInActiveSubscription(annualActiveSubscription)

    const button = screen.getByRole('button', { name: 'Change plan' })
    fireEvent.click(button)

    await screen.findByRole('heading', { name: 'Change plan' })
    await waitFor(
      () =>
        expect(
          screen.getAllByRole('button', { name: 'Change to this plan' })
            .length > 0
        ).to.be.true
    )
  })

  it('does not show "Change plan" option when past due', function () {
    // account is likely in expired state, but be sure to not show option if state is still active
    const activePastDueSubscription = cloneDeep(annualActiveSubscription)
    activePastDueSubscription.payment.hasPastDueInvoice = true

    renderActiveSubscription(activePastDueSubscription)

    const changePlan = screen.queryByRole('button', { name: 'Change plan' })
    expect(changePlan).to.be.null
  })

  it('notes when user is changing plan at end of current plan term', function () {
    renderActiveSubscription(pendingSubscriptionChange)

    expectedInActiveSubscription(pendingSubscriptionChange)

    within(screen.getByTestId('pending-plan-change')).getByText((_, el) =>
      Boolean(
        el?.textContent?.includes(
          `Your plan is changing to ${pendingSubscriptionChange.pendingPlan!.name} at the end of the current billing period`
        )
      )
    )

    screen.getByText(
      'If you wish this change to apply before the end of your current billing period, please contact us.'
    )
  })

  it('shows the pending license change message when plan change is pending', function () {
    renderActiveSubscription(groupActiveSubscriptionWithPendingLicenseChange)

    within(screen.getByTestId('pending-plan-change')).getByText((_, el) =>
      Boolean(
        el?.textContent?.includes(
          `Your subscription is changing to include ${groupActiveSubscriptionWithPendingLicenseChange.payment.pendingAdditionalLicenses} additional license(s) for a total of ${groupActiveSubscriptionWithPendingLicenseChange.payment.pendingTotalLicenses}`
        )
      )
    )

    within(screen.getByTestId('plan-licenses')).getByText((_, el) =>
      Boolean(
        el?.textContent?.includes(
          `Supports up to ${groupActiveSubscriptionWithPendingLicenseChange.payment.totalLicenses}`
        )
      )
    )

    expect(
      screen.queryByText(
        'If you wish this change to apply before the end of your current billing period, please contact us.'
      )
    ).to.be.null
  })

  it('for legacy plans shows the pending license change message when plan change is not pending', function () {
    const subscription = cloneDeep(groupActiveSubscription)
    subscription.payment.additionalLicenses = 4
    subscription.payment.totalLicenses =
      subscription.payment.totalLicenses +
      subscription.payment.additionalLicenses

    renderActiveSubscription(subscription)

    within(screen.getByTestId('plan-licenses')).getByText((_, el) =>
      Boolean(
        el?.textContent?.includes(
          `Plus ${subscription.payment.additionalLicenses} additional license(s) for a total of ${subscription.payment.totalLicenses}`
        )
      )
    )
  })

  it('shows when trial ends and first payment collected and when subscription would become inactive if cancelled', function () {
    renderActiveSubscription(trialSubscription)

    within(screen.getByTestId('trial-ending')).getByText((_, el) =>
      Boolean(
        el?.textContent?.includes(
          `You’re on a free trial which ends on ${trialSubscription.payment.trialEndsAtFormatted}`
        )
      )
    )
  })

  it('shows correct actions for group plan: professional ', function () {
    renderActiveSubscription(groupProfessionalActiveSubscription)
    screen.getByRole('link', { name: /buy more licenses/i })
  })

  it('shows correct actions for group plan: standard (collaborator)', function () {
    renderActiveSubscription(groupActiveSubscription)
    screen.getByRole('link', { name: /upgrade plan/i })
    screen.getByRole('link', { name: /buy more licenses/i })
  })

  it('shows add-ons if present', function () {
    renderActiveSubscription(annualActiveSubscriptionWithAddons)
    screen.getByText('AI Assist')
  })

  it('shows empty add-ons message if none present', function () {
    renderActiveSubscription(annualActiveSubscription)
    screen.getByText(/You don’t have any add-ons on your account/i)
  })

  it('shows multiple active coupons', function () {
    renderActiveSubscription(annualActiveSubscriptionWithCoupons)
    within(screen.getByTestId('active-coupons')).getByText(
      'Coupon1 for 10% off',
      { exact: false }
    )
    within(screen.getByTestId('active-coupons')).getByText(
      'Coupon2 for 15% off',
      { exact: false }
    )
  })

  it('renders correct hrefs for invoice and billing details links', function () {
    renderActiveSubscription(annualActiveSubscription)
    const invoiceLink = screen.getByRole('link', { name: 'View invoices' })
    expect(invoiceLink.getAttribute('href')).to.equal(
      annualActiveSubscription.payment.accountManagementLink
    )
    const billingLink = screen.getByRole('link', {
      name: 'View billing details',
    })
    expect(billingLink.getAttribute('href')).to.equal(
      annualActiveSubscription.payment.billingDetailsLink
    )
  })

  describe('cancel plan', function () {
    beforeEach(function () {
      this.locationWrapperSandbox = sinon.createSandbox()
      this.locationWrapperStub = this.locationWrapperSandbox.stub(location)
    })

    afterEach(function () {
      this.locationWrapperSandbox.restore()
      fetchMock.removeRoutes().clearHistory()
    })

    function showConfirmCancelUI() {
      const button = screen.getByRole('button', {
        name: 'Cancel your subscription',
      })
      fireEvent.click(button)
    }

    it('shows cancel UI', function () {
      renderActiveSubscription(annualActiveSubscription)
      screen.getByText(
        'Your subscription will remain active until the end of your billing period',
        { exact: false }
      )
      const dates = screen.getAllByText(
        annualActiveSubscription.payment.nextPaymentDueAt,
        {
          exact: false,
        }
      )
      expect(dates.length).to.equal(2)
      const button = screen.getByRole('button', {
        name: 'Cancel your subscription',
      })
      expect(button).to.exist
    })

    it('shows cancel UI when still in a trial period', function () {
      renderActiveSubscription(trialSubscription)
      screen.getByText(
        'Your subscription will remain active until the end of your trial period',
        { exact: false }
      )
      const dates = screen.getAllByText(
        trialSubscription.payment.trialEndsAtFormatted!
      )
      expect(dates.length).to.equal(3)
      const button = screen.getByRole('button', {
        name: 'Cancel your subscription',
      })
      expect(button).to.exist
    })

    it('shows cancel prompt on button click and sends event', function () {
      renderActiveSubscription(annualActiveSubscription)

      showConfirmCancelUI()

      expect(sendMBSpy).to.be.calledOnceWith(
        'subscription-page-cancel-button-click'
      )

      screen.getByText('We’d love you to stay')
      screen.getByRole('button', { name: 'Cancel my subscription' })
    })

    it('cancels subscription and redirects page', async function () {
      const endPointResponse = {
        status: 200,
      }
      fetchMock.post(cancelSubscriptionUrl, endPointResponse)
      renderActiveSubscription(annualActiveSubscription)
      showConfirmCancelUI()
      const button = screen.getByRole('button', {
        name: 'Cancel my subscription',
      })
      fireEvent.click(button)
      const assignStub = this.locationWrapperStub.assign
      await waitFor(() => {
        expect(assignStub).to.have.been.called
      })
      sinon.assert.calledWithMatch(assignStub, '/user/subscription/canceled')
    })

    it('shows an error message if canceling subscription failed', async function () {
      const endPointResponse = {
        status: 500,
      }
      fetchMock.post(cancelSubscriptionUrl, endPointResponse)
      renderActiveSubscription(annualActiveSubscription)
      showConfirmCancelUI()
      const button = screen.getByRole('button', {
        name: 'Cancel my subscription',
      })
      fireEvent.click(button)
      await screen.findByText('Sorry, something went wrong. ', {
        exact: false,
      })
      screen.getByText('Please try again. ', { exact: false })
      screen.getByText('If the problem continues please contact us.', {
        exact: false,
      })
    })

    it('disables cancels subscription button after clicking and shows loading spinner', async function () {
      renderActiveSubscription(annualActiveSubscription)
      showConfirmCancelUI()
      screen.getByRole('button', {
        name: 'I want to stay',
      })
      const button = screen.getByRole('button', {
        name: 'Cancel my subscription',
      })
      fireEvent.click(button)

      const cancelButton = screen.getByRole('button', {
        name: 'Processing…',
      }) as HTMLButtonElement
      expect(cancelButton.disabled).to.be.true

      const hiddenText = screen.getByText('Cancel my subscription')
      expect(hiddenText.getAttribute('aria-hidden')).to.equal('true')
    })

    describe('extend trial', function () {
      const canExtend: MetaTag = {
        name: 'ol-userCanExtendTrial',
        value: true,
      }
      const cancelButtonText = 'No thanks, I still want to cancel'
      const extendTrialButtonText = 'I’ll take it!'
      it('shows alternate cancel subscription button text for cancel button and option to extend trial', function () {
        renderActiveSubscription(trialCollaboratorSubscription, [canExtend])
        showConfirmCancelUI()
        screen.getByText('Have another', { exact: false })
        screen.getByText('14 days', { exact: false })
        screen.getByText('on your Trial!', { exact: false })
        screen.getByRole('button', {
          name: cancelButtonText,
        })
        screen.getByRole('button', {
          name: extendTrialButtonText,
        })
      })

      it('disables both buttons and updates text for when trial button clicked', function () {
        renderActiveSubscription(trialCollaboratorSubscription, [canExtend])
        showConfirmCancelUI()
        const extendTrialButton = screen.getByRole('button', {
          name: extendTrialButtonText,
        })
        fireEvent.click(extendTrialButton)

        const buttons = screen.getAllByRole('button')
        expect(buttons.length).to.equal(2)
        expect(buttons[0].getAttribute('disabled')).to.equal('')
        expect(buttons[1].getAttribute('disabled')).to.equal('')
        screen.getByRole('button', {
          name: cancelButtonText,
        })
        screen.getByRole('button', {
          name: 'Processing…',
        })
      })

      it('disables both buttons and updates text for when cancel button clicked', function () {
        renderActiveSubscription(trialCollaboratorSubscription, [canExtend])
        showConfirmCancelUI()
        const cancelButtton = screen.getByRole('button', {
          name: cancelButtonText,
        })
        fireEvent.click(cancelButtton)

        const buttons = screen.getAllByRole('button')
        expect(buttons.length).to.equal(2)
        expect(buttons[0].getAttribute('disabled')).to.equal('')
        expect(buttons[1].getAttribute('disabled')).to.equal('')
        screen.getByRole('button', {
          name: 'Processing…',
        })
        screen.getByRole('button', {
          name: extendTrialButtonText,
        })
      })

      it('does not show option to extend trial when user is not eligible', function () {
        renderActiveSubscription(trialCollaboratorSubscription)
        showConfirmCancelUI()
        expect(
          screen.queryByRole('button', {
            name: extendTrialButtonText,
          })
        ).to.be.null
      })

      it('reloads page after the successful request to extend trial', async function () {
        const endPointResponse = {
          status: 200,
        }
        fetchMock.put(extendTrialUrl, endPointResponse)
        renderActiveSubscription(trialCollaboratorSubscription, [canExtend])
        showConfirmCancelUI()
        const extendTrialButton = screen.getByRole('button', {
          name: extendTrialButtonText,
        })
        fireEvent.click(extendTrialButton)
        // page is reloaded on success
        const reloadStub = this.locationWrapperStub.reload
        await waitFor(() => {
          expect(reloadStub).to.have.been.called
        })
      })
    })

    describe('downgrade plan', function () {
      const cancelButtonText = 'No thanks, I still want to cancel'
      const downgradeButtonText = 'Yes, move me to the Personal plan'
      it('shows alternate cancel subscription button text', async function () {
        renderActiveSubscription(monthlyActiveCollaborator)
        showConfirmCancelUI()
        await screen.findByRole('button', {
          name: cancelButtonText,
        })
        screen.getByRole('button', {
          name: downgradeButtonText,
        })
        screen.getByText('Would you be interested in the cheaper', {
          exact: false,
        })
        screen.getByText('Personal plan?', {
          exact: false,
        })
      })

      it('disables both buttons and updates text for when trial button clicked', async function () {
        renderActiveSubscription(monthlyActiveCollaborator)
        showConfirmCancelUI()
        const downgradeButton = await screen.findByRole('button', {
          name: downgradeButtonText,
        })
        fireEvent.click(downgradeButton)

        const buttons = screen.getAllByRole('button')
        expect(buttons.length).to.equal(2)
        expect(buttons[0].getAttribute('disabled')).to.equal('')
        expect(buttons[1].getAttribute('disabled')).to.equal('')
        screen.getByRole('button', {
          name: cancelButtonText,
        })
        screen.getByRole('button', {
          name: 'Processing…',
        })
      })

      it('disables both buttons and updates text for when cancel button clicked', async function () {
        renderActiveSubscription(monthlyActiveCollaborator)
        showConfirmCancelUI()
        const cancelButtton = await screen.findByRole('button', {
          name: cancelButtonText,
        })
        fireEvent.click(cancelButtton)

        const buttons = screen.getAllByRole('button')
        expect(buttons.length).to.equal(2)
        expect(buttons[0].getAttribute('disabled')).to.equal('')
        expect(buttons[1].getAttribute('disabled')).to.equal('')
        screen.getByRole('button', {
          name: 'Processing…',
        })
        screen.getByRole('button', {
          name: downgradeButtonText,
        })
      })

      it('does not show option to downgrade when plan is not eligible for downgrades', function () {
        const ineligiblePlan = cloneDeep(monthlyActiveCollaborator)
        ineligiblePlan.payment.isEligibleForDowngradeUpsell = false
        renderActiveSubscription(ineligiblePlan)
        showConfirmCancelUI()
        expect(
          screen.queryByRole('button', {
            name: downgradeButtonText,
          })
        ).to.be.null
      })

      it('does not show option to extend trial when on a collaborator trial', function () {
        const trialPlan = cloneDeep(trialCollaboratorSubscription)
        renderActiveSubscription(trialPlan)
        showConfirmCancelUI()
        expect(
          screen.queryByRole('button', {
            name: downgradeButtonText,
          })
        ).to.be.null
      })

      it('reloads page after the successful request to downgrade plan', async function () {
        const endPointResponse = {
          status: 200,
        }
        fetchMock.post(
          `${subscriptionUpdateUrl}?downgradeToPaidPersonal`,
          endPointResponse
        )
        renderActiveSubscription(monthlyActiveCollaborator)
        showConfirmCancelUI()
        const downgradeButton = await screen.findByRole('button', {
          name: downgradeButtonText,
        })
        fireEvent.click(downgradeButton)
        // page is reloaded on success
        const reloadStub = this.locationWrapperStub.reload
        await waitFor(() => {
          expect(reloadStub).to.have.been.called
        })
      })
    })
  })

  describe('group plans', function () {
    it('does not show "Change plan" option for group plans', function () {
      renderActiveSubscription(groupActiveSubscription)

      const changePlan = screen.queryByRole('button', { name: 'Change plan' })
      expect(changePlan).to.be.null
    })
  })
})
