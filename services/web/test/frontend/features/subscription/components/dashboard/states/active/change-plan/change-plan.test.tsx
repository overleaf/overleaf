import { expect } from 'chai'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { groupPlans, plans } from '../../../../../fixtures/plans'
import {
  annualActiveSubscription,
  annualActiveSubscriptionEuro,
  annualActiveSubscriptionPro,
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
  subscriptionUpdateUrl,
} from '../../../../../../../../../frontend/js/features/subscription/data/subscription-url'
import { renderActiveSubscription } from '../../../../../helpers/render-active-subscription'
import { location } from '@/shared/components/location'

describe('<ChangePlanModal />', function () {
  beforeEach(function () {
    this.locationWrapperSandbox = sinon.createSandbox()
    this.locationWrapperStub = this.locationWrapperSandbox.stub(location)
  })

  afterEach(function () {
    cleanUpContext()
    fetchMock.removeRoutes().clearHistory()
    this.locationWrapperSandbox.restore()
  })

  it('renders the individual plans table and group plans UI', async function () {
    renderActiveSubscription(annualActiveSubscription)
    const button = screen.getByRole('button', { name: 'Change plan' })
    fireEvent.click(button)

    await screen.findByText('Looking for multiple licenses?')

    const changeToPlanButtons = screen.queryAllByRole('button', {
      name: 'Change to this plan',
    })
    expect(changeToPlanButtons.length).to.equal(plans.length - 3) // excludes paid-personal and paid-personal-annual
    screen.getByText('Your plan')

    const annualPlans = plans.filter(plan => plan.annual)
    expect(screen.getAllByText('/ year', { exact: false }).length).to.equal(
      annualPlans.length - 1
    ) // excludes paid-personal-annual

    expect(screen.getAllByText('/ month', { exact: false }).length).to.equal(
      plans.length - annualPlans.length - 1
    ) // excludes paid-personal

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
          { name: 'ol-plans', value: plans },
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

      const confirmModal = screen.getByRole('dialog')
      await within(confirmModal).findByText(
        'Are you sure you want to change plan to',
        {
          exact: false,
        }
      )
      within(confirmModal).getByRole('button', { name: 'Change plan' })

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
        `${subscriptionUpdateUrl}?origin=confirmChangePlan`,
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
      const buttonConfirm = within(screen.getByRole('dialog')).getByRole(
        'button',
        { name: 'Change plan' }
      )
      fireEvent.click(buttonConfirm)

      screen.getByRole('button', { name: 'Processing…' })

      // page is reloaded on success
      const reloadStub = this.locationWrapperStub.reload
      await waitFor(() => {
        expect(reloadStub).to.have.been.called
      })
    })

    it('shows error if changing plan failed', async function () {
      const endPointResponse = {
        status: 500,
      }
      fetchMock.post(
        `${subscriptionUpdateUrl}?origin=confirmChangePlan`,
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
      const buttonConfirm = within(screen.getByRole('dialog')).getByRole(
        'button',
        { name: 'Change plan' }
      )
      fireEvent.click(buttonConfirm)

      screen.getByRole('button', { name: 'Processing…' })

      await screen.findAllByText(
        (content, element) =>
          element?.textContent ===
          'Sorry, something went wrong. Please try again. If the problem continues please contact us.'
      )

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

      screen.getByRole('button', { name: 'Processing…' })

      // page is reloaded on success
      const reloadStub = this.locationWrapperStub.reload
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

      screen.getByRole('button', { name: 'Processing…' })
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
    const educationInputLabel =
      'Get a total of 40% off for groups using Overleaf for teaching'

    let modal: HTMLElement
    async function openModal() {
      const button = screen.getByRole('button', { name: 'Change plan' })
      fireEvent.click(button)

      const buttonGroupModal = await screen.findByRole('button', {
        name: 'Change to a group plan',
      })
      fireEvent.click(buttonGroupModal)

      modal = await screen.findByRole('dialog')
    }

    it('open group plan modal "Change to a group plan" clicked', async function () {
      renderActiveSubscription(annualActiveSubscription)
      await openModal()

      within(modal).getByText('Customize your group subscription')

      within(modal).getByText('$1,290 per year')
      expect(within(modal).getAllByText('$129 per user').length).to.equal(2)

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
      const standardPlanRadioInput = within(modal).getByLabelText(
        'Standard'
      ) as HTMLInputElement
      expect(standardPlanRadioInput.checked).to.be.true

      const sizeSelect = within(modal).getByRole('combobox') as HTMLInputElement
      expect(sizeSelect.value).to.equal('10')
      const sizeOption = within(sizeSelect).getAllByRole('option')
      expect(sizeOption.length).to.equal(groupPlans.sizes.length)
      within(modal).getByText(
        'Get a total of 40% off for groups using Overleaf for teaching'
      )

      const educationalCheckbox = within(modal).getByRole(
        'checkbox'
      ) as HTMLInputElement
      expect(educationalCheckbox.checked).to.be.false

      within(modal).getByText(
        'Your new subscription will be billed immediately to your current payment method.'
      )

      expect(within(modal).queryByText('tax', { exact: false })).to.be.null

      within(modal).getByRole('button', { name: 'Upgrade now' })

      within(modal).getByRole('button', {
        name: 'Need more than 20 licenses? Please get in touch',
      })
    })

    it('changes the collaborator count when the plan changes', async function () {
      renderActiveSubscription(annualActiveSubscription)
      await openModal()

      const professionalPlanOption =
        within(modal).getByLabelText('Professional')
      fireEvent.click(professionalPlanOption)

      await within(modal).findByText(professionalPlanCollaboratorText)
      expect(within(modal).queryByText(standardPlanCollaboratorText)).to.be.null
    })

    it('shows educational discount applied when input checked', async function () {
      const discountAppliedText = '40% educational discount applied!'
      renderActiveSubscription(annualActiveSubscription)

      await openModal()

      const educationInput = within(modal).getByLabelText(educationInputLabel)
      fireEvent.click(educationInput)
      await within(modal).findByText(discountAppliedText)

      const sizeSelect = within(modal).getByRole('combobox') as HTMLInputElement
      await userEvent.selectOptions(sizeSelect, [screen.getByText('5')])
      await within(modal).findByText(discountAppliedText)
    })

    it('shows total with tax when tax applied', async function () {
      renderActiveSubscription(annualActiveSubscriptionEuro, undefined, 'EUR')

      await openModal()

      within(modal).getByText('Total:', { exact: false })
      expect(
        within(modal).getAllByText('€1,438.40', { exact: false }).length
      ).to.equal(3)
      within(modal).getByText('(€1,160.00 + €278.40 tax) per year', {
        exact: false,
      })
    })

    it('changes the price when options change', async function () {
      renderActiveSubscription(annualActiveSubscription)

      await openModal()

      within(modal).getByText('$1,290 per year')
      within(modal).getAllByText('$129 per user')

      // plan type (pro collab)
      let standardPlanRadioInput = within(modal).getByLabelText(
        'Standard'
      ) as HTMLInputElement
      expect(standardPlanRadioInput.checked).to.be.true
      let professionalPlanRadioInput = within(modal).getByLabelText(
        'Professional'
      ) as HTMLInputElement
      expect(professionalPlanRadioInput.checked).to.be.false

      fireEvent.click(professionalPlanRadioInput)

      standardPlanRadioInput = within(modal).getByLabelText(
        'Standard'
      ) as HTMLInputElement
      expect(standardPlanRadioInput.checked).to.be.false
      professionalPlanRadioInput = within(modal).getByLabelText(
        'Professional'
      ) as HTMLInputElement
      expect(professionalPlanRadioInput.checked).to.be.true

      await within(modal).findByText('$2,590 per year')
      await within(modal).findAllByText('$259 per user')

      // user count
      let sizeSelect = within(modal).getByRole('combobox') as HTMLInputElement
      expect(sizeSelect.value).to.equal('10')
      await userEvent.selectOptions(sizeSelect, [screen.getByText('5')])
      sizeSelect = within(modal).getByRole('combobox') as HTMLInputElement
      expect(sizeSelect.value).to.equal('5')

      await within(modal).findByText('$1,395 per year')
      await within(modal).findAllByText('$279 per user')

      // usage (enterprise or educational)
      let educationInput = within(modal).getByLabelText(
        educationInputLabel
      ) as HTMLInputElement
      expect(educationInput.checked).to.be.false
      fireEvent.click(educationInput)
      educationInput = within(modal).getByLabelText(
        educationInputLabel
      ) as HTMLInputElement
      expect(educationInput.checked).to.be.true

      // make sure doesn't change price until back at min user to qualify
      await within(modal).findByText('$1,395 per year')
      await within(modal).findAllByText('$279 per user')

      await userEvent.selectOptions(sizeSelect, [screen.getByText('10')])

      await within(modal).findByText('$1,550 per year')
      await within(modal).findAllByText('$155 per user')
    })

    it('has pro as the default group plan type if user is on a pro plan', async function () {
      renderActiveSubscription(annualActiveSubscriptionPro)

      await openModal()

      const standardPlanRadioInput = within(modal).getByLabelText(
        'Professional'
      ) as HTMLInputElement
      expect(standardPlanRadioInput.checked).to.be.true
    })

    it('submits the changes and reloads the page', async function () {
      const endPointResponse = {
        status: 200,
      }
      fetchMock.post(subscriptionUpdateUrl, endPointResponse)

      renderActiveSubscription(annualActiveSubscriptionPro)

      await openModal()

      const buttonConfirm = screen.getByRole('button', { name: 'Upgrade now' })
      fireEvent.click(buttonConfirm)

      screen.getByRole('button', { name: 'Processing…' })

      // page is reloaded on success
      const reloadStub = this.locationWrapperStub.reload
      await waitFor(() => {
        expect(reloadStub).to.have.been.called
      })
    })

    it('shows message if error after submitting form', async function () {
      const endPointResponse = {
        status: 500,
      }
      fetchMock.post(subscriptionUpdateUrl, endPointResponse)

      renderActiveSubscription(annualActiveSubscriptionPro)

      await openModal()

      const buttonConfirm = screen.getByRole('button', { name: 'Upgrade now' })
      fireEvent.click(buttonConfirm)

      screen.getByRole('button', { name: 'Processing…' })

      await screen.findByText('Sorry, something went wrong. ', { exact: false })
      await screen.findByText('Please try again. ', { exact: false })
      await screen.findByText('If the problem continues please contact us.', {
        exact: false,
      })
    })
  })
})
