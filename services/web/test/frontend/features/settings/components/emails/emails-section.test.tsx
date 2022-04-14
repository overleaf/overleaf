import {
  render,
  screen,
  within,
  fireEvent,
  waitForElementToBeRemoved,
} from '@testing-library/react'
import EmailsSection from '../../../../../../frontend/js/features/settings/components/emails-section'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { UserEmailData } from '../../../../../../types/user-email'

const confirmedUserData: UserEmailData = {
  confirmedAt: '2022-03-10T10:59:44.139Z',
  email: 'bar@overleaf.com',
  default: false,
}

const unconfirmedUserData: UserEmailData = {
  email: 'baz@overleaf.com',
  default: false,
}

const professionalUserData: UserEmailData = {
  affiliation: {
    cachedConfirmedAt: null,
    cachedPastReconfirmDate: false,
    cachedReconfirmedAt: null,
    department: 'Art History',
    institution: {
      commonsAccount: false,
      confirmed: true,
      id: 1,
      isUniversity: false,
      name: 'Overleaf',
      ssoEnabled: false,
      ssoBeta: false,
    },
    inReconfirmNotificationPeriod: false,
    inferred: false,
    licence: 'pro_plus',
    pastReconfirmDate: false,
    portal: { slug: '', templates_count: 1 },
    role: 'Reader',
  },
  confirmedAt: '2022-03-09T10:59:44.139Z',
  email: 'foo@overleaf.com',
  default: true,
}

const fakeUsersData = [
  { ...confirmedUserData },
  { ...unconfirmedUserData },
  { ...professionalUserData },
]

describe('<EmailsSection />', function () {
  afterEach(function () {
    window.metaAttributesCache = new Map()
    fetchMock.reset()
  })

  it('renders translated heading', function () {
    window.metaAttributesCache.set('ol-userEmails', fakeUsersData)
    render(<EmailsSection />)

    screen.getByRole('heading', { name: /emails and affiliations/i })
  })

  it('renders translated description', function () {
    window.metaAttributesCache.set('ol-userEmails', fakeUsersData)
    render(<EmailsSection />)

    screen.getByText(/add additional email addresses/i)
    screen.getByText(/to change your primary email/i)
  })

  it('renders user emails', function () {
    window.metaAttributesCache.set('ol-userEmails', fakeUsersData)
    render(<EmailsSection />)

    fakeUsersData.forEach(userData => {
      screen.getByText(new RegExp(userData.email, 'i'))
    })
  })

  it('renders primary status', function () {
    window.metaAttributesCache.set('ol-userEmails', [professionalUserData])
    render(<EmailsSection />)

    screen.getByText(`${professionalUserData.email} (primary)`)
  })

  it('shows confirmation status for unconfirmed users', function () {
    window.metaAttributesCache.set('ol-userEmails', [unconfirmedUserData])
    render(<EmailsSection />)

    screen.getByText(/please check your inbox/i)
  })

  it('hides confirmation status for confirmed users', function () {
    window.metaAttributesCache.set('ol-userEmails', [confirmedUserData])
    render(<EmailsSection />)

    expect(screen.queryByText(/please check your inbox/i)).to.be.null
  })

  it('renders resend link', function () {
    window.metaAttributesCache.set('ol-userEmails', [unconfirmedUserData])
    render(<EmailsSection />)

    screen.getByRole('button', { name: /resend confirmation email/i })
  })

  it('renders professional label', function () {
    window.metaAttributesCache.set('ol-userEmails', [professionalUserData])
    render(<EmailsSection />)

    const node = screen.getByText(professionalUserData.email, {
      exact: false,
    })
    expect(within(node).getByText(/professional/i)).to.exist
  })

  it('shows loader when resending email', async function () {
    fetchMock.post('/user/emails/resend_confirmation', 200)
    window.metaAttributesCache.set('ol-userEmails', [unconfirmedUserData])
    render(<EmailsSection />)

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
    fetchMock.post('/user/emails/resend_confirmation', 503)
    window.metaAttributesCache.set('ol-userEmails', [unconfirmedUserData])
    render(<EmailsSection />)

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

    screen.getByText(/an error has occurred while performing your request/i)
    screen.getByRole('button', { name: /resend confirmation email/i })
  })
})
