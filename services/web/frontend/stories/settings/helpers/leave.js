const MOCK_DELAY = 1000

export function defaultSetupMocks(fetchMock) {
  fetchMock.post(/\/user\/delete/, 200, {
    delay: MOCK_DELAY,
  })
}

export function setDefaultMeta() {
  window.metaAttributesCache = window.metaAttributesCache || new Map()
  window.metaAttributesCache.set('ol-usersEmail', 'user@primary.com')
  window.metaAttributesCache.set('ol-ExposedSettings', {
    ...window.metaAttributesCache.get('ol-ExposedSettings'),
    isOverleaf: true,
  })
  window.metaAttributesCache.set('ol-hasPassword', true)
}
