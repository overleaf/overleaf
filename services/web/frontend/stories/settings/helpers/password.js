import getMeta from '@/utils/meta'

const MOCK_DELAY = 1000

export function defaultSetupMocks(fetchMock) {
  fetchMock.post(
    /\/user\/password\/update/,
    {
      status: 200,
      body: {
        message: {
          type: 'success',
          email: 'tim.alby@overleaf.com',
          text: 'Password changed',
        },
      },
    },
    {
      delay: MOCK_DELAY,
    }
  )
}

export function setDefaultMeta() {
  Object.assign(getMeta('ol-ExposedSettings'), {
    isOverleaf: true,
  })
  window.metaAttributesCache.set('ol-isExternalAuthenticationSystemUsed', false)
  window.metaAttributesCache.set('ol-hasPassword', true)
  window.metaAttributesCache.set('ol-passwordStrengthOptions', {
    length: {
      min: 2,
    },
  })
}
