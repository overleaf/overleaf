import { expect } from 'chai'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import HasIndividualRecurlySubscription from '../../../../../../frontend/js/features/subscription/components/group-invite/has-individual-recurly-subscription'
import sinon from 'sinon'
import fetchMock from 'fetch-mock'

describe('group invite', function () {
  describe('user has a personal subscription', function () {
    afterEach(function () {
      fetchMock.removeRoutes().clearHistory()
    })

    it('shows option to cancel subscription', async function () {
      render(<HasIndividualRecurlySubscription setView={() => {}} />)
      await screen.findByText(
        'You already have an individual subscription, would you like us to cancel this first before joining the group licence?'
      )
      screen.getByRole('button', { name: 'Not now' })
      screen.getByRole('button', { name: 'Cancel your subscription' })
    })

    it('handles subscription cancellation and calls to change invite view', async function () {
      fetchMock.post('/user/subscription/cancel', 200)
      const setView = sinon.stub()
      render(<HasIndividualRecurlySubscription setView={setView} />)
      const button = await screen.findByRole('button', {
        name: 'Cancel your subscription',
      })
      fireEvent.click(button)
      await waitFor(() => {
        expect(setView).to.have.been.calledOnce
      })
    })

    it('shows error message when cancelling subscription fails', async function () {
      render(<HasIndividualRecurlySubscription setView={() => {}} />)
      const button = await screen.findByRole('button', {
        name: 'Cancel your subscription',
      })
      fireEvent.click(button)
      await waitFor(() => {
        screen.getByText(
          'Something went wrong canceling your subscription. Please contact Support.'
        )
      })
    })
  })
})
