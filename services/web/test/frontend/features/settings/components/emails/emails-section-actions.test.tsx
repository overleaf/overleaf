import {
  render,
  screen,
  waitForElementToBeRemoved,
  fireEvent,
} from '@testing-library/react'
import { expect } from 'chai'
import { UserEmailData } from '../../../../../../types/user-email'
import fetchMock from 'fetch-mock'
import EmailsSection from '../../../../../../frontend/js/features/settings/components/emails-section'

const userEmailData: UserEmailData = {
  confirmedAt: '2022-03-10T10:59:44.139Z',
  email: 'bar@overleaf.com',
  default: false,
}

describe('email actions - make primary', function () {
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

  it('shows loader when making email primary and removes button', async function () {
    fetchMock
      .get('/user/emails?ensureAffiliation=true', [userEmailData])
      .post('/user/emails/default', 200)
    const userEmailDataCopy = { ...userEmailData }
    render(<EmailsSection />)

    const button = await screen.findByRole('button', { name: /make primary/i })
    fireEvent.click(button)

    expect(screen.queryByRole('button', { name: /make primary/i })).to.be.null

    userEmailDataCopy.default = true

    await waitForElementToBeRemoved(() =>
      screen.getByRole('button', { name: /sending/i })
    )

    expect(
      screen.queryByText(/an error has occurred while performing your request/i)
    ).to.be.null
    expect(screen.queryByRole('button', { name: /make primary/i })).to.be.null
  })

  it('shows error when making email primary', async function () {
    fetchMock
      .get('/user/emails?ensureAffiliation=true', [userEmailData])
      .post('/user/emails/default', 503)
    render(<EmailsSection />)

    const button = await screen.findByRole('button', { name: /make primary/i })
    fireEvent.click(button)

    await waitForElementToBeRemoved(() =>
      screen.getByRole('button', { name: /sending/i })
    )

    screen.getByText(/sorry, something went wrong/i)
    screen.getByRole('button', { name: /make primary/i })
  })
})

describe('email actions - delete', function () {
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

  it('shows loader when deleting and removes the row', async function () {
    fetchMock
      .get('/user/emails?ensureAffiliation=true', [userEmailData])
      .post('/user/emails/delete', 200)
    render(<EmailsSection />)

    const button = await screen.findByRole('button', { name: /remove/i })
    fireEvent.click(button)

    expect(screen.queryByRole('button', { name: /remove/i })).to.be.null

    await waitForElementToBeRemoved(() =>
      screen.getByRole('button', { name: /deleting/i })
    )

    expect(screen.queryByText(userEmailData.email)).to.be.null
  })

  it('shows error when making email primary', async function () {
    fetchMock
      .get('/user/emails?ensureAffiliation=true', [userEmailData])
      .post('/user/emails/delete', 503)
    render(<EmailsSection />)

    const button = await screen.findByRole('button', { name: /remove/i })
    fireEvent.click(button)

    await waitForElementToBeRemoved(() =>
      screen.getByRole('button', { name: /deleting/i })
    )

    screen.getByText(/sorry, something went wrong/i)
    screen.getByRole('button', { name: /remove/i })
  })
})
