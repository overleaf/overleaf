const MOCK_DELAY = 1000

export function defaultSetupMocks(fetchMock) {
  fetchMock.post(/\/user\/settings/, 200, {
    delay: MOCK_DELAY,
  })
}

export function setDefaultMeta() {
  window.metaAttributesCache = window.metaAttributesCache || new Map()
  window.metaAttributesCache.set('ol-user', {
    ...window.metaAttributesCache.get('ol-user'),
    email: 'sherlock@holmes.co.uk',
    first_name: 'Sherlock',
    last_name: 'Holmes',
  })
  window.metaAttributesCache.set('ol-ExposedSettings', {
    ...window.metaAttributesCache.get('ol-ExposedSettings'),
    hasAffiliationsFeature: false,
  })
  window.metaAttributesCache.set('ol-isExternalAuthenticationSystemUsed', false)
  window.metaAttributesCache.set('ol-shouldAllowEditingDetails', true)
}
