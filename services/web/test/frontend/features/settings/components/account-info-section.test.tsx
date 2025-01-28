import { expect } from 'chai'
import { fireEvent, screen, render } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import AccountInfoSection from '../../../../../frontend/js/features/settings/components/account-info-section'
import { UserProvider } from '../../../../../frontend/js/shared/context/user-context'
import getMeta from '@/utils/meta'

function renderSectionWithUserProvider() {
  render(<AccountInfoSection />, {
    wrapper: ({ children }) => <UserProvider>{children}</UserProvider>,
  })
}

describe('<AccountInfoSection />', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-user', {
      email: 'sherlock@holmes.co.uk',
      first_name: 'Sherlock',
      last_name: 'Holmes',
    })
    Object.assign(getMeta('ol-ExposedSettings'), {
      hasAffiliationsFeature: false,
    })
    window.metaAttributesCache.set(
      'ol-isExternalAuthenticationSystemUsed',
      false
    )
    window.metaAttributesCache.set('ol-shouldAllowEditingDetails', true)
  })

  afterEach(function () {
    fetchMock.reset()
  })

  it('submits all inputs', async function () {
    const updateMock = fetchMock.post('/user/settings', 200)
    renderSectionWithUserProvider()

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'john@watson.co.uk' },
    })
    fireEvent.change(screen.getByLabelText('First name'), {
      target: { value: 'John' },
    })
    fireEvent.change(screen.getByLabelText('Last name'), {
      target: { value: 'Watson' },
    })
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Update',
      })
    )
    expect(updateMock.called()).to.be.true
    expect(JSON.parse(updateMock.lastCall()![1]!.body as string)).to.deep.equal(
      {
        email: 'john@watson.co.uk',
        first_name: 'John',
        last_name: 'Watson',
      }
    )
  })

  it('disables button on invalid email', async function () {
    const updateMock = fetchMock.post('/user/settings', 200)
    renderSectionWithUserProvider()

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'john' },
    })
    const button = screen.getByRole('button', {
      name: 'Update',
    }) as HTMLButtonElement

    expect(button.disabled).to.be.true
    fireEvent.click(button)

    expect(updateMock.called()).to.be.false
  })

  it('shows inflight state and success message', async function () {
    let finishUpdateCall: (value: any) => void = () => {}
    fetchMock.post(
      '/user/settings',
      new Promise(resolve => (finishUpdateCall = resolve))
    )
    renderSectionWithUserProvider()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Update',
      })
    )
    await screen.findByText('Saving…')

    finishUpdateCall(200)
    await screen.findByRole('button', {
      name: 'Update',
    })
    screen.getByText('Thanks, your settings have been updated.')
  })

  it('shows server error', async function () {
    fetchMock.post('/user/settings', 500)
    renderSectionWithUserProvider()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Update',
      })
    )
    await screen.findByText('Something went wrong. Please try again.')
  })

  it('shows invalid error', async function () {
    fetchMock.post('/user/settings', 400)
    renderSectionWithUserProvider()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Update',
      })
    )
    await screen.findByText(
      'Invalid Request. Please correct the data and try again.'
    )
  })

  it('shows conflict error', async function () {
    fetchMock.post('/user/settings', {
      status: 409,
      body: {
        message: 'This email is already registered',
      },
    })
    renderSectionWithUserProvider()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Update',
      })
    )
    await screen.findByText('This email is already registered')
  })

  it('hides email input', async function () {
    Object.assign(getMeta('ol-ExposedSettings'), {
      hasAffiliationsFeature: true,
    })
    const updateMock = fetchMock.post('/user/settings', 200)

    renderSectionWithUserProvider()
    expect(screen.queryByLabelText('Email')).to.not.exist

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Update',
      })
    )
    expect(JSON.parse(updateMock.lastCall()![1]!.body as string)).to.deep.equal(
      {
        first_name: 'Sherlock',
        last_name: 'Holmes',
      }
    )
  })

  it('disables email input', async function () {
    window.metaAttributesCache.set(
      'ol-isExternalAuthenticationSystemUsed',
      true
    )
    const updateMock = fetchMock.post('/user/settings', 200)

    renderSectionWithUserProvider()
    expect(screen.getByLabelText('Email')).to.have.property('readOnly', true)
    expect(screen.getByLabelText('First name')).to.have.property(
      'readOnly',
      false
    )
    expect(screen.getByLabelText('Last name')).to.have.property(
      'readOnly',
      false
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Update',
      })
    )
    expect(JSON.parse(updateMock.lastCall()![1]!.body as string)).to.deep.equal(
      {
        first_name: 'Sherlock',
        last_name: 'Holmes',
      }
    )
  })

  it('disables names input', async function () {
    window.metaAttributesCache.set('ol-shouldAllowEditingDetails', false)
    const updateMock = fetchMock.post('/user/settings', 200)

    renderSectionWithUserProvider()
    expect(screen.getByLabelText('Email')).to.have.property('readOnly', false)
    expect(screen.getByLabelText('First name')).to.have.property(
      'readOnly',
      true
    )
    expect(screen.getByLabelText('Last name')).to.have.property(
      'readOnly',
      true
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Update',
      })
    )
    expect(JSON.parse(updateMock.lastCall()![1]!.body as string)).to.deep.equal(
      {
        email: 'sherlock@holmes.co.uk',
      }
    )
  })
})
