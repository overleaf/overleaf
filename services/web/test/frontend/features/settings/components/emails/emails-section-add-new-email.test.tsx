import {
  render,
  screen,
  fireEvent,
  waitForElementToBeRemoved,
} from '@testing-library/react'
import EmailsSection from '../../../../../../frontend/js/features/settings/components/emails-section'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { UserEmailData } from '../../../../../../types/user-email'

const userEmailData: UserEmailData = {
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
  email: 'baz@overleaf.com',
  default: false,
}

describe('<EmailsSection />', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-ExposedSettings', {
      hasAffiliationsFeature: true,
    })
    fetchMock.reset()
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
    fetchMock.reset()
  })

  it('renders "add another email" button', function () {
    fetchMock.get('/user/emails?ensureAffiliation=true', [])
    render(<EmailsSection />)

    screen.getByRole('button', { name: /add another email/i })
  })

  it('renders input', async function () {
    fetchMock.get('/user/emails?ensureAffiliation=true', [])
    render(<EmailsSection />)

    const addAnotherEmailBtn = (await screen.findByRole('button', {
      name: /add another email/i,
    })) as HTMLButtonElement
    fireEvent.click(addAnotherEmailBtn)

    screen.getByLabelText(/email/i)
  })

  it('renders "add new email" button', async function () {
    fetchMock.get('/user/emails?ensureAffiliation=true', [])
    render(<EmailsSection />)

    const addAnotherEmailBtn = (await screen.findByRole('button', {
      name: /add another email/i,
    })) as HTMLButtonElement
    fireEvent.click(addAnotherEmailBtn)

    screen.getByRole('button', { name: /add new email/i })
  })

  it('adds new email address', async function () {
    fetchMock.get('/user/emails?ensureAffiliation=true', [])
    render(<EmailsSection />)

    await fetchMock.flush(true)
    fetchMock.reset()
    fetchMock
      .get('/user/emails?ensureAffiliation=true', [userEmailData])
      .post('/user/emails', 200)

    const addAnotherEmailBtn = await screen.findByRole('button', {
      name: /add another email/i,
    })

    fireEvent.click(addAnotherEmailBtn)
    const input = screen.getByLabelText(/email/i)

    fireEvent.change(input, {
      target: { value: userEmailData.email },
    })

    const submitBtn = screen.getByRole('button', {
      name: /add new email/i,
    }) as HTMLButtonElement

    expect(submitBtn.disabled).to.be.false

    fireEvent.click(submitBtn)

    expect(submitBtn.disabled).to.be.true

    await waitForElementToBeRemoved(() =>
      screen.getByRole('button', {
        name: /add new email/i,
      })
    )

    screen.getByText(userEmailData.email)
  })

  it('fails to add add new email address', async function () {
    fetchMock.get('/user/emails?ensureAffiliation=true', [])
    render(<EmailsSection />)

    await fetchMock.flush(true)
    fetchMock.reset()
    fetchMock
      .get('/user/emails?ensureAffiliation=true', [])
      .post('/user/emails', 500)

    const addAnotherEmailBtn = await screen.findByRole('button', {
      name: /add another email/i,
    })

    fireEvent.click(addAnotherEmailBtn)
    const input = screen.getByLabelText(/email/i)

    fireEvent.change(input, {
      target: { value: userEmailData.email },
    })

    const submitBtn = screen.getByRole('button', {
      name: /add new email/i,
    }) as HTMLButtonElement

    expect(submitBtn.disabled).to.be.false

    fireEvent.click(submitBtn)

    expect(submitBtn.disabled).to.be.true

    await screen.findByText(
      /an error has occurred while performing your request/i
    )
    expect(submitBtn).to.not.be.null
    expect(submitBtn.disabled).to.be.false
  })
})
