import { expect } from 'chai'
import { render, screen, fireEvent } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import UserActivateRegister from '../../../../frontend/js/components/user-activate-register'
import { TPDS_SYNCED } from '../../../../../dropbox/test/frontend/components/dropbox-sync-status.test'

describe('UserActivateRegister', function () {
  beforeEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })
  it('should display the error message', async function () {
    const email = 'abc@gmail.com'
    render(<UserActivateRegister />)
    const endPointResponse = {
      status: 500,
    }
    fetchMock.get('/user/tpds/queues', TPDS_SYNCED)
    const registerMock = fetchMock.post('/admin/register', endPointResponse)
    const registerInput = screen.getByLabelText('Emails to register new users')
    const registerButton = screen.getByRole('button', { name: /register/i })

    fireEvent.change(registerInput, { target: { value: email } })
    fireEvent.click(registerButton)

    expect(registerMock.callHistory.called()).to.be.true
    await screen.findByText('Sorry, an error occured', { exact: false })
  })

  it('should display the success message', async function () {
    const email = 'abc@gmail.com'
    render(<UserActivateRegister />)
    const endPointResponse = {
      status: 200,
      body: {
        email,
        setNewPasswordUrl: 'SetNewPasswordURL',
      },
    }
    fetchMock.get('/user/tpds/queues', TPDS_SYNCED)
    const registerMock = fetchMock.post('/admin/register', endPointResponse)
    const registerInput = screen.getByLabelText('Emails to register new users')
    const registerButton = screen.getByRole('button', { name: /register/i })

    fireEvent.change(registerInput, { target: { value: email } })
    fireEvent.click(registerButton)

    expect(registerMock.callHistory.called()).to.be.true
    await screen.findByText(
      "We've sent out welcome emails to the registered users."
    )
  })

  it('should display the registered emails', async function () {
    const email = 'abc@gmail.com, def@gmail.com'
    render(<UserActivateRegister />)
    const endPointResponse1 = {
      status: 200,
      body: {
        email: 'abc@gmail.com',
        setNewPasswordUrl: 'SetNewPasswordURL',
      },
    }
    const endPointResponse2 = {
      status: 200,
      body: {
        email: 'def@gmail.com',
        setNewPasswordUrl: 'SetNewPasswordURL',
      },
    }
    fetchMock.get('/user/tpds/queues', TPDS_SYNCED)
    const registerMock = fetchMock.post('/admin/register', (path, req) => {
      const body = JSON.parse(req.body)
      if (body.email === 'abc@gmail.com') return endPointResponse1
      else if (body.email === 'def@gmail.com') return endPointResponse2
    })
    const registerInput = screen.getByLabelText('Emails to register new users')
    const registerButton = screen.getByRole('button', { name: /register/i })

    fireEvent.change(registerInput, { target: { value: email } })
    fireEvent.click(registerButton)

    expect(registerMock.callHistory.called()).to.be.true
    await screen.findByText('abc@gmail.com')
    await screen.findByText('def@gmail.com')
  })

  it('should display the failed emails', async function () {
    const email = 'abc@, def@'
    render(<UserActivateRegister />)
    const endPointResponse1 = {
      status: 500,
    }
    const endPointResponse2 = {
      status: 500,
    }
    fetchMock.get('/user/tpds/queues', TPDS_SYNCED)
    const registerMock = fetchMock.post('/admin/register', (path, req) => {
      const body = JSON.parse(req.body)
      if (body.email === 'abc@') return endPointResponse1
      else if (body.email === 'def@') return endPointResponse2
    })
    const registerInput = screen.getByLabelText('Emails to register new users')
    const registerButton = screen.getByRole('button', { name: /register/i })

    fireEvent.change(registerInput, { target: { value: email } })
    fireEvent.click(registerButton)

    expect(registerMock.callHistory.called()).to.be.true
    await screen.findByText('abc@')
    await screen.findByText('def@')
  })

  it('should display the registered and failed emails together', async function () {
    const email = 'abc@gmail.com, def@'
    render(<UserActivateRegister />)
    const endPointResponse1 = {
      status: 200,
      body: {
        email: 'abc@gmail.com',
        setNewPasswordUrl: 'SetNewPasswordURL',
      },
    }
    const endPointResponse2 = {
      status: 500,
    }
    fetchMock.get('/user/tpds/queues', TPDS_SYNCED)
    const registerMock = fetchMock.post('/admin/register', (path, req) => {
      const body = JSON.parse(req.body)
      if (body.email === 'abc@gmail.com') return endPointResponse1
      else if (body.email === 'def@gmail.com') return endPointResponse2
      else return 500
    })
    const registerInput = screen.getByLabelText('Emails to register new users')
    const registerButton = screen.getByRole('button', { name: /register/i })

    fireEvent.change(registerInput, { target: { value: email } })
    fireEvent.click(registerButton)

    expect(registerMock.callHistory.called()).to.be.true
    await screen.findByText('abc@gmail.com')
    await screen.findByText('def@')
  })
})
