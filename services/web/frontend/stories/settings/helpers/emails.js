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

const fakeInstitutionDomain = [
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

export function defaultSetupMocks(fetchMock) {
  fetchMock
    .get(/\/user\/emails/, fakeUsersData, { delay: MOCK_DELAY })
    .get(/\/institutions\/list\/2/, bazFakeInstitution, { delay: MOCK_DELAY })
    .get(/\/institutions\/list\/\d+/, fakeInstitution, { delay: MOCK_DELAY })
    .get(/\/institutions\/list\?country_code=.*/, fakeInstitutions, {
      delay: MOCK_DELAY,
    })
    .get(/\/institutions\/domains/, fakeInstitutionDomain)
    .post(/\/user\/emails\/*/, 200, {
      delay: MOCK_DELAY,
    })
}

export function errorsMocks(fetchMock) {
  fetchMock
    .get(/\/user\/emails/, fakeUsersData, { delay: MOCK_DELAY })
    .post(/\/user\/emails\/*/, 500)
}

export function setDefaultMeta() {
  window.metaAttributesCache = window.metaAttributesCache || new Map()
  window.metaAttributesCache.set('ol-ExposedSettings', {
    ...window.metaAttributesCache.get('ol-ExposedSettings'),
    hasAffiliationsFeature: true,
    hasSamlFeature: true,
    samlInitPath: 'saml/init',
  })
}
