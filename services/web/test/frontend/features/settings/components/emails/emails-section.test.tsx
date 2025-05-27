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
    fetchMock.removeRoutes().clearHistory()
  })

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('renders translated heading', function () {
    render(<EmailsSection />)

    screen.getByRole('heading', { name: /emails and affiliations/i })
  })

  it('renders translated description', function () {
    render(<EmailsSection />)

    screen.getByText(/add additional email addresses/i)
    screen.getByText(/to change your primary email/i)
    screen.getByRole('link', {
      name: /learn more about managing your Overleaf emails/i,
    })
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

    await screen.findByText(/unconfirmed/i)
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

    await screen.findByRole('button', { name: 'Send confirmation code' })
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

    fetchMock.post('/user/emails/send-confirmation-code', 200)

    const button = screen.getByRole('button', {
      name: 'Send confirmation code',
    })
    fireEvent.click(button)

    expect(
      screen.queryByRole('button', {
        name: 'Send confirmation code',
      })
    ).to.be.null

    await screen.findByRole('dialog')

    expect(
      screen.queryByText(/an error has occurred while performing your request/i)
    ).to.be.null

    await screen.findAllByRole('button', {
      name: 'Resend confirmation code',
    })
  })

  it('shows error when resending email fails', async function () {
    fetchMock.get('/user/emails?ensureAffiliation=true', [unconfirmedUserData])

    render(<EmailsSection />)
    await waitForElementToBeRemoved(() => screen.getByText(/loading/i))

    fetchMock.post('/user/emails/send-confirmation-code', 503)

    const button = screen.getByRole('button', {
      name: 'Send confirmation code',
    })
    fireEvent.click(button)

    expect(screen.queryByRole('button', { name: 'Send confirmation code' })).to
      .be.null

    await screen.findByRole('dialog')

    await screen.findByText(/sorry, something went wrong/i)
    screen.getByRole('button', { name: 'Resend confirmation code' })
  })

  it('sorts emails with primary first, then confirmed, then unconfirmed', async function () {
    const unconfirmedEmail = { ...unconfirmedUserData, email: 'b@example.com' }
    const unconfirmedEmailTwo = {
      ...unconfirmedUserData,
      email: 'd@example.com',
    }
    const confirmedEmail = {
      ...confirmedUserData,
      email: 'a@example.com',
      confirmedAt: new Date().toISOString(),
    }
    const confirmedEmailTwo = {
      ...confirmedUserData,
      email: 'e@example.com',
      confirmedAt: new Date().toISOString(),
    }
    const primaryEmail = {
      ...professionalUserData,
      email: 'c@example.com',
      default: true,
    }

    const emails = [
      confirmedEmailTwo,
      unconfirmedEmailTwo,
      unconfirmedEmail,
      confirmedEmail,
      primaryEmail,
    ]

    fetchMock.get('/user/emails?ensureAffiliation=true', emails)
    render(<EmailsSection />)

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i))

    const emailElements = screen.getAllByTestId(/email-row/i)

    // Primary should be first regardless of alphabetical order
    expect(within(emailElements[0]).getByText('c@example.com')).to.exist
    expect(within(emailElements[0]).getByText('Primary')).to.exist

    // Confirmed should be second in alphabetical order
    expect(within(emailElements[1]).getByText('a@example.com')).to.exist
    expect(within(emailElements[2]).getByText('e@example.com')).to.exist

    // Unconfirmed should be last in alphabetical order
    expect(within(emailElements[3]).getByText('b@example.com')).to.exist
    expect(within(emailElements[3]).getByText(/unconfirmed/i)).to.exist
    expect(within(emailElements[4]).getByText('d@example.com')).to.exist
    expect(within(emailElements[4]).getByText(/unconfirmed/i)).to.exist
  })
})
