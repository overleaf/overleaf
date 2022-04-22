const MOCK_DELAY = 1000

export function defaultSetupMocks(fetchMock) {
  fetchMock.post(/\/user\/settings/, 200, {
    delay: MOCK_DELAY,
  })
}

export function setDefaultMeta() {
  window.metaAttributesCache = window.metaAttributesCache || new Map()
  window.metaAttributesCache.set('ol-usersEmail', 'sherlock@holmes.co.uk')
  window.metaAttributesCache.set('ol-firstName', 'Sherlock')
  window.metaAttributesCache.set('ol-lastName', 'Holmes')
  window.metaAttributesCache.set('ol-ExposedSettings', {
    hasAffiliationsFeature: false,
  })
  window.metaAttributesCache.set('ol-isExternalAuthenticationSystemUsed', false)
  window.metaAttributesCache.set('ol-shouldAllowEditingDetails', true)
}
