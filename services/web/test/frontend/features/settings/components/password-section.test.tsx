import { expect } from 'chai'
import { fireEvent, screen, render } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import PasswordSection from '../../../../../frontend/js/features/settings/components/password-section'
import getMeta from '@/utils/meta'

describe('<PasswordSection />', function () {
  beforeEach(function () {
    Object.assign(getMeta('ol-ExposedSettings'), {
      isOverleaf: true,
    })
    window.metaAttributesCache.set(
      'ol-isExternalAuthenticationSystemUsed',
      false
    )
    window.metaAttributesCache.set('ol-hasPassword', true)
  })

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('shows password managed externally message', async function () {
    Object.assign(getMeta('ol-ExposedSettings'), {
      isOverleaf: false,
    })
    window.metaAttributesCache.set(
      'ol-isExternalAuthenticationSystemUsed',
      true
    )
    render(<PasswordSection />)

    screen.getByText('Password settings are managed externally.')
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

    expect(updateMock.callHistory.called()).to.be.true
    expect(
      JSON.parse(updateMock.callHistory.calls().at(-1)?.options.body as string)
    ).to.deep.equal({
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
    expect(updateMock.callHistory.called()).to.be.false
  })

  it('validates inputs', async function () {
    render(<PasswordSection />)

    const button = screen.getByRole('button', {
      name: 'Change',
    }) as HTMLButtonElement
    expect(button.disabled).to.be.true

    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'foobar' },
    })
    expect(button.disabled).to.be.true

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'barbaz' },
    })
    expect(button.disabled).to.be.true

    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'bar' },
    })
    screen.getByText('Doesn’t match')
    expect(button.disabled).to.be.true

    fireEvent.change(screen.getByLabelText('Confirm new password'), {
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

    const currentPasswordInput = screen.getByLabelText(
      'Current password'
    ) as HTMLInputElement
    const newPassword1Input = screen.getByLabelText(
      'New password'
    ) as HTMLInputElement
    const newPassword2Input = screen.getByLabelText(
      'Confirm new password'
    ) as HTMLInputElement

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
    let finishUpdateCall: (value: any) => void = () => {}
    fetchMock.post(
      '/user/password/update',
      new Promise(resolve => (finishUpdateCall = resolve))
    )
    render(<PasswordSection />)
    submitValidForm()

    await screen.findByRole('button', { name: 'Saving…' })

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
    await screen.findByText('Something went wrong. Please try again.')
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

  it('shows message when user cannot use password log in', async function () {
    window.metaAttributesCache.set('ol-cannot-change-password', true)
    render(<PasswordSection />)
    await screen.findByRole('heading', { name: 'Change password' })
    screen.getByText(
      'You can’t add or change your password because your group or organization uses',
      { exact: false }
    )
    screen.getByRole('link', { name: 'single sign-on (SSO)' })
  })
})

function submitValidForm() {
  fireEvent.change(screen.getByLabelText('Current password'), {
    target: { value: 'foobar' },
  })
  fireEvent.change(screen.getByLabelText('New password'), {
    target: { value: 'barbaz' },
  })
  fireEvent.change(screen.getByLabelText('Confirm new password'), {
    target: { value: 'barbaz' },
  })
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Change',
    })
  )
}
