import {
  render,
  screen,
  fireEvent,
  waitForElementToBeRemoved,
} from '@testing-library/react'
import { expect } from 'chai'
import { UserEmailData } from '../../../../../../types/user-email'
import fetchMock from 'fetch-mock'
import InstitutionAndRole from '../../../../../../frontend/js/features/settings/components/emails/institution-and-role'
import { UserEmailsProvider } from '../../../../../../frontend/js/features/settings/context/user-email-context'
import EmailsSection from '../../../../../../frontend/js/features/settings/components/emails-section'
import { Affiliation } from '../../../../../../types/affiliation'
import getMeta from '@/utils/meta'

const userData1: UserEmailData & { affiliation: Affiliation } = {
  affiliation: {
    cachedConfirmedAt: null,
    cachedEntitlement: null,
    cachedLastDayToReconfirm: null,
    cachedPastReconfirmDate: false,
    cachedReconfirmedAt: null,
    department: null,
    institution: {
      commonsAccount: false,
      writefullCommonsAccount: false,
      confirmed: true,
      id: 1,
      isUniversity: false,
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
    role: null,
  },
  confirmedAt: '2022-03-09T10:59:44.139Z',
  email: 'foo@overleaf.com',
  default: true,
}

const userData2: UserEmailData & { affiliation: Affiliation } = {
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
      isUniversity: false,
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

describe('user role and institution', function () {
  beforeEach(function () {
    Object.assign(getMeta('ol-ExposedSettings'), {
      hasAffiliationsFeature: true,
    })
    fetchMock.reset()
    fetchMock.get('/user/emails?ensureAffiliation=true', [])
  })

  afterEach(function () {
    fetchMock.reset()
  })

  it('renders affiliation name with add role/department button', function () {
    const userEmailData = userData1
    render(
      <UserEmailsProvider>
        <InstitutionAndRole userEmailData={userEmailData} />
      </UserEmailsProvider>
    )

    screen.getByText(userEmailData.affiliation.institution.name, {
      exact: false,
    })
    screen.getByRole('button', { name: /add role and department/i })
    expect(screen.queryByRole('button', { name: /change/i })).to.not.exist
  })

  it('renders affiliation name, role and department with change button', function () {
    const userEmailData = userData2
    render(
      <UserEmailsProvider>
        <InstitutionAndRole userEmailData={userEmailData} />
      </UserEmailsProvider>
    )

    screen.getByText(userEmailData.affiliation.institution.name, {
      exact: false,
    })
    screen.getByText(userEmailData.affiliation.department!, { exact: false })
    screen.getByText(userEmailData.affiliation.role!, { exact: false })
    screen.getByRole('button', { name: /change/i })
    expect(screen.queryByRole('button', { name: /add role and department/i }))
      .to.not.exist
  })

  it('fetches institution data and replaces departments dropdown on add/change', async function () {
    const userEmailData = userData1
    fetchMock.get('/user/emails?ensureAffiliation=true', [userEmailData], {
      overwriteRoutes: true,
    })
    render(<EmailsSection />)

    await fetchMock.flush(true)
    fetchMock.reset()

    const fakeDepartment = 'Fake department'
    const institution = userEmailData.affiliation.institution
    fetchMock.get(`/institutions/list/${institution.id}`, {
      id: institution.id,
      name: institution.name,
      country_code: 'de',
      departments: [fakeDepartment],
    })

    fireEvent.click(
      screen.getByRole('button', { name: /add role and department/i })
    )

    await fetchMock.flush(true)
    fetchMock.reset()

    fireEvent.click(screen.getByRole('textbox', { name: /department/i }))

    screen.getByText(fakeDepartment)
  })

  it('adds new role and department', async function () {
    fetchMock
      .get('/user/emails?ensureAffiliation=true', [userData1], {
        overwriteRoutes: true,
      })
      .get(/\/institutions\/list/, { departments: [] })
      .post('/user/emails/endorse', 200)
    render(<EmailsSection />)

    const addBtn = await screen.findByRole('button', {
      name: /add role and department/i,
    })
    fireEvent.click(addBtn)

    const submitBtn = screen.getByRole('button', {
      name: /save/i,
    }) as HTMLButtonElement
    expect(submitBtn.disabled).to.be.true

    const roleValue = 'Dummy role'
    const departmentValue = 'Dummy department'

    const roleInput = screen.getByPlaceholderText(/role/i)
    fireEvent.change(roleInput, {
      target: { value: roleValue },
    })

    expect(submitBtn.disabled).to.be.true

    const departmentInput = screen.getByPlaceholderText(/department/i)
    fireEvent.change(departmentInput, {
      target: { value: departmentValue },
    })

    expect(submitBtn.disabled).to.be.false

    fireEvent.click(submitBtn)

    expect(submitBtn.disabled).to.be.true

    await waitForElementToBeRemoved(() =>
      screen.getByRole('button', { name: /saving/i })
    )

    screen.getByText(roleValue, { exact: false })
    screen.getByText(departmentValue, { exact: false })
  })
})
