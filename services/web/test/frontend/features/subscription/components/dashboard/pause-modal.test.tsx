import { fireEvent, screen, waitFor } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import sinon from 'sinon'
import { expect } from 'chai'
import {
  annualActiveSubscription,
  groupActiveSubscription,
  monthlyActiveCollaborator,
  trialSubscription,
} from '../../fixtures/subscriptions'
import { renderActiveSubscription } from '../../helpers/render-active-subscription'
import { location } from '@/shared/components/location'
import { MetaTag } from '@/utils/meta'

const pauseSubscriptionSplitTestMeta: MetaTag[] = [
  { name: 'ol-splitTestVariants', value: { 'pause-subscription': 'enabled' } },
]

function renderSubscriptionWithPauseSupport(
  subscription = monthlyActiveCollaborator
) {
  return renderActiveSubscription(subscription, pauseSubscriptionSplitTestMeta)
}

function clickCancelButton() {
  const button = screen.getByRole('button', {
    name: /Cancel your subscription/i,
  })
  fireEvent.click(button)
}

function clickDurationSelect() {
  const pauseDurationSelect = screen.getByLabelText('Pause subscription for', {
    selector: 'input',
  })
  fireEvent.click(pauseDurationSelect)
}

function clickSubmitButton() {
  const buttonConfirm = screen.getByRole('button', {
    name: 'Pause subscription',
  })
  fireEvent.click(buttonConfirm)
}

describe('<PauseSubscriptionModal />', function () {
  beforeEach(function () {
    this.locationWrapperSandbox = sinon.createSandbox()
    this.locationWrapperStub = this.locationWrapperSandbox.stub(location)
    this.locationWrapperStub.toString.returns(
      'https://www.dev-overleaf.com/user/subscription'
    )
    this.replaceStateStub = sinon.stub(window.history, 'replaceState')
  })

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
    this.locationWrapperSandbox.restore()
    this.replaceStateStub.restore()
  })

  it('does not render with an annual subscription', async function () {
    renderSubscriptionWithPauseSupport(annualActiveSubscription)
    clickCancelButton()
    // goes straight to cancel
    await screen.findByText('We’d love you to stay')
  })

  it('does not render with a group plan', async function () {
    renderSubscriptionWithPauseSupport(groupActiveSubscription)
    clickCancelButton()
    // goes straight to cancel
    await screen.findByText('We’d love you to stay')
  })

  it('does not render when in a trial', async function () {
    renderSubscriptionWithPauseSupport(trialSubscription)
    clickCancelButton()
    await screen.findByText('We’d love you to stay')
  })

  it('renders when trying to cancel subscription', async function () {
    renderSubscriptionWithPauseSupport()
    clickCancelButton()
    await screen.findByText('Pause instead, to pick up where you left off')
  })

  it('renders options for pause duration', async function () {
    renderSubscriptionWithPauseSupport()
    clickCancelButton()
    clickDurationSelect()
    await screen.findByRole('option', { name: '1 month' })
    await screen.findByRole('option', { name: '2 months' })
    await screen.findByRole('option', { name: '3 months' })
  })

  it('changes to selected duration', async function () {
    renderSubscriptionWithPauseSupport()
    clickCancelButton()
    clickDurationSelect()
    const twoMonthsOption = await screen.findByRole('option', {
      name: '2 months',
      selected: false,
    })
    fireEvent.click(twoMonthsOption)
    clickDurationSelect()
    await screen.findByRole('option', { name: '2 months', selected: true })
  })

  it('shows error if pausing failed', async function () {
    const endPointResponse = {
      status: 500,
    }
    fetchMock.post(`/user/subscription/pause/1`, endPointResponse)
    renderSubscriptionWithPauseSupport()
    clickCancelButton()
    clickSubmitButton()

    await screen.findByText('Sorry, something went wrong. ', {
      exact: false,
    })
  })

  it('reloads if pause successful', async function () {
    const endPointResponse = {
      status: 200,
    }
    fetchMock.post(`/user/subscription/pause/1`, endPointResponse)
    renderSubscriptionWithPauseSupport()
    clickCancelButton()
    clickSubmitButton()
    const reloadStub = this.locationWrapperStub.reload
    await waitFor(() => {
      expect(reloadStub).to.have.been.called
    })
  })
})
