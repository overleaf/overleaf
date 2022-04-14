import { render, screen } from '@testing-library/react'
import { expect } from 'chai'
import { UserEmailData } from '../../../../../../types/user-email'
import InstitutionAndRole from '../../../../../../frontend/js/features/settings/components/emails/institution-and-role'

const userData1: UserEmailData = {
  affiliation: {
    cachedConfirmedAt: null,
    cachedPastReconfirmDate: false,
    cachedReconfirmedAt: null,
    department: null,
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
    role: null,
  },
  confirmedAt: '2022-03-09T10:59:44.139Z',
  email: 'foo@overleaf.com',
  default: true,
}

const userData2: UserEmailData = {
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

describe('user role and institution', function () {
  it('renders affiliation name with add role/department button', function () {
    const userEmailData = userData1
    render(<InstitutionAndRole userEmailData={userEmailData} />)

    screen.getByText(userEmailData.affiliation.institution.name, {
      exact: false,
    })
    screen.getByRole('button', { name: /add role and department/i })
    expect(screen.queryByRole('button', { name: /change/i })).to.not.exist
  })

  it('renders affiliation name, role and department with change button', function () {
    const userEmailData = userData2
    render(<InstitutionAndRole userEmailData={userEmailData} />)

    screen.getByText(userEmailData.affiliation.institution.name, {
      exact: false,
    })
    screen.getByText(userEmailData.affiliation.department, { exact: false })
    screen.getByText(userEmailData.affiliation.role, { exact: false })
    screen.getByRole('button', { name: /change/i })
    expect(screen.queryByRole('button', { name: /add role and department/i }))
      .to.not.exist
  })
})
