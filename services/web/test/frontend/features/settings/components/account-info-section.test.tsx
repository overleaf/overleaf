import { expect } from 'chai'
import { fireEvent, screen, render } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import AccountInfoSection from '../../../../../frontend/js/features/settings/components/account-info-section'

describe('<AccountInfoSection />', function () {
  beforeEach(function () {
    window.metaAttributesCache = window.metaAttributesCache || new Map()
    window.metaAttributesCache.set('ol-usersEmail', 'sherlock@holmes.co.uk')
    window.metaAttributesCache.set('ol-firstName', 'Sherlock')
    window.metaAttributesCache.set('ol-lastName', 'Holmes')
    window.metaAttributesCache.set('ol-ExposedSettings', {
      hasAffiliationsFeature: false,
    })
    window.metaAttributesCache.set(
      'ol-isExternalAuthenticationSystemUsed',
      false
    )
    window.metaAttributesCache.set('ol-shouldAllowEditingDetails', true)
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
    fetchMock.reset()
  })

  it('submits all inputs', async function () {
    const updateMock = fetchMock.post('/user/settings', 200)
    render(<AccountInfoSection />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'john@watson.co.uk' },
    })
    fireEvent.change(screen.getByLabelText('First Name'), {
      target: { value: 'John' },
    })
    fireEvent.change(screen.getByLabelText('Last Name'), {
      target: { value: 'Watson' },
    })
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Update',
      })
    )
    expect(updateMock.called()).to.be.true
    expect(JSON.parse(updateMock.lastCall()[1].body)).to.deep.equal({
      email: 'john@watson.co.uk',
      firstName: 'John',
      lastName: 'Watson',
    })
  })

  it('disables button on invalid email', async function () {
    const updateMock = fetchMock.post('/user/settings', 200)
    render(<AccountInfoSection />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'john' },
    })
    const button = screen.getByRole('button', {
      name: 'Update',
    })

    expect(button.disabled).to.be.true
    fireEvent.click(button)

    expect(updateMock.called()).to.be.false
  })

  it('shows inflight state and success message', async function () {
    let finishUpdateCall
    fetchMock.post(
      '/user/settings',
      new Promise(resolve => (finishUpdateCall = resolve))
    )
    render(<AccountInfoSection />)

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
    render(<AccountInfoSection />)

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Update',
      })
    )
    await screen.findByText(
      'Something went wrong talking to the server :(. Please try again.'
    )
  })

  it('shows invalid error', async function () {
    fetchMock.post('/user/settings', 400)
    render(<AccountInfoSection />)

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
    render(<AccountInfoSection />)

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Update',
      })
    )
    await screen.findByText('This email is already registered')
  })

  it('hides email input', async function () {
    window.metaAttributesCache.set('ol-ExposedSettings', {
      hasAffiliationsFeature: true,
    })
    const updateMock = fetchMock.post('/user/settings', 200)

    render(<AccountInfoSection />)
    expect(screen.queryByLabelText('Email')).to.not.exist

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Update',
      })
    )
    expect(JSON.parse(updateMock.lastCall()[1].body)).to.deep.equal({
      firstName: 'Sherlock',
      lastName: 'Holmes',
    })
  })

  it('disables email input', async function () {
    window.metaAttributesCache.set(
      'ol-isExternalAuthenticationSystemUsed',
      true
    )
    const updateMock = fetchMock.post('/user/settings', 200)

    render(<AccountInfoSection />)
    expect(screen.getByLabelText('Email').readOnly).to.be.true
    expect(screen.getByLabelText('First Name').readOnly).to.be.false
    expect(screen.getByLabelText('Last Name').readOnly).to.be.false

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Update',
      })
    )
    expect(JSON.parse(updateMock.lastCall()[1].body)).to.deep.equal({
      firstName: 'Sherlock',
      lastName: 'Holmes',
    })
  })

  it('disables names input', async function () {
    window.metaAttributesCache.set('ol-shouldAllowEditingDetails', false)
    const updateMock = fetchMock.post('/user/settings', 200)

    render(<AccountInfoSection />)
    expect(screen.getByLabelText('Email').readOnly).to.be.false
    expect(screen.getByLabelText('First Name').readOnly).to.be.true
    expect(screen.getByLabelText('Last Name').readOnly).to.be.true

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Update',
      })
    )
    expect(JSON.parse(updateMock.lastCall()[1].body)).to.deep.equal({
      email: 'sherlock@holmes.co.uk',
    })
  })
})
