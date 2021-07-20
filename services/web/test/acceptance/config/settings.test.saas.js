const { merge } = require('@overleaf/settings/merge')
const baseApp = require('../../../config/settings.overrides.saas')
const baseTest = require('./settings.test.defaults')

const httpAuthUser = 'sharelatex'
const httpAuthPass = 'password'
const httpAuthUsers = {}
httpAuthUsers[httpAuthUser] = httpAuthPass

const overrides = {
  enableSubscriptions: true,

  apis: {
    project_history: {
      sendProjectStructureOps: true,
      initializeHistoryForNewProjects: true,
      displayHistoryForNewProjects: true,
      url: `http://localhost:3054`,
    },

    recurly: {
      url: 'http://localhost:6034',
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
      url: 'http://localhost:5000',
      user: 'overleaf',
      pass: 'password',
    },

    v1_history: {
      url: `http://localhost:3100/api`,
      user: 'overleaf',
      pass: 'password',
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

  overleaf: {
    oauth: undefined,
  },
  saml: undefined,

  // Disable contentful module.
  contentful: undefined,
}

module.exports = baseApp.mergeWith(baseTest.mergeWith(overrides))

for (const redisKey of Object.keys(module.exports.redis)) {
  module.exports.redis[redisKey].host = process.env.REDIS_HOST || 'localhost'
}

module.exports.mergeWith = function (overrides) {
  return merge(overrides, module.exports)
}
