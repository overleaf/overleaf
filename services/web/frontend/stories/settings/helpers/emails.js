import getMeta from '@/utils/meta'

const MOCK_DELAY = 1000

const fakeUsersData = [
  {
    affiliation: {
      institution: {
        confirmed: true,
        id: 1,
        name: 'Overleaf',
      },
      licence: 'pro_plus',
    },
    confirmedAt: '2022-03-09T10:59:44.139Z',
    email: 'foo@overleaf.com',
    default: true,
    emailHasInstitutionLicence: true,
  },
  {
    confirmedAt: '2022-03-10T10:59:44.139Z',
    email: 'bar@overleaf.com',
    default: false,
  },
  {
    affiliation: {
      institution: {
        confirmed: true,
        id: 2,
        name: 'Overleaf',
      },
      licence: 'pro_plus',
      department: 'Art & Art History',
      role: 'Postdoc',
    },
    email: 'baz@overleaf.com',
    default: false,
  },
  {
    email: 'qux@overleaf.com',
    default: false,
  },
]
const fakeReconfirmationUsersData = [
  {
    affiliation: {
      institution: {
        confirmed: true,
        isUniversity: true,
        id: 4,
        name: 'Reconfirmable Email Highlighted',
      },
      licence: 'pro_plus',
      inReconfirmNotificationPeriod: true,
    },
    email: 'reconfirmation-highlighted@overleaf.com',
    confirmedAt: '2022-03-09T10:59:44.139Z',
    default: false,
  },
  {
    affiliation: {
      institution: {
        confirmed: true,
        isUniversity: true,
        id: 4,
        name: 'Reconfirmable Emails Primary',
      },
      licence: 'pro_plus',
      inReconfirmNotificationPeriod: true,
    },
    email: 'reconfirmation-nonsso@overleaf.com',
    confirmedAt: '2022-03-09T10:59:44.139Z',
    default: true,
  },
  {
    affiliation: {
      institution: {
        confirmed: true,
        ssoEnabled: true,
        isUniversity: true,
        id: 3,
        name: 'Reconfirmable SSO',
      },
      licence: 'pro_plus',
      inReconfirmNotificationPeriod: true,
    },
    email: 'reconfirmation-sso@overleaf.com',
    confirmedAt: '2022-03-09T10:59:44.139Z',
    samlProviderId: 'reconfirmation-sso-provider-id',
    default: false,
  },
  {
    affiliation: {
      institution: {
        confirmed: true,
        isUniversity: true,
        ssoEnabled: true,
        id: 5,
        name: 'Reconfirmed SSO',
      },
      licence: 'pro_plus',
    },
    confirmedAt: '2022-03-09T10:59:44.139Z',
    email: 'sso@overleaf.com',
    samlProviderId: 'sso-reconfirmed-provider-id',
    default: false,
  },
]

const fakeInstitutions = [
  {
    id: 9326,
    name: 'Unknown',
    country_code: 'al',
    departments: ['New department'],
  },
]
const fakeInstitution = {
  id: 123,
  name: 'test',
  country_code: 'de',
  departments: [],
  team_id: null,
}
const bazFakeInstitution = {
  id: 2,
  name: 'Baz',
  country_code: 'de',
  departments: ['Custom department 1', 'Custom department 2'],
  team_id: null,
}

const fakeInstitutionDomain1 = [
  {
    university: {
      id: 1234,
      ssoEnabled: true,
      name: 'Auto Complete University',
    },
    hostname: 'autocomplete.edu',
    confirmed: true,
  },
]

const fakeInstitutionDomain2 = [
  {
    university: {
      id: 5678,
      ssoEnabled: false,
      name: 'Fake Auto Complete University',
    },
    hostname: 'fake-autocomplete.edu',
    confirmed: true,
  },
]

export function defaultSetupMocks(fetchMock) {
  fetchMock
    .get(/\/user\/emails/, fakeUsersData, { delay: MOCK_DELAY })
    .get(/\/institutions\/list\/2/, bazFakeInstitution, { delay: MOCK_DELAY })
    .get(/\/institutions\/list\/\d+/, fakeInstitution, { delay: MOCK_DELAY })
    .get(/\/institutions\/list\?country_code=.*/, fakeInstitutions, {
      delay: MOCK_DELAY,
    })
    .get(/\/institutions\/domains\?hostname=a/, fakeInstitutionDomain1)
    .get(/\/institutions\/domains\?hostname=f/, fakeInstitutionDomain2)
    .get(/\/institutions\/domains/, [])
    .post(/\/user\/emails\/*/, 200, {
      delay: MOCK_DELAY,
    })
}

export function reconfirmationSetupMocks(fetchMock) {
  defaultSetupMocks(fetchMock)
  fetchMock.get(/\/user\/emails/, fakeReconfirmationUsersData, {
    delay: MOCK_DELAY,
  })
}

export function emailLimitSetupMocks(fetchMock) {
  const userData = []
  for (let i = 0; i < 10; i++) {
    userData.push({ email: `example${i}@overleaf.com` })
  }
  defaultSetupMocks(fetchMock)
  fetchMock.get(/\/user\/emails/, userData, {
    delay: MOCK_DELAY,
  })
}

export function errorsMocks(fetchMock) {
  fetchMock
    .get(/\/user\/emails/, fakeUsersData, { delay: MOCK_DELAY })
    .post(/\/user\/emails\/*/, 500)
}

export function setDefaultMeta() {
  Object.assign(getMeta('ol-ExposedSettings'), {
    hasAffiliationsFeature: true,
    hasSamlFeature: true,
    samlInitPath: 'saml/init',
  })
}

export function setReconfirmationMeta() {
  setDefaultMeta()
  window.metaAttributesCache.set(
    'ol-reconfirmationRemoveEmail',
    'reconfirmation-highlighted@overleaf.com'
  )
  window.metaAttributesCache.set(
    'ol-reconfirmedViaSAML',
    'sso-reconfirmed-provider-id'
  )
}
