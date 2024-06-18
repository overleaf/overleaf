import getMeta from '@/utils/meta'

const MOCK_DELAY = 1000

export function defaultSetupMocks(fetchMock) {
  fetchMock.post(/\/user\/delete/, 200, {
    delay: MOCK_DELAY,
  })
}

export function setDefaultMeta() {
  window.metaAttributesCache.set('ol-usersEmail', 'user@primary.com')
  Object.assign(getMeta('ol-ExposedSettings'), {
    isOverleaf: true,
  })
  window.metaAttributesCache.set('ol-hasPassword', true)
}
