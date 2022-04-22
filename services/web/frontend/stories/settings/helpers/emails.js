const MOCK_DELAY = 1000

const fakeUsersData = [
  {
    affiliation: {
      institution: {
        confirmed: true,
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

export function defaultSetupMocks(fetchMock) {
  fetchMock
    .get(/\/user\/emails/, fakeUsersData, { delay: MOCK_DELAY })
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
    hasAffiliationsFeature: true,
  })
}
