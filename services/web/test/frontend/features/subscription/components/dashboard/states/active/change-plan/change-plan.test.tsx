import { expect } from 'chai'
import { fireEvent, screen } from '@testing-library/react'
import { ChangePlan } from '../../../../../../../../../frontend/js/features/subscription/components/dashboard/states/active/change-plan/change-plan'
import { plans } from '../../../../../fixtures/plans'
import {
  annualActiveSubscription,
  pendingSubscriptionChange,
} from '../../../../../fixtures/subscriptions'
import { ActiveSubscription } from '../../../../../../../../../frontend/js/features/subscription/components/dashboard/states/active/active'
import {
  cleanUpContext,
  renderWithSubscriptionDashContext,
} from '../../../../../helpers/render-with-subscription-dash-context'

describe('<ChangePlan />', function () {
  const plansMetaTag = { name: 'ol-plans', value: plans }
  const renderOptions = { metaTags: [plansMetaTag] }

  afterEach(function () {
    cleanUpContext()
  })

  it('does not render the UI when showChangePersonalPlan is false', function () {
    window.metaAttributesCache.delete('ol-plans')
    const { container } = renderWithSubscriptionDashContext(
      <ChangePlan />,
      renderOptions
    )

    expect(container.firstChild).to.be.null
  })

  it('renders the individual plans table and group plans UI', async function () {
    renderWithSubscriptionDashContext(
      <ActiveSubscription subscription={annualActiveSubscription} />,
      {
        metaTags: [
          { name: 'ol-subscription', value: annualActiveSubscription },
          plansMetaTag,
          {
            name: 'ol-recommendedCurrency',
            value: 'USD',
          },
        ],
      }
    )

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
    renderWithSubscriptionDashContext(
      <ActiveSubscription subscription={pendingSubscriptionChange} />,
      {
        metaTags: [
          { name: 'ol-subscription', value: pendingSubscriptionChange },
          plansMetaTag,
        ],
      }
    )

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

  it('shows a loading message while still querying Recurly for prices', function () {
    renderWithSubscriptionDashContext(
      <ActiveSubscription subscription={pendingSubscriptionChange} />,
      {
        metaTags: [
          { name: 'ol-subscription', value: pendingSubscriptionChange },
          plansMetaTag,
        ],
      }
    )

    const button = screen.getByRole('button', { name: 'Change plan' })
    fireEvent.click(button)

    screen.findByText('Loading', { exact: false })
  })
})
