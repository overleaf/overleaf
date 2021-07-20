const base = require('../../../config/settings.overrides.saas')

let features
const v1Api = {
  url: 'http://localhost:5000',
  user: 'overleaf',
  pass: 'password',
}

const httpAuthUser = 'sharelatex'
const httpAuthPass = 'password'
const httpAuthUsers = {}
httpAuthUsers[httpAuthUser] = httpAuthPass

module.exports = base.mergeWith({
  catchErrors: false,
  clsiCookie: undefined,

  cacheStaticAssets: true,
  enableSubscriptions: true,

  httpAuthUsers,
  secureCookie: false,
  security: {
    sessionSecret: 'static-secret-for-tests',
  },
  adminDomains: ['example.com'],

  apis: {
    web: {
      user: httpAuthUser,
      pass: httpAuthPass,
    },
    v1: {
      url: v1Api.url,
      user: v1Api.user,
      pass: v1Api.pass,
    },
    recurly: {
      // Set up our own mock recurly server
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
  },

  // for registration via SL, set enableLegacyRegistration to true
  // for registration via Overleaf v1, set enableLegacyLogin to true

  // Currently, acceptance tests require enableLegacyRegistration.
  enableLegacyRegistration: true,

  features: (features = {
    v1_free: {
      collaborators: 1,
      dropbox: false,
      versioning: false,
      github: true,
      gitBridge: true,
      templates: false,
      references: false,
      referencesSearch: false,
      mendeley: true,
      zotero: true,
      compileTimeout: 60,
      compileGroup: 'standard',
      trackChanges: false,
    },
    personal: {
      collaborators: 1,
      dropbox: false,
      versioning: false,
      github: false,
      gitBridge: false,
      templates: false,
      references: false,
      referencesSearch: false,
      mendeley: false,
      zotero: false,
      compileTimeout: 60,
      compileGroup: 'standard',
      trackChanges: false,
    },
    collaborator: {
      collaborators: 10,
      dropbox: true,
      versioning: true,
      github: true,
      gitBridge: true,
      templates: true,
      references: true,
      referencesSearch: true,
      mendeley: true,
      zotero: true,
      compileTimeout: 180,
      compileGroup: 'priority',
      trackChanges: true,
    },
    professional: {
      collaborators: -1,
      dropbox: true,
      versioning: true,
      github: true,
      gitBridge: true,
      templates: true,
      references: true,
      referencesSearch: true,
      mendeley: true,
      zotero: true,
      compileTimeout: 180,
      compileGroup: 'priority',
      trackChanges: true,
    },
  }),

  defaultFeatures: features.personal,
  defaultPlanCode: 'personal',
  institutionPlanCode: 'professional',

  plans: [
    {
      planCode: 'v1_free',
      name: 'V1 Free',
      price: 0,
      features: features.v1_free,
    },
    {
      planCode: 'personal',
      name: 'Personal',
      price: 0,
      features: features.personal,
    },
    {
      planCode: 'collaborator',
      name: 'Collaborator',
      price: 1500,
      features: features.collaborator,
    },
    {
      planCode: 'professional',
      name: 'Professional',
      price: 3000,
      features: features.professional,
    },
  ],

  bonus_features: {
    1: {
      collaborators: 2,
      dropbox: false,
      versioning: false,
    },
    3: {
      collaborators: 4,
      dropbox: false,
      versioning: false,
    },
    6: {
      collaborators: 4,
      dropbox: true,
      versioning: true,
    },
    9: {
      collaborators: -1,
      dropbox: true,
      versioning: true,
    },
  },

  proxyUrls: {
    '/institutions/list': { baseUrl: v1Api.url, path: '/universities/list' },
    '/institutions/list/:id': {
      baseUrl: v1Api.url,
      path(params) {
        return `/universities/list/${params.id}`
      },
    },
    '/institutions/domains': {
      baseUrl: v1Api.url,
      path: '/university/domains',
    },
    '/proxy/missing/baseUrl': { path: '/foo/bar' },
    '/proxy/get_and_post': {
      methods: ['get', 'post'],
      path: '/destination/get_and_post',
    },
  },

  redirects: {
    '/redirect/one': '/destination/one',
    '/redirect/get_and_post': {
      methods: ['get', 'post'],
      url: '/destination/get_and_post',
    },
    '/redirect/base_url': {
      baseUrl: 'https://example.com',
      url: '/destination/base_url',
    },
    '/redirect/params/:id': {
      url(params) {
        return `/destination/${params.id}/params`
      },
    },
    '/redirect/qs': '/destination/qs',
    '/docs_v1': {
      url: '/docs',
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

  // for testing /user/bonus
  social: {
    twitter: {
      handle: 'overleaf',
    },

    facebook: {
      appId: '400474170024644',
      picture: 'https://www.overleaf.com/img/ol-brand/logo-horizontal.png',
      redirectUri: 'https://www.overleaf.com',
    },
  },

  overleaf: {
    oauth: undefined,
  },
  saml: undefined,

  reconfirmNotificationDays: 14,

  unsupportedBrowsers: {
    ie: '<=11',
  },

  // Disable contentful module.
  contentful: undefined,

  // No email in tests
  email: undefined,

  test: {
    counterInit: 0,
  },
})

for (const redisKey of Object.keys(base.redis)) {
  base.redis[redisKey].host = process.env.REDIS_HOST || 'localhost'
}
