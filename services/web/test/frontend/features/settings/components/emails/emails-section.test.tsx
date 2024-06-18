import {
  render,
  screen,
  within,
  fireEvent,
  waitFor,
  waitForElementToBeRemoved,
} from '@testing-library/react'
import EmailsSection from '../../../../../../frontend/js/features/settings/components/emails-section'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import {
  confirmedUserData,
  fakeUsersData,
  professionalUserData,
  unconfirmedUserData,
} from '../../fixtures/test-user-email-data'
import getMeta from '@/utils/meta'

describe('<EmailsSection />', function () {
  beforeEach(function () {
    Object.assign(getMeta('ol-ExposedSettings'), {
      hasAffiliationsFeature: true,
    })
    fetchMock.reset()
  })

  afterEach(function () {
    fetchMock.reset()
  })

  it('renders translated heading', function () {
    render(<EmailsSection />)

    screen.getByRole('heading', { name: /emails and affiliations/i })
  })

  it('renders translated description', function () {
    render(<EmailsSection />)

    screen.getByText(/add additional email addresses/i)
    screen.getByText(/to change your primary email/i)
  })

  it('renders a loading message when loading', async function () {
    render(<EmailsSection />)

    await screen.findByText(/loading/i)
  })

  it('renders an error message and hides loading message on error', async function () {
    fetchMock.get('/user/emails?ensureAffiliation=true', 500)
    render(<EmailsSection />)

    await screen.findByText(
      /an error has occurred while performing your request/i
    )
    expect(screen.queryByText(/loading/i)).to.be.null
  })

  it('renders user emails', async function () {
    fetchMock.get('/user/emails?ensureAffiliation=true', fakeUsersData)
    render(<EmailsSection />)

    await waitFor(() => {
      fakeUsersData.forEach(userData => {
        screen.getByText(new RegExp(userData.email, 'i'))
      })
    })
  })

  it('renders primary status', async function () {
    fetchMock.get('/user/emails?ensureAffiliation=true', [professionalUserData])
    render(<EmailsSection />)

    await screen.findByText(`${professionalUserData.email}`)
    screen.getByText('Primary')
  })

  it('shows confirmation status for unconfirmed users', async function () {
    fetchMock.get('/user/emails?ensureAffiliation=true', [unconfirmedUserData])
    render(<EmailsSection />)

    await screen.findByText(/please check your inbox/i)
  })

  it('hides confirmation status for confirmed users', async function () {
    fetchMock.get('/user/emails?ensureAffiliation=true', [confirmedUserData])
    render(<EmailsSection />)
    await waitForElementToBeRemoved(() => screen.getByText(/loading/i))

    expect(screen.queryByText(/please check your inbox/i)).to.be.null
  })

  it('renders resend link', async function () {
    fetchMock.get('/user/emails?ensureAffiliation=true', [unconfirmedUserData])
    render(<EmailsSection />)

    await screen.findByRole('button', { name: /resend confirmation email/i })
  })

  it('renders professional label', async function () {
    fetchMock.get('/user/emails?ensureAffiliation=true', [professionalUserData])
    render(<EmailsSection />)

    const node = await screen.findByText(professionalUserData.email, {
      exact: false,
    })
    expect(within(node).getByText(/professional/i)).to.exist
  })

  it('shows loader when resending email', async function () {
    fetchMock.get('/user/emails?ensureAffiliation=true', [unconfirmedUserData])

    render(<EmailsSection />)
    await waitForElementToBeRemoved(() => screen.getByText(/loading/i))

    fetchMock.post('/user/emails/resend_confirmation', 200)

    const button = screen.getByRole('button', {
      name: /resend confirmation email/i,
    })
    fireEvent.click(button)

    expect(
      screen.queryByRole('button', {
        name: /resend confirmation email/i,
      })
    ).to.be.null

    await waitForElementToBeRemoved(() => screen.getByText(/sending/i))

    expect(
      screen.queryByText(/an error has occurred while performing your request/i)
    ).to.be.null

    await screen.findByRole('button', {
      name: /resend confirmation email/i,
    })
  })

  it('shows error when resending email fails', async function () {
    fetchMock.get('/user/emails?ensureAffiliation=true', [unconfirmedUserData])

    render(<EmailsSection />)
    await waitForElementToBeRemoved(() => screen.getByText(/loading/i))

    fetchMock.post('/user/emails/resend_confirmation', 503)

    const button = screen.getByRole('button', {
      name: /resend confirmation email/i,
    })
    fireEvent.click(button)

    expect(
      screen.queryByRole('button', {
        name: /resend confirmation email/i,
      })
    ).to.be.null

    await waitForElementToBeRemoved(() => screen.getByText(/sending/i))

    screen.getByText(/sorry, something went wrong/i)
    screen.getByRole('button', { name: /resend confirmation email/i })
  })
})
