import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect } from 'chai'
import JoinGroup from '../../../../../../frontend/js/features/subscription/components/group-invite/join-group'
import fetchMock from 'fetch-mock'
import sinon from 'sinon'

describe('join group', function () {
  const inviteToken = 'token123'
  beforeEach(function () {
    window.metaAttributesCache.set('ol-inviteToken', inviteToken)
  })
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('shows option to join subscription', async function () {
    render(<JoinGroup setView={() => {}} />)
    await screen.findByText(
      'Please click the button below to join the group subscription and enjoy the benefits of an upgraded Overleaf account'
    )
    screen.getByRole('link', { name: 'Not now' })
    screen.getByRole('button', { name: 'Accept invitation' })
  })

  it('handles success when accepting invite', async function () {
    fetchMock.put(`/subscription/invites/${inviteToken}`, 200)
    const setView = sinon.stub()
    render(<JoinGroup setView={setView} />)
    const button = await screen.getByRole('button', {
      name: 'Accept invitation',
    })
    fireEvent.click(button)
    await waitFor(() => {
      expect(setView).to.have.been.calledOnce
    })
  })

  it('handles errors when accepting invite', async function () {
    render(<JoinGroup setView={() => {}} />)
    const button = await screen.getByRole('button', {
      name: 'Accept invitation',
    })
    fireEvent.click(button)
    await waitFor(() => {
      screen.getByText('Sorry, something went wrong')
    })
  })
})
