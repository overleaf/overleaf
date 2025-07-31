import { expect } from 'chai'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import * as eventTracking from '@/infrastructure/event-tracking'
import { PaidSubscription } from '../../../../../../../../types/subscription/dashboard/subscription'
import {
  annualActiveSubscription,
  groupActiveSubscription,
  groupActiveSubscriptionWithPendingLicenseChange,
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
    // sentence broken up by bolding
    screen.getByText('You are currently subscribed to the', { exact: false })
    screen.getByText(subscription.plan.name, { exact: false })

    screen.getByRole('button', { name: 'Change plan' })

    // sentence broken up by bolding
    screen.getByText('The next payment of', { exact: false })
    screen.getByText(subscription.payment.displayPrice, {
      exact: false,
    })
    screen.getByText('will be collected on', { exact: false })
    const dates = screen.getAllByText(subscription.payment.nextPaymentDueAt, {
      exact: false,
    })
    expect(dates.length).to.equal(2)

    screen.getByText(
      '* Prices may be subject to additional VAT, depending on your country.'
    )

    screen.getByRole('link', { name: 'Update your billing details' })
    screen.getByRole('link', { name: 'View your invoices' })
  }

  it('renders the dash annual active subscription', function () {
    renderActiveSubscription(annualActiveSubscription)
    expectedInActiveSubscription(annualActiveSubscription)
  })

  it('shows change plan UI when button clicked', async function () {
    renderActiveSubscription(annualActiveSubscription)

    const button = screen.getByRole('button', { name: 'Change plan' })
    fireEvent.click(button)

    // confirm main dash UI still shown
    screen.getByText('You are currently subscribed to the', { exact: false })

    await screen.findByRole('heading', { name: 'Change plan' })
    await waitFor(
      () =>
        expect(
          screen.getAllByRole('button', { name: 'Change to this plan' })
            .length > 0
        ).to.be.true
    )
  })

  it('notes when user is changing plan at end of current plan term', function () {
    renderActiveSubscription(pendingSubscriptionChange)

    expectedInActiveSubscription(pendingSubscriptionChange)

    screen.getByText('Your plan is changing to', { exact: false })

    screen.getByText(pendingSubscriptionChange.pendingPlan!.name)
    screen.getByText(' at the end of the current billing period', {
      exact: false,
    })

    screen.getByText(
      'If you wish this change to apply before the end of your current billing period, please contact us.'
    )

    expect(screen.queryByRole('link', { name: 'contact Support' })).to.be.null
    expect(screen.queryByText('if you wish to change your group subscription.'))
      .to.be.null
  })

  it('does not show "Change plan" option when past due', function () {
    // account is likely in expired state, but be sure to not show option if state is still active
    const activePastDueSubscription = Object.assign(
      {},
      JSON.parse(JSON.stringify(annualActiveSubscription))
    )

    activePastDueSubscription.payment.hasPastDueInvoice = true

    renderActiveSubscription(activePastDueSubscription)

    const changePlan = screen.queryByRole('button', { name: 'Change plan' })
    expect(changePlan).to.be.null
  })

  it('shows the pending license change message when plan change is pending', function () {
    renderActiveSubscription(groupActiveSubscriptionWithPendingLicenseChange)

    screen.getByText('Your subscription is changing to include', {
      exact: false,
    })

    screen.getByText(
      groupActiveSubscriptionWithPendingLicenseChange.payment
        .pendingAdditionalLicenses!
    )

    screen.getByText('additional license(s) for a total of', { exact: false })

    screen.getByText(
      groupActiveSubscriptionWithPendingLicenseChange.payment
        .pendingTotalLicenses!
    )

    expect(
      screen.queryByText(
        'If you wish this change to apply before the end of your current billing period, please contact us.'
      )
    ).to.be.null
  })

  it('shows the pending license change message when plan change is not pending', function () {
    const subscription = Object.assign({}, groupActiveSubscription)
    subscription.payment.additionalLicenses = 4
    subscription.payment.totalLicenses =
      subscription.payment.totalLicenses +
      subscription.payment.additionalLicenses

    renderActiveSubscription(subscription)

    screen.getByText('Your subscription includes', {
      exact: false,
    })

    screen.getByText(subscription.payment.additionalLicenses)

    screen.getByText('additional license(s) for a total of', { exact: false })

    screen.getByText(subscription.payment.totalLicenses)
  })

  it('shows when trial ends and first payment collected and when subscription would become inactive if cancelled', function () {
    renderActiveSubscription(trialSubscription)
    screen.getByText('You’re on a free trial which ends on', { exact: false })

    const endDate = screen.getAllByText(
      trialSubscription.payment.trialEndsAtFormatted!
    )
    expect(endDate.length).to.equal(3)
  })

  it('shows current discounts', function () {
    const subscriptionWithActiveCoupons = cloneDeep(annualActiveSubscription)
    subscriptionWithActiveCoupons.payment.activeCoupons = [
      {
        name: 'fake coupon name',
        code: 'fake-coupon',
        description: '',
      },
    ]
    renderActiveSubscription(subscriptionWithActiveCoupons)
    screen.getByText(
      /this does not include your current discounts, which will be applied automatically before your next payment/i
    )
    screen.getByText(
      subscriptionWithActiveCoupons.payment.activeCoupons[0].name
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

  describe('contact support for paused subscription with 0 remaining cycles', function () {
    beforeEach(function () {
      this.locationWrapperSandbox = sinon.createSandbox()
      this.locationWrapperStub = this.locationWrapperSandbox.stub(location)
    })

    afterEach(function () {
      this.locationWrapperSandbox.restore()
    })

    it('redirects to contact page when cancel button clicked', function () {
      const pausedSubscription = cloneDeep(annualActiveSubscription)
      pausedSubscription.payment.state = 'paused'
      pausedSubscription.payment.remainingPauseCycles = 0

      renderActiveSubscription(pausedSubscription)

      const button = screen.getByRole('button', {
        name: 'Cancel your subscription',
      })
      fireEvent.click(button)

      expect(sendMBSpy).to.be.calledOnceWith(
        'subscription-page-cancel-button-click'
      )
      expect(this.locationWrapperStub.assign).to.be.calledOnceWith('/contact')
    })
  })

  describe('group plans', function () {
    it('does not show "Change plan" option for group plans', function () {
      renderActiveSubscription(groupActiveSubscription)

      const changePlan = screen.queryByRole('button', { name: 'Change plan' })
      expect(changePlan).to.be.null
    })

    it('shows contact Support message for group plan change requests', function () {
      renderActiveSubscription(groupActiveSubscription)
      screen.getByRole('link', { name: 'contact Support' })
      screen.getByText('if you wish to change your group subscription.', {
        exact: false,
      })
    })
  })
})
