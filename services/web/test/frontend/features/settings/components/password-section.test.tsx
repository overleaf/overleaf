import { expect } from 'chai'
import { fireEvent, screen, render } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import PasswordSection from '../../../../../frontend/js/features/settings/components/password-section'

describe('<PasswordSection />', function () {
  beforeEach(function () {
    window.metaAttributesCache = window.metaAttributesCache || new Map()
    window.metaAttributesCache.set('ol-ExposedSettings', {
      isOverleaf: true,
    })
    window.metaAttributesCache.set(
      'ol-isExternalAuthenticationSystemUsed',
      false
    )
    window.metaAttributesCache.set('ol-hasPassword', true)
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
    fetchMock.reset()
  })

  it('shows password managed externally message', async function () {
    window.metaAttributesCache.set('ol-ExposedSettings', {
      isOverleaf: false,
    })
    window.metaAttributesCache.set(
      'ol-isExternalAuthenticationSystemUsed',
      true
    )
    render(<PasswordSection />)

    screen.getByText('Password settings are managed externally')
  })

  it('shows no existing password message', async function () {
    window.metaAttributesCache.set('ol-hasPassword', false)
    render(<PasswordSection />)

    screen.getByText('Please use the password reset form to set your password')
  })

  it('submits all inputs', async function () {
    const updateMock = fetchMock.post('/user/password/update', 200)
    render(<PasswordSection />)
    submitValidForm()

    expect(updateMock.called()).to.be.true
    expect(JSON.parse(updateMock.lastCall()[1].body)).to.deep.equal({
      currentPassword: 'foobar',
      newPassword1: 'barbaz',
      newPassword2: 'barbaz',
    })
  })

  it('disables button on invalid form', async function () {
    const updateMock = fetchMock.post('/user/password/update', 200)
    render(<PasswordSection />)

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Change',
      })
    )
    expect(updateMock.called()).to.be.false
  })

  it('validates inputs', async function () {
    render(<PasswordSection />)

    const button = screen.getByRole('button', {
      name: 'Change',
    })
    expect(button.disabled).to.be.true

    fireEvent.change(screen.getByLabelText('Current Password'), {
      target: { value: 'foobar' },
    })
    expect(button.disabled).to.be.true

    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'barbaz' },
    })
    expect(button.disabled).to.be.true

    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'bar' },
    })
    screen.getByText('Doesn’t match')
    expect(button.disabled).to.be.true

    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'barbaz' },
    })
    expect(button.disabled).to.be.false
  })

  it('sets browser validation attributes', async function () {
    window.metaAttributesCache.set('ol-passwordStrengthOptions', {
      length: {
        min: 3,
      },
    })
    render(<PasswordSection />)

    const currentPasswordInput = screen.getByLabelText('Current Password')
    const newPassword1Input = screen.getByLabelText('New Password')
    const newPassword2Input = screen.getByLabelText('Confirm New Password')

    expect(newPassword1Input.minLength).to.equal(3)

    // not required before changes
    expect(currentPasswordInput.required).to.be.false
    expect(newPassword1Input.required).to.be.false
    expect(newPassword2Input.required).to.be.false

    fireEvent.change(currentPasswordInput, {
      target: { value: 'foobar' },
    })
    fireEvent.change(newPassword1Input, {
      target: { value: 'barbaz' },
    })
    fireEvent.change(newPassword2Input, {
      target: { value: 'barbaz' },
    })
    expect(currentPasswordInput.required).to.be.true
    expect(newPassword1Input.required).to.be.true
    expect(newPassword2Input.required).to.be.true
  })

  it('shows inflight state and success message', async function () {
    let finishUpdateCall
    fetchMock.post(
      '/user/password/update',
      new Promise(resolve => (finishUpdateCall = resolve))
    )
    render(<PasswordSection />)
    submitValidForm()

    await screen.findByText('Saving…')

    finishUpdateCall({
      status: 200,
      body: {
        message: {
          type: 'success',
          email: 'tim.alby@overleaf.com',
          text: 'Password changed',
        },
      },
    })
    await screen.findByRole('button', {
      name: 'Change',
    })
    screen.getByText('Password changed')
  })

  it('shows server error', async function () {
    fetchMock.post('/user/password/update', 500)
    render(<PasswordSection />)
    submitValidForm()
    await screen.findByText(
      'Something went wrong talking to the server :(. Please try again.'
    )
  })

  it('shows server error message', async function () {
    fetchMock.post('/user/password/update', {
      status: 400,
      body: {
        message: 'Your old password is wrong',
      },
    })
    render(<PasswordSection />)
    submitValidForm()

    await screen.findByText('Your old password is wrong')
  })
})

function submitValidForm() {
  fireEvent.change(screen.getByLabelText('Current Password'), {
    target: { value: 'foobar' },
  })
  fireEvent.change(screen.getByLabelText('New Password'), {
    target: { value: 'barbaz' },
  })
  fireEvent.change(screen.getByLabelText('Confirm New Password'), {
    target: { value: 'barbaz' },
  })
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Change',
    })
  )
}
