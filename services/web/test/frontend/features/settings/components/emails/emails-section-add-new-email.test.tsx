import {
  render,
  screen,
  fireEvent,
  waitForElementToBeRemoved,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EmailsSection from '../../../../../../frontend/js/features/settings/components/emails-section'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { UserEmailData } from '../../../../../../types/user-email'
import { Affiliation } from '../../../../../../types/affiliation'
import withMarkup from '../../../../helpers/with-markup'
import getMeta from '@/utils/meta'
import { clearDomainCache } from '../../../../../../frontend/js/features/settings/components/emails/add-email/input'

const userEmailData: UserEmailData & { affiliation: Affiliation } = {
  affiliation: {
    cachedConfirmedAt: null,
    cachedEntitlement: null,
    cachedLastDayToReconfirm: null,
    cachedPastReconfirmDate: false,
    cachedReconfirmedAt: null,
    department: 'Art History',
    institution: {
      commonsAccount: false,
      writefullCommonsAccount: false,
      confirmed: true,
      id: 1,
      isUniversity: true,
      maxConfirmationMonths: null,
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

const institutionDomainData = [
  {
    university: {
      id: 1234,
      ssoEnabled: true,
      name: 'Auto Complete University',
    },
    hostname: 'autocomplete.edu',
    confirmed: true,
  },
] as const

function resetFetchMock() {
  fetchMock.removeRoutes().clearHistory()
  fetchMock.get('express:/institutions/domains', [])
}

async function confirmCodeForEmail(email: string) {
  await screen.findByText(
    `Enter the 6-digit confirmation code sent to ${email}.`
  )
  const inputCode = screen.getByLabelText(/6-digit confirmation code/i)
  fireEvent.change(inputCode, { target: { value: '123456' } })
  const submitCodeBtn = screen.getByRole<HTMLButtonElement>('button', {
    name: 'Confirm',
  })
  fireEvent.click(submitCodeBtn)
  await waitForElementToBeRemoved(() =>
    screen.getByRole('button', { name: /confirming/i })
  )
}

describe('<EmailsSection />', function () {
  beforeEach(function () {
    Object.assign(getMeta('ol-ExposedSettings'), {
      hasAffiliationsFeature: true,
      hasSamlFeature: true,
      samlInitPath: 'saml/init',
    })
    fetchMock.removeRoutes().clearHistory()
  })

  afterEach(function () {
    resetFetchMock()
    clearDomainCache()
  })

  it('renders "add another email" button', async function () {
    fetchMock.get('/user/emails?ensureAffiliation=true', [])
    render(<EmailsSection />)

    await screen.findByRole('button', { name: /add another email/i })
  })

  it('renders input', async function () {
    fetchMock.get('/user/emails?ensureAffiliation=true', [])
    render(<EmailsSection />)
    await fetchMock.callHistory.flush(true)

    const button = await screen.findByRole<HTMLButtonElement>('button', {
      name: /add another email/i,
    })
    fireEvent.click(button)

    await screen.findByLabelText(/email/i, { selector: 'input' })
  })

  it('renders "Start adding your address" until a valid email is typed', async function () {
    fetchMock.get('/user/emails?ensureAffiliation=true', [])
    fetchMock.get(`/institutions/domains?hostname=email.com&limit=1`, 200)
    fetchMock.get(`/institutions/domains?hostname=email&limit=1`, 200)
    render(<EmailsSection />)
    await fetchMock.callHistory.flush(true)

    const button = await screen.findByRole<HTMLButtonElement>('button', {
      name: /add another email/i,
    })
    fireEvent.click(button)

    const input = screen.getByLabelText(/email/i, { selector: 'input' })

    // initially the text is displayed and the "add email" button disabled
    screen.getByText('Start by adding your email address.')
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: /add new email/i,
      }).disabled
    ).to.be.true

    // no changes while writing the email address
    fireEvent.change(input, {
      target: { value: 'partial@email' },
    })
    screen.getByText('Start by adding your email address.')
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: /add new email/i,
      }).disabled
    ).to.be.true

    // the text is removed when the complete email address is typed, and the "add button" is reenabled
    fireEvent.change(input, {
      target: { value: 'valid@email.com' },
    })
    expect(screen.queryByText('Start by adding your email address.')).to.be.null
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: /add new email/i,
      }).disabled
    ).to.be.false
  })

  it('renders "add new email" button', async function () {
    fetchMock.get('/user/emails?ensureAffiliation=true', [])
    render(<EmailsSection />)

    const button = await screen.findByRole<HTMLButtonElement>('button', {
      name: /add another email/i,
    })
    fireEvent.click(button)

    screen.getByRole('button', { name: /add new email/i })
  })

  it('prevent users from adding new emails when the limit is reached', async function () {
    const emails = []
    for (let i = 0; i < 10; i++) {
      emails.push({ email: `bar${i}@overleaf.com` })
    }
    fetchMock.get('/user/emails?ensureAffiliation=true', emails)
    render(<EmailsSection />)

    const findByTextWithMarkup = withMarkup(screen.findByText)
    await findByTextWithMarkup(
      'You can have a maximum of 10 email addresses on this account. To add another email address, please delete an existing one.'
    )

    expect(screen.queryByRole('button', { name: /add another email/i })).to.not
      .exist
  })

  it('adds new email address', async function () {
    fetchMock.get('/user/emails?ensureAffiliation=true', [])
    render(<EmailsSection />)

    const addAnotherEmailBtn = await screen.findByRole<HTMLButtonElement>(
      'button',
      { name: /add another email/i }
    )

    await fetchMock.callHistory.flush(true)
    resetFetchMock()
    fetchMock
      .get('/user/emails?ensureAffiliation=true', [userEmailData])
      .post('/user/emails/secondary', 200)
      .post('/user/emails/confirm-secondary', 200)

    fireEvent.click(addAnotherEmailBtn)
    const input = screen.getByLabelText(/email/i, { selector: 'input' })

    fireEvent.change(input, {
      target: { value: userEmailData.email },
    })

    const submitBtn = screen.getByRole<HTMLButtonElement>('button', {
      name: /add new email/i,
    })

    expect(submitBtn.disabled).to.be.false

    fireEvent.click(submitBtn)

    expect(submitBtn.disabled).to.be.true

    await waitForElementToBeRemoved(() =>
      screen.getByRole('button', {
        name: /Loading/i,
      })
    )

    await confirmCodeForEmail(userEmailData.email)
    await screen.findByText(userEmailData.email)
  })

  it('fails to add add new email address', async function () {
    fetchMock.get('/user/emails?ensureAffiliation=true', [])
    render(<EmailsSection />)

    const addAnotherEmailBtn = await screen.findByRole<HTMLButtonElement>(
      'button',
      { name: /add another email/i }
    )

    await fetchMock.callHistory.flush(true)
    resetFetchMock()
    fetchMock
      .get('/user/emails?ensureAffiliation=true', [])
      .post('/user/emails/secondary', 400)

    fireEvent.click(addAnotherEmailBtn)
    const input = screen.getByLabelText(/email/i, { selector: 'input' })

    fireEvent.change(input, {
      target: { value: userEmailData.email },
    })

    const submitBtn = screen.getByRole<HTMLButtonElement>('button', {
      name: /add new email/i,
    })

    expect(submitBtn.disabled).to.be.false

    fireEvent.click(submitBtn)

    expect(submitBtn.disabled).to.be.true

    await screen.findByText(
      /Invalid Request. Please correct the data and try again./i
    )
    expect(submitBtn).to.not.be.null
    expect(submitBtn.disabled).to.be.false
  })

  it('can link email address to an existing SSO institution', async function () {
    fetchMock.get('/user/emails?ensureAffiliation=true', [])
    render(<EmailsSection />)

    const button = await screen.findByRole<HTMLButtonElement>('button', {
      name: /add another email/i,
    })

    await fetchMock.callHistory.flush(true)
    fetchMock.removeRoutes().clearHistory()
    fetchMock.get('express:/institutions/domains', institutionDomainData)

    await userEvent.click(button)

    const input = screen.getByLabelText(/email/i, { selector: 'input' })
    fireEvent.change(input, {
      target: { value: 'user@autocomplete.edu' },
    })

    await screen.findByRole('button', { name: 'Link accounts and add email' })
  })

  it('adds new email address with existing institution and custom departments', async function () {
    const country = 'Germany'
    const customDepartment = 'Custom department'
    fetchMock.get('/user/emails?ensureAffiliation=true', [])
    render(<EmailsSection />)

    const button = await screen.findByRole<HTMLButtonElement>('button', {
      name: /add another email/i,
    })

    await fetchMock.callHistory.flush(true)
    resetFetchMock()

    await userEvent.click(button)

    await userEvent.type(
      screen.getByLabelText(/email/i, { selector: 'input' }),
      userEmailData.email
    )

    await userEvent.click(screen.getByRole('button', { name: /let us know/i }))

    const universityInput = screen.getByRole<HTMLInputElement>('combobox', {
      name: /university/i,
    })

    expect(universityInput.disabled).to.be.true

    fetchMock.get('/institutions/list?country_code=de', [
      {
        id: userEmailData.affiliation.institution.id,
        name: userEmailData.affiliation.institution.name,
        country_code: 'de',
        departments: [customDepartment],
      },
    ])

    // Select the country from dropdown
    await userEvent.type(
      screen.getByRole('combobox', {
        name: /country/i,
      }),
      country
    )
    await userEvent.click(screen.getByText(country))

    expect(universityInput.disabled).to.be.false

    await fetchMock.callHistory.flush(true)
    resetFetchMock()

    // Select the university from dropdown
    await userEvent.click(universityInput)
    await userEvent.click(
      await screen.findByText(userEmailData.affiliation.institution.name)
    )

    const roleInput = screen.getByRole('combobox', { name: /role/i })
    await userEvent.type(roleInput, userEmailData.affiliation.role!)
    const departmentInput = screen.getByRole('combobox', {
      name: /department/i,
    })
    await userEvent.click(departmentInput)
    await userEvent.click(screen.getByText(customDepartment))

    const userEmailDataCopy = {
      ...userEmailData,
      affiliation: {
        ...userEmailData.affiliation,
        department: customDepartment,
      },
    }

    fetchMock
      .get('/user/emails?ensureAffiliation=true', [userEmailDataCopy])
      .post('/user/emails/secondary', 200)
      .post('/user/emails/confirm-secondary', 200)

    await userEvent.click(
      screen.getByRole('button', {
        name: /add new email/i,
      })
    )

    const request = fetchMock.callHistory.calls(/\/user\/emails/).at(0)

    expect(
      JSON.parse(request?.options.body?.toString() || '{}')
    ).to.deep.include({
      email: userEmailData.email,
      university: {
        id: userEmailData.affiliation?.institution.id,
      },
      role: userEmailData.affiliation?.role,
      department: customDepartment,
    })

    await screen.findByText(
      `Enter the 6-digit confirmation code sent to ${userEmailData.email}.`
    )

    await confirmCodeForEmail(userEmailData.email)

    await screen.findByText(userEmailData.affiliation.role!, { exact: false })
    await screen.findByText(customDepartment, { exact: false })
  })

  it('autocompletes institution name', async function () {
    fetchMock.get('/user/emails?ensureAffiliation=true', [])
    render(<EmailsSection />)

    const button = await screen.findByRole<HTMLButtonElement>('button', {
      name: /add another email/i,
    })

    await fetchMock.callHistory.flush(true)
    resetFetchMock()

    fetchMock.get('/institutions/list?country_code=de', [
      {
        id: 1,
        name: 'University of Bonn',
      },
      {
        id: 2,
        name: 'Bochum institute of Science',
      },
    ])

    // open "add new email" section and click "let us know" to open the Country/University form
    await userEvent.click(button)
    await userEvent.type(
      screen.getByLabelText(/email/i, { selector: 'input' }),
      userEmailData.email
    )
    await userEvent.click(screen.getByRole('button', { name: /let us know/i }))

    // select a country
    const countryInput = screen.getByRole<HTMLInputElement>('combobox', {
      name: /country/i,
    })
    await userEvent.click(countryInput)
    await userEvent.type(countryInput, 'Germ')
    await userEvent.click(await screen.findByText('Germany'))

    // match several universities on initial typing
    const universityInput = screen.getByRole<HTMLInputElement>('combobox', {
      name: /university/i,
    })
    await userEvent.click(universityInput)
    await userEvent.type(universityInput, 'bo')
    await screen.findByText('University of Bonn')
    await screen.findByText('Bochum institute of Science')

    // match a single university when typing to refine the search
    await userEvent.type(universityInput, 'nn')
    await screen.findByText('University of Bonn')
    expect(screen.queryByText('Bochum institute of Science')).to.be.null
  })

  it('adds new email address without existing institution', async function () {
    const country = 'Germany'
    const countryCode = 'de'
    const newUniversity = 'Abcdef'
    fetchMock.get('/user/emails?ensureAffiliation=true', [])
    render(<EmailsSection />)

    const button = await screen.findByRole<HTMLButtonElement>('button', {
      name: /add another email/i,
    })

    await fetchMock.callHistory.flush(true)
    resetFetchMock()

    await userEvent.click(button)

    await userEvent.type(
      screen.getByLabelText(/email/i, { selector: 'input' }),
      userEmailData.email
    )

    await userEvent.click(screen.getByRole('button', { name: /let us know/i }))

    const universityInput = screen.getByRole<HTMLInputElement>('combobox', {
      name: /university/i,
    })

    expect(universityInput.disabled).to.be.true

    fetchMock.get(/\/institutions\/list/, [
      {
        id: userEmailData.affiliation.institution.id,
        name: userEmailData.affiliation.institution.name,
        country_code: 'de',
        departments: [],
      },
    ])

    // Select the country from dropdown
    await userEvent.type(
      screen.getByRole('combobox', {
        name: /country/i,
      }),
      country
    )
    await userEvent.click(screen.getByText(country))

    expect(universityInput.disabled).to.be.false

    await fetchMock.callHistory.flush(true)
    resetFetchMock()

    // Enter the university manually
    await userEvent.type(universityInput, newUniversity)

    const roleInput = screen.getByRole('combobox', { name: /role/i })
    await userEvent.type(roleInput, userEmailData.affiliation.role!)
    const departmentInput = screen.getByRole('combobox', {
      name: /department/i,
    })
    await userEvent.type(departmentInput, userEmailData.affiliation.department!)

    const userEmailDataCopy = {
      ...userEmailData,
      affiliation: {
        ...userEmailData.affiliation,
        institution: {
          ...userEmailData.affiliation.institution,
          name: newUniversity,
        },
      },
    }

    fetchMock
      .get('/user/emails?ensureAffiliation=true', [userEmailDataCopy])
      .post('/user/emails/secondary', 200)
      .post('/user/emails/confirm-secondary', 200)

    await userEvent.click(
      screen.getByRole('button', {
        name: /add new email/i,
      })
    )

    await confirmCodeForEmail(userEmailData.email)

    const request = fetchMock.callHistory.calls(/\/user\/emails/).at(0)

    expect(
      JSON.parse(request?.options.body?.toString() || '{}')
    ).to.deep.include({
      email: userEmailData.email,
      university: {
        name: newUniversity,
        country_code: countryCode,
      },
      role: userEmailData.affiliation?.role,
      department: userEmailData.affiliation?.department,
    })

    await screen.findByText(userEmailData.email)
    await screen.findByText(newUniversity)
    await screen.findByText(userEmailData.affiliation.role!, { exact: false })
    await screen.findByText(userEmailData.affiliation.department!, {
      exact: false,
    })
  })

  it('shows country, university, role and department fields based on whether `change` was clicked or not', async function () {
    const institutionDomainDataCopy = [
      {
        ...institutionDomainData[0],
        university: {
          ...institutionDomainData[0].university,
          ssoEnabled: false,
        },
      },
    ]
    const hostnameFirstChar = institutionDomainDataCopy[0].hostname.charAt(0)
    fetchMock.get('/user/emails?ensureAffiliation=true', [])
    render(<EmailsSection />)

    const button = await screen.findByRole<HTMLButtonElement>('button', {
      name: /add another email/i,
    })

    await fetchMock.callHistory.flush(true)
    fetchMock.removeRoutes().clearHistory()
    fetchMock.get(
      `/institutions/domains?hostname=${hostnameFirstChar}&limit=1`,
      institutionDomainDataCopy
    )

    await userEvent.click(button)

    await userEvent.type(
      screen.getByLabelText(/email/i, { selector: 'input' }),
      `user@${hostnameFirstChar}`
    )

    await userEvent.keyboard('{Tab}')
    await fetchMock.callHistory.flush(true)
    fetchMock.removeRoutes().clearHistory()

    expect(
      screen.queryByRole('combobox', {
        name: /country/i,
      })
    ).to.be.null
    expect(
      screen.queryByRole('combobox', {
        name: /university/i,
      })
    ).to.be.null
    screen.getByRole('combobox', {
      name: /role/i,
    })
    screen.getByRole('combobox', {
      name: /department/i,
    })

    await userEvent.click(screen.getByRole('button', { name: /change/i }))

    screen.getByRole('combobox', {
      name: /country/i,
    })
    screen.getByRole('combobox', {
      name: /university/i,
    })
    expect(
      screen.queryByRole('combobox', {
        name: /role/i,
      })
    ).to.be.null
    expect(
      screen.queryByRole('combobox', {
        name: /department/i,
      })
    ).to.be.null
  })

  it('displays institution name with change button when autocompleted and adds new record', async function () {
    const institutionDomainDataCopy = [
      {
        ...institutionDomainData[0],
        university: {
          ...institutionDomainData[0].university,
          ssoEnabled: false,
        },
      },
    ]
    const hostnameFirstChar = institutionDomainDataCopy[0].hostname.charAt(0)
    fetchMock.get('/user/emails?ensureAffiliation=true', [])
    render(<EmailsSection />)

    const button = await screen.findByRole<HTMLButtonElement>('button', {
      name: /add another email/i,
    })

    await fetchMock.callHistory.flush(true)
    fetchMock.removeRoutes().clearHistory()
    fetchMock.get(
      `/institutions/domains?hostname=${hostnameFirstChar}&limit=1`,
      institutionDomainDataCopy
    )

    await userEvent.click(button)

    await userEvent.type(
      screen.getByLabelText(/email/i, { selector: 'input' }),
      `user@${hostnameFirstChar}`
    )

    await userEvent.keyboard('{Tab}')
    await fetchMock.callHistory.flush(true)
    fetchMock.removeRoutes().clearHistory()

    screen.getByText(institutionDomainDataCopy[0].university.name)

    const userEmailDataCopy = {
      ...userEmailData,
      affiliation: {
        ...userEmailData.affiliation,
        institution: {
          ...userEmailData.affiliation.institution,
          name: institutionDomainDataCopy[0].university.name,
        },
      },
    }

    fetchMock
      .get('/user/emails?ensureAffiliation=true', [userEmailDataCopy])
      .post('/user/emails/secondary', 200)
      .post('/user/emails/confirm-secondary', 200)

    await userEvent.type(
      screen.getByRole('combobox', { name: /role/i }),
      userEmailData.affiliation.role!
    )
    await userEvent.type(
      screen.getByRole('combobox', { name: /department/i }),
      userEmailData.affiliation.department!
    )
    await userEvent.click(
      screen.getByRole('button', {
        name: /add new email/i,
      })
    )

    await confirmCodeForEmail('user@autocomplete.edu')

    await fetchMock.callHistory.flush(true)
    fetchMock.removeRoutes().clearHistory()

    screen.getByText(userEmailDataCopy.affiliation.institution.name, {
      exact: false,
    })
    screen.getByText(userEmailDataCopy.affiliation.role!, { exact: false })
    screen.getByText(userEmailDataCopy.affiliation.department!, {
      exact: false,
    })
  })

  describe('when domain is captured by a group', function () {
    describe('and managed users is not enabled', function () {
      beforeEach(async function () {
        await fetchMock.callHistory.flush(true)
        fetchMock.removeRoutes().clearHistory()
        const institution = {
          university: {
            id: 1234,
            ssoEnabled: false,
            name: 'Auto Complete University',
          },
          hostname: 'autocomplete.edu',
          confirmed: true,
          group: {
            domainCaptureEnabled: true,
            ssoConfig: {
              enabled: true,
            },
          },
        }

        fetchMock.get('express:/institutions/domains', [institution])
      })

      it('can add email address via SSO', async function () {
        // note: this UI is a WIP
        fetchMock.get('/user/emails?ensureAffiliation=true', [])
        render(<EmailsSection />)

        const button = await screen.findByRole<HTMLButtonElement>('button', {
          name: /add another email/i,
        })

        await userEvent.click(button)

        const input = screen.getByLabelText(/email/i, { selector: 'input' })
        fireEvent.change(input, {
          target: { value: 'user@autocomplete.edu' },
        })
        await screen.findByText('This feature is currently unavailable.')
      })
    })

    describe('and managed users is enabled', function () {
      beforeEach(async function () {
        await fetchMock.callHistory.flush(true)
        fetchMock.removeRoutes().clearHistory()
        const institution = {
          university: {
            id: 1234,
            ssoEnabled: false,
            name: 'Auto Complete University',
          },
          hostname: 'autocomplete.edu',
          confirmed: true,
          group: {
            domainCaptureEnabled: true,
            managedUsersEnabled: true,
            ssoConfig: {
              enabled: true,
            },
          },
        }

        fetchMock.get('express:/institutions/domains', [institution])
      })

      it('renders error', async function () {
        // note: this UI is a WIP
        fetchMock.get('/user/emails?ensureAffiliation=true', [])
        render(<EmailsSection />)

        const button = await screen.findByRole<HTMLButtonElement>('button', {
          name: /add another email/i,
        })

        await userEvent.click(button)

        const input = screen.getByLabelText(/email/i, { selector: 'input' })
        fireEvent.change(input, {
          target: { value: 'user@autocomplete.edu' },
        })

        const notification = await screen.findByRole('alert')
        within(notification).getByText(
          'Your company email address has been registered under a verified domain, and cannot be added as a secondary email.',
          { exact: false }
        )
      })
    })

    describe('if Commons SSO then enabled, that takes priority over group UI', function () {
      // we shouldn't have SSO config in v1 and in v2 but adding test to ensure Commons takes priority
      beforeEach(async function () {
        await fetchMock.callHistory.flush(true)
        fetchMock.removeRoutes().clearHistory()
        const institution = {
          university: {
            id: 1234,
            ssoEnabled: true,
            name: 'Auto Complete University',
          },
          hostname: 'autocomplete.edu',
          confirmed: true,
          group: {
            domainCaptureEnabled: true,
            ssoConfig: {
              enabled: true,
            },
          },
        }

        fetchMock.get('express:/institutions/domains', [institution])
      })

      it('renders Commons UI', async function () {
        fetchMock.get('/user/emails?ensureAffiliation=true', [])
        render(<EmailsSection />)

        const button = await screen.findByRole<HTMLButtonElement>('button', {
          name: /add another email/i,
        })

        await userEvent.click(button)

        const input = screen.getByLabelText(/email/i, { selector: 'input' })
        fireEvent.change(input, {
          target: { value: 'user@autocomplete.edu' },
        })

        await screen.findByRole('button', {
          name: 'Link accounts and add email',
        })
      })
    })
  })
})
