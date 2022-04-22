const MOCK_DELAY = 1000

export function defaultSetupMocks(fetchMock) {
  fetchMock.get(
    'express:/user/tpds/queues',
    { tpdsToWeb: 0, webToTpds: 0 },
    { delay: MOCK_DELAY }
  )
}

export function setDefaultMeta() {
  window.metaAttributesCache.set('ol-user', {
    features: { github: true, dropbox: true, mendeley: false, zotero: false },
    refProviders: {
      mendeley: true,
      zotero: true,
    },
  })
  window.metaAttributesCache.set('ol-github', { enabled: false })
  window.metaAttributesCache.set('ol-dropbox', { registered: true })
}
