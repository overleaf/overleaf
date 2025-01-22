import { expect } from 'chai'
import sinon from 'sinon'
import { fireEvent, screen, render, waitFor } from '@testing-library/react'
import fetchMock, { FetchMockStatic } from 'fetch-mock'

import LeaveModalForm from '../../../../../../frontend/js/features/settings/components/leave/modal-form'
import * as useLocationModule from '../../../../../../frontend/js/shared/hooks/use-location'
import getMeta from '@/utils/meta'

describe('<LeaveModalForm />', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-usersEmail', 'foo@bar.com')
    Object.assign(getMeta('ol-ExposedSettings'), { isOverleaf: true })
  })

  afterEach(function () {
    fetchMock.reset()
  })

  it('validates form', async function () {
    const setIsFormValid = sinon.stub()
    render(
      <LeaveModalForm
        setInFlight={() => {}}
        isFormValid={false}
        setIsFormValid={setIsFormValid}
      />
    )

    const emailInput = screen.getByLabelText('Email')
    fireEvent.change(emailInput, { target: { value: 'FOO@bar.com' } })

    const passwordInput = screen.getByLabelText('Password')
    fireEvent.change(passwordInput, { target: { value: 'foobar' } })

    const checkbox = screen.getByLabelText(
      'I understand this will delete all projects in my Overleaf account with email address foo@bar.com'
    )
    fireEvent.click(checkbox)

    const setIsFormValidCalls = setIsFormValid.getCalls()
    const lastSetIsFormValidCall = setIsFormValidCalls.pop()
    expect(lastSetIsFormValidCall!.args[0]).to.be.true

    for (const setIsFormValidCall of setIsFormValidCalls) {
      expect(setIsFormValidCall.args[0]).to.be.false
    }
  })

  describe('submits', async function () {
    let setInFlight: sinon.SinonStub
    let setIsFormValid: sinon.SinonStub
    let deleteMock: FetchMockStatic
    let assignStub: sinon.SinonStub

    beforeEach(function () {
      setInFlight = sinon.stub()
      setIsFormValid = sinon.stub()
      deleteMock = fetchMock.post('/user/delete', 200)
      assignStub = sinon.stub()
      this.locationStub = sinon.stub(useLocationModule, 'useLocation').returns({
        assign: assignStub,
        replace: sinon.stub(),
        reload: sinon.stub(),
        setHash: sinon.stub(),
      })
      Object.assign(getMeta('ol-ExposedSettings'), { isOverleaf: true })
    })

    afterEach(function () {
      fetchMock.reset()
      this.locationStub.restore()
    })

    it('with valid form', async function () {
      render(
        <LeaveModalForm
          setInFlight={setInFlight}
          isFormValid
          setIsFormValid={setIsFormValid}
        />
      )

      fireEvent.submit(screen.getByLabelText('Email'))

      sinon.assert.calledOnce(setInFlight)
      sinon.assert.calledWithMatch(setInFlight, true)
      expect(deleteMock.called()).to.be.true
      await waitFor(() => {
        sinon.assert.calledTwice(setInFlight)
        sinon.assert.calledWithMatch(setInFlight, false)
        sinon.assert.calledOnce(assignStub)
        sinon.assert.calledWith(assignStub, '/')
      })
    })

    it('with invalid form', async function () {
      render(
        <LeaveModalForm
          setInFlight={setInFlight}
          isFormValid={false}
          setIsFormValid={setIsFormValid}
        />
      )

      fireEvent.submit(screen.getByLabelText('Email'))

      expect(deleteMock.called()).to.be.false
      sinon.assert.notCalled(setInFlight)
    })
  })

  it('handles credentials error without Saas tip', async function () {
    Object.assign(getMeta('ol-ExposedSettings'), { isOverleaf: false })
    fetchMock.post('/user/delete', 403)
    render(
      <LeaveModalForm
        setInFlight={() => {}}
        isFormValid
        setIsFormValid={() => {}}
      />
    )

    fireEvent.submit(screen.getByLabelText('Email'))

    await waitFor(() => {
      screen.getByText(/Your email or password is incorrect. Please try again/)
    })
    expect(screen.queryByText(/If you cannot remember your password/)).to.not
      .exist
  })

  it('handles credentials error with Saas tip', async function () {
    fetchMock.post('/user/delete', 403)
    render(
      <LeaveModalForm
        setInFlight={() => {}}
        isFormValid
        setIsFormValid={() => {}}
      />
    )

    fireEvent.submit(screen.getByLabelText('Email'))

    await waitFor(() => {
      screen.getByText(/Your email or password is incorrect. Please try again/)
    })
    screen.getByText(/If you cannot remember your password/)
    const link = screen.getByRole('link', { name: 'reset your password' })
    expect(link.getAttribute('href')).to.equal('/user/password/reset')
  })

  it('handles subscription error', async function () {
    fetchMock.post('/user/delete', {
      status: 422,
      body: {
        error: 'SubscriptionAdminDeletionError',
      },
    })

    render(
      <LeaveModalForm
        setInFlight={() => {}}
        isFormValid
        setIsFormValid={() => {}}
      />
    )

    fireEvent.submit(screen.getByLabelText('Email'))

    await waitFor(() => {
      screen.getByText(
        'You cannot delete your account while on a subscription. Please cancel your subscription and try again. If you keep seeing this message please contact us.'
      )
    })
  })

  it('handles generic error', async function () {
    fetchMock.post('/user/delete', 500)
    render(
      <LeaveModalForm
        setInFlight={() => {}}
        isFormValid
        setIsFormValid={() => {}}
      />
    )

    fireEvent.submit(screen.getByLabelText('Email'))

    await waitFor(() => {
      screen.getByText(
        'Sorry, something went wrong deleting your account. Please try again in a minute.'
      )
    })
  })
})
