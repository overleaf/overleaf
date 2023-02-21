import { expect } from 'chai'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { ChangePlan } from '../../../../../../../../../frontend/js/features/subscription/components/dashboard/states/active/change-plan/change-plan'
import { groupPlans, plans } from '../../../../../fixtures/plans'
import {
  annualActiveSubscription,
  pendingSubscriptionChange,
} from '../../../../../fixtures/subscriptions'
import { ActiveSubscription } from '../../../../../../../../../frontend/js/features/subscription/components/dashboard/states/active/active'
import {
  cleanUpContext,
  renderWithSubscriptionDashContext,
} from '../../../../../helpers/render-with-subscription-dash-context'
import sinon from 'sinon'
import fetchMock from 'fetch-mock'
import {
  cancelPendingSubscriptionChangeUrl,
  subscriptionUrl,
} from '../../../../../../../../../frontend/js/features/subscription/data/subscription-url'
import { renderActiveSubscription } from '../../../../../helpers/render-active-subscription'

describe('<ChangePlan />', function () {
  let reloadStub: () => void
  const originalLocation = window.location
  const plansMetaTag = { name: 'ol-plans', value: plans }

  beforeEach(function () {
    reloadStub = sinon.stub()
    Object.defineProperty(window, 'location', {
      value: { reload: reloadStub },
    })
  })

  afterEach(function () {
    cleanUpContext()
    fetchMock.reset()
    Object.defineProperty(window, 'location', {
      value: originalLocation,
    })
  })

  it('does not render the UI when showChangePersonalPlan is false', function () {
    window.metaAttributesCache.delete('ol-plans')
    const { container } = renderWithSubscriptionDashContext(<ChangePlan />, {
      metaTags: [plansMetaTag],
    })

    expect(container.firstChild).to.be.null
  })

  it('renders the individual plans table and group plans UI', async function () {
    renderActiveSubscription(annualActiveSubscription)
    const button = screen.getByRole('button', { name: 'Change plan' })
    fireEvent.click(button)

    await screen.findByText('Looking for multiple licenses?')

    const changeToPlanButtons = screen.queryAllByRole('button', {
      name: 'Change to this plan',
    })
    expect(changeToPlanButtons.length).to.equal(plans.length - 1)
    screen.getByText('Your plan')

    const annualPlans = plans.filter(plan => plan.annual)
    expect(screen.getAllByText('/ year', { exact: false }).length).to.equal(
      annualPlans.length
    )
    expect(screen.getAllByText('/ month', { exact: false }).length).to.equal(
      plans.length - annualPlans.length
    )

    expect(screen.queryByText('loading', { exact: false })).to.be.null
  })

  it('renders "Your new plan" and "Keep current plan" when there is a pending plan change', async function () {
    renderActiveSubscription(pendingSubscriptionChange)

    const button = screen.getByRole('button', { name: 'Change plan' })
    fireEvent.click(button)

    await screen.findByText('Your new plan')
    screen.getByRole('button', { name: 'Keep my current plan' })
  })

  it('does not render when Recurly did not load', function () {
    const { container } = renderWithSubscriptionDashContext(
      <ActiveSubscription subscription={annualActiveSubscription} />,
      {
        metaTags: [
          { name: 'ol-subscription', value: annualActiveSubscription },
          plansMetaTag,
        ],
      }
    )
    expect(container).not.to.be.null
  })

  it('shows a loading message while still querying Recurly for prices', async function () {
    renderWithSubscriptionDashContext(
      <ActiveSubscription subscription={pendingSubscriptionChange} />,
      {
        metaTags: [
          { name: 'ol-subscription', value: pendingSubscriptionChange },
        ],
      }
    )

    const button = screen.getByRole('button', { name: 'Change plan' })
    fireEvent.click(button)

    await screen.findByText('Loading', { exact: false })
  })

  describe('Change plan modal', function () {
    it('open confirmation modal when "Change to this plan" clicked', async function () {
      renderActiveSubscription(annualActiveSubscription)

      const button = screen.getByRole('button', { name: 'Change plan' })
      fireEvent.click(button)

      const buttons = await screen.findAllByRole('button', {
        name: 'Change to this plan',
      })
      fireEvent.click(buttons[0])

      await screen.findByText('Are you sure you want to change plan to', {
        exact: false,
      })
      screen.getByRole('button', { name: 'Change plan' })

      expect(
        screen.queryByText(
          'Your existing plan and its features will remain active until the end of the current billing period.'
        )
      ).to.be.null

      expect(
        screen.queryByText(
          'If you wish this change to apply before the end of your current billing period, please contact us.'
        )
      ).to.be.null
    })

    it('shows message in confirmation dialog about plan remaining active until end of term when expected', async function () {
      let planIndex = 0
      const planThatWillChange = plans.find((p, i) => {
        if (p.planCode !== annualActiveSubscription.planCode) {
          planIndex = i
        }
        return p.planCode !== annualActiveSubscription.planCode
      })

      renderActiveSubscription(annualActiveSubscription, [
        {
          name: 'ol-planCodesChangingAtTermEnd',
          value: [planThatWillChange!.planCode],
        },
      ])

      const button = screen.getByRole('button', { name: 'Change plan' })
      fireEvent.click(button)

      const buttons = await screen.findAllByRole('button', {
        name: 'Change to this plan',
      })
      fireEvent.click(buttons[planIndex])

      const confirmModal = screen.getByRole('dialog')
      await within(confirmModal).findByText(
        'Your existing plan and its features will remain active until the end of the current billing period.'
      )

      screen.getByText(
        'If you wish this change to apply before the end of your current billing period, please contact us.'
      )
    })

    it('changes plan after confirmed in modal', async function () {
      const endPointResponse = {
        status: 200,
      }
      fetchMock.post(
        `${subscriptionUrl}?origin=confirmChangePlan`,
        endPointResponse
      )

      renderActiveSubscription(annualActiveSubscription, [
        {
          name: 'ol-planCodesChangingAtTermEnd',
          value: [annualActiveSubscription.planCode],
        },
      ])

      const button = screen.getByRole('button', { name: 'Change plan' })
      fireEvent.click(button)

      const buttons = await screen.findAllByRole('button', {
        name: 'Change to this plan',
      })
      fireEvent.click(buttons[0])

      await screen.findByText('Are you sure you want to change plan to', {
        exact: false,
      })
      const buttonConfirm = screen.getByRole('button', { name: 'Change plan' })
      fireEvent.click(buttonConfirm)

      screen.getByText('processing', { exact: false })

      // page is reloaded on success
      await waitFor(() => {
        expect(reloadStub).to.have.been.called
      })
    })

    it('shows error if changing plan failed', async function () {
      const endPointResponse = {
        status: 500,
      }
      fetchMock.post(
        `${subscriptionUrl}?origin=confirmChangePlan`,
        endPointResponse
      )

      renderActiveSubscription(annualActiveSubscription)

      const button = screen.getByRole('button', { name: 'Change plan' })
      fireEvent.click(button)

      const buttons = await screen.findAllByRole('button', {
        name: 'Change to this plan',
      })
      fireEvent.click(buttons[0])

      await screen.findByText('Are you sure you want to change plan to', {
        exact: false,
      })
      const buttonConfirm = screen.getByRole('button', { name: 'Change plan' })
      fireEvent.click(buttonConfirm)

      screen.getByText('processing', { exact: false })

      await screen.findByText('Sorry, something went wrong. ', { exact: false })
      await screen.findByText('Please try again. ', { exact: false })
      await screen.findByText('If the problem continues please contact us.', {
        exact: false,
      })

      expect(
        within(screen.getByRole('dialog'))
          .getByRole('button', { name: 'Change plan' })
          .getAttribute('disabled')
      ).to.not.exist
    })
  })

  describe('Keep current plan modal', function () {
    let confirmModal: HTMLElement

    beforeEach(async function () {
      renderActiveSubscription(pendingSubscriptionChange)

      const button = screen.getByRole('button', { name: 'Change plan' })
      fireEvent.click(button)

      const keepPlanButton = await screen.findByRole('button', {
        name: 'Keep my current plan',
      })
      fireEvent.click(keepPlanButton)

      confirmModal = screen.getByRole('dialog')
    })

    it('opens confirmation modal when "Keep my current plan" is clicked', async function () {
      within(confirmModal).getByText(
        'Are you sure you want to revert your scheduled plan change? You will remain subscribed to the',
        {
          exact: false,
        }
      )
      screen.getByRole('button', { name: 'Revert scheduled plan change' })
    })

    it('keeps current plan when "Revert scheduled plan change" is clicked in modal', async function () {
      const endPointResponse = {
        status: 200,
      }
      fetchMock.post(cancelPendingSubscriptionChangeUrl, endPointResponse)
      const buttonConfirm = within(confirmModal).getByRole('button', {
        name: 'Revert scheduled plan change',
      })
      fireEvent.click(buttonConfirm)

      screen.getByText('processing', { exact: false })

      // page is reloaded on success
      await waitFor(() => {
        expect(reloadStub).to.have.been.called
      })
    })

    it('shows error if keeping plan failed', async function () {
      const endPointResponse = {
        status: 500,
      }
      fetchMock.post(cancelPendingSubscriptionChangeUrl, endPointResponse)
      const buttonConfirm = within(confirmModal).getByRole('button', {
        name: 'Revert scheduled plan change',
      })
      fireEvent.click(buttonConfirm)

      screen.getByText('processing', { exact: false })
      await screen.findByText('Sorry, something went wrong. ', { exact: false })
      await screen.findByText('Please try again. ', { exact: false })
      await screen.findByText('If the problem continues please contact us.', {
        exact: false,
      })
      expect(
        within(screen.getByRole('dialog'))
          .getByRole('button', { name: 'Revert scheduled plan change' })
          .getAttribute('disabled')
      ).to.not.exist
    })
  })

  describe('Change to group plan modal', function () {
    const standardPlanCollaboratorText = '10 collaborators per project'
    const professionalPlanCollaboratorText = 'Unlimited collaborators'
    it('open group plan modal "Change to a group plan" clicked', async function () {
      renderActiveSubscription(annualActiveSubscription)

      const button = screen.getByRole('button', { name: 'Change plan' })
      fireEvent.click(button)

      const buttonGroupModal = await screen.findByRole('button', {
        name: 'Change to a group plan',
      })
      fireEvent.click(buttonGroupModal)

      const modal = await screen.findByRole('dialog')

      within(modal).getByText('Customize your group subscription')
      within(modal).getByText('Save 30% or more')
      within(modal).getByText('Each user will have access to:')
      within(modal).getByText('All premium features')
      within(modal).getByText('Sync with Dropbox and GitHub')
      within(modal).getByText('Full document history')
      within(modal).getByText('plus more')

      within(modal).getByText(standardPlanCollaboratorText)
      expect(within(modal).queryByText(professionalPlanCollaboratorText)).to.be
        .null

      const plans = within(modal).getByRole('group')
      const planOptions = within(plans).getAllByRole('radio')
      expect(planOptions.length).to.equal(groupPlans.plans.length)

      const sizeSelect = within(modal).getByRole('combobox')
      const sizeOption = within(sizeSelect).getAllByRole('option')
      expect(sizeOption.length).to.equal(groupPlans.sizes.length)
      within(modal).getByText(
        'Overleaf offers a 40% educational discount for groups of 10 or more.'
      )

      within(modal).getByRole('checkbox')
      within(modal).getByText(
        'This license is for educational purposes (applies to students or faculty using Overleaf for teaching)'
      )

      within(modal).getByText(
        'Your new subscription will be billed immediately to your current payment method.'
      )

      within(modal).getByRole('button', { name: 'Upgrade Now' })

      within(modal).getByRole('button', {
        name: 'Need more than 50 licenses? Please get in touch',
      })
    })

    it('changes the collaborator count when the plan changes', async function () {
      renderActiveSubscription(annualActiveSubscription)

      const button = screen.getByRole('button', { name: 'Change plan' })
      fireEvent.click(button)

      const buttonGroupModal = await screen.findByRole('button', {
        name: 'Change to a group plan',
      })
      fireEvent.click(buttonGroupModal)

      const modal = await screen.findByRole('dialog')
      const professionalPlanOption =
        within(modal).getByLabelText('Professional')
      fireEvent.click(professionalPlanOption)

      within(modal).getByText(professionalPlanCollaboratorText)
      expect(within(modal).queryByText(standardPlanCollaboratorText)).to.be.null
    })

    it('shows educational discount applied when input checked', async function () {
      const discountAppliedText = '40% educational discount applied!'
      const discountNotAppliedText =
        'The educational discount is available for groups of 10 or more'
      renderActiveSubscription(annualActiveSubscription)

      const button = screen.getByRole('button', { name: 'Change plan' })
      fireEvent.click(button)

      const buttonGroupModal = await screen.findByRole('button', {
        name: 'Change to a group plan',
      })
      fireEvent.click(buttonGroupModal)

      const modal = await screen.findByRole('dialog')

      const educationInput = within(modal).getByLabelText(
        'This license is for educational purposes (applies to students or faculty using Overleaf for teaching)'
      )
      fireEvent.click(educationInput)
      within(modal).getByText(discountAppliedText)
      expect(within(modal).queryByText(discountNotAppliedText)).to.be.null
    })
  })
})
