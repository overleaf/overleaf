const { merge } = require('@overleaf/settings/merge')
const baseApp = require('../../../config/settings.overrides.saas')
const baseTest = require('./settings.test.defaults')

const httpAuthUser = 'overleaf'
const httpAuthPass = 'password'
const httpAuthUsers = {}
httpAuthUsers[httpAuthUser] = httpAuthPass

const overleafHost =
  process.env.V2_URL ||
  `http://${process.env.HTTP_TEST_HOST || '127.0.0.1'}:23000`

const overrides = {
  appName: 'Overleaf',
  siteUrl: overleafHost,

  enableSubscriptions: true,

  apis: {
    thirdPartyDataStore: {
      url: `http://127.0.0.1:23002`,
      dropboxApp: 'Overleaf',
    },
    analytics: {
      url: `http://127.0.0.1:23050`,
    },
    recurly: {
      url: 'http://127.0.0.1:26034',
      subdomain: 'test',
      apiKey: 'private-nonsense',
      webhookUser: 'recurly',
      webhookPass: 'webhook',
    },

    tpdsworker: {
      // Disable tpdsworker in CI.
      url: undefined,
    },

    v1: {
      url: `http://127.0.0.1:25000`,
      user: 'overleaf',
      pass: 'password',
    },
    tags: {
      url: 'http://127.0.0.1:25000',
    },
  },

  oauthProviders: {
    provider: {
      name: 'provider',
    },
    collabratec: {
      name: 'collabratec',
    },
    google: {
      name: 'google',
    },
  },

  saml: undefined,

  contentful: {
    spaceId: 'a',
    deliveryToken: 'b',
    previewToken: 'c',
    deliveryApiHost: 'cdn.contentful.com',
    previewApiHost: 'preview.contentful.com',
  },

  twoFactorAuthentication: {
    accessTokenEncryptorOptions: {
      cipherPasswords: {
        '2023.1-v3': 'this-is-a-weak-secret-for-tests-web-2023.1-v3',
      },
    },
  },

  overleaf: {
    host: 'http://127.0.0.1:25000',
    oauth: {
      clientID: 'mock-oauth-client-id',
      clientSecret: 'mock-oauth-client-secret',
    },
  },

  analytics: {
    enabled: true,
  },
}

module.exports = baseApp.mergeWith(baseTest.mergeWith(overrides))

for (const redisKey of Object.keys(module.exports.redis)) {
  module.exports.redis[redisKey].host = process.env.REDIS_HOST || '127.0.0.1'
}

module.exports.mergeWith = function (overrides) {
  return merge(overrides, module.exports)
}
