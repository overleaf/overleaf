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

export const untrustedUserData = {
  ...confirmedUserData,
  lastConfirmedAt: '2024-01-01T10:59:44.139Z',
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
  confirmedAt: '2022-03-09T10:59:44.139Z',
  email: 'foo@overleaf.com',
  default: true,
}

export const unconfirmedCommonsUserData: UserEmailData & {
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
      commonsAccount: true,
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
    licence: 'free',
    pastReconfirmDate: false,
    portal: { slug: '', templates_count: 1 },
    role: 'Reader',
  },
  email: 'qux@overleaf.com',
  default: true,
}

export const ssoUserData: UserEmailData = {
  affiliation: {
    cachedConfirmedAt: '2022-02-03T11:46:28.249Z',
    cachedEntitlement: null,
    cachedLastDayToReconfirm: null,
    cachedPastReconfirmDate: false,
    cachedReconfirmedAt: null,
    department: 'Art History',
    institution: {
      commonsAccount: true,
      writefullCommonsAccount: false,
      confirmed: true,
      id: 2,
      isUniversity: true,
      maxConfirmationMonths: 12,
      name: 'SSO University',
      ssoEnabled: true,
      ssoBeta: false,
    },
    inReconfirmNotificationPeriod: false,
    inferred: false,
    licence: 'pro_plus',
    pastReconfirmDate: false,
    portal: { slug: '', templates_count: 0 },
    role: 'Prof',
  },
  confirmedAt: '2022-02-03T11:46:28.249Z',
  email: 'sso-prof@sso-university.edu',
  samlProviderId: 'sso-prof-saml-id',
  default: false,
}

export const fakeUsersData = [
  { ...confirmedUserData },
  { ...unconfirmedUserData },
  { ...untrustedUserData },
  { ...professionalUserData },
  { ...unconfirmedCommonsUserData },
]
