import { expect } from 'chai'
import { fireEvent, screen, render } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import EmailPreferencesForm from '../../../../../../frontend/js/features/settings/components/email-preferences/email-preferences-form'

describe('<EmailPreferencesForm />', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-newsletter-subscribed', true)
  })

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('shows subscribed state with unsubscribe button', function () {
    render(<EmailPreferencesForm />)

    screen.getByText('You are', { exact: false })
    screen.getByRole('button', { name: 'Unsubscribe' })
    screen.getByText('Please note: you will still receive important emails', {
      exact: false,
    })
  })

  it('shows unsubscribed state with subscribe button', function () {
    window.metaAttributesCache.set('ol-newsletter-subscribed', false)
    render(<EmailPreferencesForm />)

    screen.getByText('You are', { exact: false })
    screen.getByRole('button', { name: 'Subscribe' })
    expect(
      screen.queryByText(
        'Please note: you will still receive important emails',
        { exact: false }
      )
    ).to.not.exist
  })

  it('calls unsubscribe endpoint when clicking unsubscribe', async function () {
    const unsubscribeMock = fetchMock.post('/user/newsletter/unsubscribe', {
      status: 200,
      body: { subscribed: false },
    })
    render(<EmailPreferencesForm />)

    const button = screen.getByRole('button', { name: 'Unsubscribe' })
    fireEvent.click(button)

    expect(unsubscribeMock.callHistory.called()).to.be.true
    expect(unsubscribeMock.callHistory.calls().at(-1)?.url).to.equal(
      'https://www.test-overleaf.com/user/newsletter/unsubscribe'
    )
  })

  it('calls subscribe endpoint when clicking subscribe', async function () {
    window.metaAttributesCache.set('ol-newsletter-subscribed', false)
    const subscribeMock = fetchMock.post('/user/newsletter/subscribe', {
      status: 200,
      body: { subscribed: true },
    })
    render(<EmailPreferencesForm />)

    const button = screen.getByRole('button', { name: 'Subscribe' })
    fireEvent.click(button)

    expect(subscribeMock.callHistory.called()).to.be.true
    expect(subscribeMock.callHistory.calls().at(-1)?.url).to.equal(
      'https://www.test-overleaf.com/user/newsletter/subscribe'
    )
  })

  it('shows loading state while request is in flight', async function () {
    let finishRequest: (value: any) => void = () => {}
    fetchMock.post(
      '/user/newsletter/unsubscribe',
      new Promise(resolve => (finishRequest = resolve))
    )
    render(<EmailPreferencesForm />)

    const button = screen.getByRole('button', { name: 'Unsubscribe' })
    fireEvent.click(button)

    await screen.findByRole('button', { name: 'Saving…' })

    finishRequest({ status: 200, body: { subscribed: false } })
    await screen.findByRole('button', { name: 'Subscribe' })
  })

  it('shows success notification after successful action', async function () {
    fetchMock.post('/user/newsletter/unsubscribe', {
      status: 200,
      body: { subscribed: false },
    })
    render(<EmailPreferencesForm />)

    const button = screen.getByRole('button', { name: 'Unsubscribe' })
    fireEvent.click(button)

    await screen.findByText('Thanks, your settings have been updated.')
  })

  it('shows error notification on server error', async function () {
    fetchMock.post('/user/newsletter/unsubscribe', 500)
    render(<EmailPreferencesForm />)

    const button = screen.getByRole('button', { name: 'Unsubscribe' })
    fireEvent.click(button)

    await screen.findByText('Something went wrong. Please try again.')
  })

  it('shows error notification with message on 4xx error', async function () {
    fetchMock.post('/user/newsletter/unsubscribe', {
      status: 400,
      body: { message: 'Unable to update preferences' },
    })
    render(<EmailPreferencesForm />)

    const button = screen.getByRole('button', { name: 'Unsubscribe' })
    fireEvent.click(button)

    await screen.findByText('Unable to update preferences')
  })

  it('toggles between subscribed and unsubscribed states', async function () {
    fetchMock.post('/user/newsletter/unsubscribe', {
      status: 200,
      body: { subscribed: false },
    })
    fetchMock.post('/user/newsletter/subscribe', {
      status: 200,
      body: { subscribed: true },
    })
    render(<EmailPreferencesForm />)

    // Initially subscribed
    screen.getByRole('button', { name: 'Unsubscribe' })

    // Unsubscribe
    fireEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }))
    await screen.findByRole('button', { name: 'Subscribe' })

    // Subscribe again
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }))
    await screen.findByRole('button', { name: 'Unsubscribe' })
  })
})
