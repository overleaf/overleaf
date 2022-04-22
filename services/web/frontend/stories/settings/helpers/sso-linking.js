const MOCK_DELAY = 1000

export function defaultSetupMocks(fetchMock) {
  fetchMock.post('/user/oauth-unlink', 200, { delay: MOCK_DELAY })
}

export function setDefaultMeta() {
  window.metaAttributesCache.set('ol-thirdPartyIds', {
    collabratec: 'collabratec-id',
    google: 'google-id',
    twitter: 'twitter-id',
  })

  window.metaAttributesCache.set('ol-oauthProviders', {
    collabratec: {
      descriptionKey: 'linked_collabratec_description',
      descriptionOptions: { appName: 'Overleaf' },
      name: 'IEEE Collabratec®',
      hideWhenNotLinked: true,
      linkPath: '/collabratec/auth/link',
    },
    google: {
      descriptionKey: 'login_with_service',
      descriptionOptions: { service: 'Google' },
      name: 'Google',
      linkPath: '/auth/google',
    },
    orcid: {
      descriptionKey: 'oauth_orcid_description',
      descriptionOptions: {
        link: '/blog/434',
        appName: 'Overleaf',
      },
      name: 'Orcid',
      linkPath: '/auth/orcid',
    },
    twitter: {
      hideWhenNotLinked: true,
      name: 'Twitter',
      linkPath: '/auth/twitter',
    },
  })
}
