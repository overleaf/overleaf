import { expect } from 'chai'
import {
  screen,
  fireEvent,
  waitForElementToBeRemoved,
  within,
} from '@testing-library/react'
import PersonalSubscription from '../../../../../../frontend/js/features/subscription/components/dashboard/personal-subscription'
import {
  annualActiveSubscription,
  canceledSubscription,
  customSubscription,
  pastDueExpiredSubscription,
} from '../../fixtures/subscriptions'
import {
  cleanUpContext,
  renderWithSubscriptionDashContext,
} from '../../helpers/render-with-subscription-dash-context'
import { reactivateSubscriptionUrl } from '../../../../../../frontend/js/features/subscription/data/subscription-url'
import fetchMock from 'fetch-mock'
import sinon from 'sinon'
import * as useLocationModule from '../../../../../../frontend/js/shared/hooks/use-location'

describe('<PersonalSubscription />', function () {
  afterEach(function () {
    cleanUpContext()
  })

  describe('no subscription', function () {
    it('returns empty container', function () {
      const { container } = renderWithSubscriptionDashContext(
        <PersonalSubscription />
      )
      expect(container.firstChild).to.be.null
    })
  })

  describe('custom subscription', function () {
    it('displays contact support message', function () {
      renderWithSubscriptionDashContext(<PersonalSubscription />, {
        metaTags: [{ name: 'ol-subscription', value: customSubscription }],
      })

      screen.getByText('Please', { exact: false })
      screen.getByText('contact support', { exact: false })
      screen.getByText('to make changes to your plan', { exact: false })
    })
  })

  describe('subscription states  ', function () {
    let reloadStub: sinon.SinonStub

    beforeEach(function () {
      reloadStub = sinon.stub()
      this.locationStub = sinon.stub(useLocationModule, 'useLocation').returns({
        assign: sinon.stub(),
        replace: sinon.stub(),
        reload: reloadStub,
        setHash: sinon.stub(),
        toString: sinon.stub(),
      })
    })

    afterEach(function () {
      this.locationStub.restore()
    })

    it('renders the active dash', function () {
      renderWithSubscriptionDashContext(<PersonalSubscription />, {
        metaTags: [
          { name: 'ol-subscription', value: annualActiveSubscription },
        ],
      })

      screen.getByText('You are currently subscribed to the', { exact: false })
    })

    it('renders the canceled dash', function () {
      renderWithSubscriptionDashContext(<PersonalSubscription />, {
        metaTags: [{ name: 'ol-subscription', value: canceledSubscription }],
      })
      screen.getByText(
        'Your subscription has been canceled and will terminate on',
        { exact: false }
      )
      screen.getByText(canceledSubscription.recurly!.nextPaymentDueAt, {
        exact: false,
      })

      screen.getByText('No further payments will be taken.', { exact: false })

      screen.getByRole('link', { name: 'View your invoices' })
      screen.getByRole('button', { name: 'Reactivate your subscription' })
    })

    it('reactivates canceled plan', async function () {
      renderWithSubscriptionDashContext(<PersonalSubscription />, {
        metaTags: [{ name: 'ol-subscription', value: canceledSubscription }],
      })

      const reactivateBtn = screen.getByRole<HTMLButtonElement>('button', {
        name: 'Reactivate your subscription',
      })

      // 1st click - fail
      fetchMock.postOnce(reactivateSubscriptionUrl, 400)
      fireEvent.click(reactivateBtn)
      expect(reactivateBtn.disabled).to.be.true
      await fetchMock.flush(true)
      expect(reactivateBtn.disabled).to.be.false
      expect(reloadStub).not.to.have.been.called
      fetchMock.reset()

      // 2nd click - success
      fetchMock.postOnce(reactivateSubscriptionUrl, 200)
      fireEvent.click(reactivateBtn)
      await fetchMock.flush(true)
      expect(reloadStub).to.have.been.calledOnce
      expect(reactivateBtn.disabled).to.be.true
      fetchMock.reset()
    })

    it('renders the expired dash', function () {
      renderWithSubscriptionDashContext(<PersonalSubscription />, {
        metaTags: [
          { name: 'ol-subscription', value: pastDueExpiredSubscription },
        ],
      })
      screen.getByText('Your subscription has expired.')
    })

    it('renders error message when an unknown subscription state', function () {
      const withStateDeleted = Object.assign(
        {},
        JSON.parse(JSON.stringify(annualActiveSubscription))
      )
      withStateDeleted.recurly.state = undefined
      renderWithSubscriptionDashContext(<PersonalSubscription />, {
        metaTags: [{ name: 'ol-subscription', value: withStateDeleted }],
      })
      screen.getByText(
        'There is a problem with your subscription. Please contact us for more information.'
      )
    })
  })

  describe('past due subscription', function () {
    it('renders error alert', function () {
      renderWithSubscriptionDashContext(<PersonalSubscription />, {
        metaTags: [
          { name: 'ol-subscription', value: pastDueExpiredSubscription },
        ],
      })
      screen.getByRole('alert')
      screen.getByText(
        'Your account currently has a past due invoice. You will not be able to change your plan until this is resolved.',
        { exact: false }
      )
      const invoiceLinks = screen.getAllByText('View Your Invoices', {
        exact: false,
      })
      expect(invoiceLinks.length).to.equal(2)
    })
  })

  describe('Recurly JS', function () {
    const recurlyFailedToLoadText =
      'Sorry, there was an error talking to our payment provider. Please try again in a few moments. If you are using any ad or script blocking extensions in your browser, you may need to temporarily disable them.'

    it('shows an alert and hides "Change plan" option when Recurly did not load', function () {
      renderWithSubscriptionDashContext(<PersonalSubscription />, {
        metaTags: [
          { name: 'ol-subscription', value: annualActiveSubscription },
        ],
        recurlyNotLoaded: true,
      })

      screen.getByRole('alert')
      screen.getByText(recurlyFailedToLoadText)

      expect(screen.queryByText('Change plan')).to.be.null
    })

    it('should not show an alert and should show "Change plan" option when Recurly did load', function () {
      renderWithSubscriptionDashContext(<PersonalSubscription />, {
        metaTags: [
          { name: 'ol-subscription', value: annualActiveSubscription },
        ],
      })

      expect(screen.queryByRole('alert')).to.be.null

      screen.getByText('Change plan')
    })
  })

  it('shows different recurly email address section', async function () {
    fetchMock.post('/user/subscription/account/email', 200)
    const usersEmail = 'foo@example.com'
    renderWithSubscriptionDashContext(<PersonalSubscription />, {
      metaTags: [
        { name: 'ol-subscription', value: annualActiveSubscription },
        { name: 'ol-usersEmail', value: usersEmail },
      ],
    })

    const billingText = screen.getByText(
      /your billing email address is currently/i
    ).textContent
    expect(billingText).to.contain(
      `Your billing email address is currently ${annualActiveSubscription.recurly.account.email}.` +
        ` If needed you can update your billing address to ${usersEmail}`
    )

    const submitBtn = screen.getByRole<HTMLButtonElement>('button', {
      name: /update/i,
    })
    expect(submitBtn.disabled).to.be.false
    fireEvent.click(submitBtn)
    expect(submitBtn.disabled).to.be.true
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: /updating/i })
        .disabled
    ).to.be.true

    await waitForElementToBeRemoved(() =>
      screen.getByText(/your billing email address is currently/i)
    )

    within(screen.getByRole('alert')).getByText(
      /your billing email address was successfully updated/i
    )

    expect(screen.queryByRole('button', { name: /update/i })).to.be.null
    expect(screen.queryByRole('button', { name: /updating/i })).to.be.null
  })
})
