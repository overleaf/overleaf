import { UserEmailData } from '../../../../../types/user-email'
import { Affiliation } from '../../../../../types/affiliation'

export const confirmedUserData: UserEmailData = {
  confirmedAt: '2022-03-10T10:59:44.139Z',
  email: 'bar@overleaf.com',
  default: false,
}

export const unconfirmedUserData: UserEmailData = {
  email: 'baz@overleaf.com',
  default: false,
}

export const professionalUserData: UserEmailData & {
  affiliation: Affiliation
} = {
  affiliation: {
    cachedConfirmedAt: null,
    cachedEntitlement: null,
    cachedLastDayToReconfirm: null,
    cachedPastReconfirmDate: false,
    cachedReconfirmedAt: null,
    department: 'Art History',
    institution: {
      commonsAccount: false,
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
  confirmedAt: '2022-03-09T10:59:44.139Z',
  email: 'foo@overleaf.com',
  default: true,
}

export const fakeUsersData = [
  { ...confirmedUserData },
  { ...unconfirmedUserData },
  { ...professionalUserData },
]
