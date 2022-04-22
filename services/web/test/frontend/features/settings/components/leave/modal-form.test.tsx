import { expect } from 'chai'
import sinon from 'sinon'
import { fireEvent, screen, render, waitFor } from '@testing-library/react'
import fetchMock from 'fetch-mock'

import LeaveModalForm from '../../../../../../frontend/js/features/settings/components/leave/modal-form'

describe('<LeaveModalForm />', function () {
  beforeEach(function () {
    window.metaAttributesCache = new Map()
    window.metaAttributesCache.set('ol-usersEmail', 'foo@bar.com')
    window.metaAttributesCache.set('ol-ExposedSettings', { isOverleaf: true })
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
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
    fireEvent.change(emailInput, { target: { value: 'foo@bar.com' } })

    const passwordInput = screen.getByLabelText('Password')
    fireEvent.change(passwordInput, { target: { value: 'foobar' } })

    const checkbox = screen.getByLabelText(
      'I understand this will delete all projects in my Overleaf account with email address foo@bar.com'
    )
    fireEvent.click(checkbox)

    const setIsFormValidCalls = setIsFormValid.getCalls()
    const lastSetIsFormValidCall = setIsFormValidCalls.pop()
    expect(lastSetIsFormValidCall.args[0]).to.be.true

    for (const setIsFormValidCall of setIsFormValidCalls) {
      expect(setIsFormValidCall.args[0]).to.be.false
    }
  })

  describe('submits', async function () {
    let setInFlight
    let setIsFormValid
    let deleteMock
    let locationStub
    const originalLocation = window.location

    beforeEach(function () {
      setInFlight = sinon.stub()
      setIsFormValid = sinon.stub()
      deleteMock = fetchMock.post('/user/delete', 200)
      locationStub = sinon.stub()
      Object.defineProperty(window, 'location', {
        value: {
          assign: locationStub,
        },
      })
      window.metaAttributesCache.set('ol-ExposedSettings', { isOverleaf: true })
    })

    afterEach(function () {
      fetchMock.reset()
      Object.defineProperty(window, 'location', {
        value: originalLocation,
      })
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
        sinon.assert.calledOnce(locationStub)
        sinon.assert.calledWithMatch(locationStub, '/login')
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
    window.metaAttributesCache.set('ol-ExposedSettings', { isOverleaf: false })
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
