const { merge } = require('@overleaf/settings/merge')

let features

const httpAuthUser = 'sharelatex'
const httpAuthPass = 'password'
const httpAuthUsers = {}
httpAuthUsers[httpAuthUser] = httpAuthPass

module.exports = {
  catchErrors: false,
  clsiCookie: undefined,

  cacheStaticAssets: true,

  httpAuthUsers,
  secureCookie: false,
  security: {
    sessionSecret: 'static-secret-for-tests',
  },
  adminDomains: process.env.ADMIN_DOMAINS
    ? JSON.parse(process.env.ADMIN_DOMAINS)
    : ['example.com'],

  statusPageUrl: 'status.example.com',
  cdn: {
    web: {
      host: 'cdn.example.com',
    },
  },

  apis: {
    linkedUrlProxy: {
      url: process.env.LINKED_URL_PROXY,
    },

    web: {
      url: 'http://localhost:23000',
      user: httpAuthUser,
      pass: httpAuthPass,
    },

    haveIBeenPwned: {
      enabled: false,
      url: 'http://localhost:1337',
    },
    documentupdater: {
      url: 'http://localhost:23003',
    },
    spelling: {
      url: 'http://localhost:23005',
      host: 'localhost',
    },
    trackchanges: {
      url: 'http://localhost:23015',
    },
    docstore: {
      url: 'http://localhost:23016',
      pubUrl: 'http://localhost:23016',
    },
    chat: {
      internal_url: 'http://localhost:23010',
    },
    filestore: {
      url: 'http://localhost:23009',
    },
    clsi: {
      url: 'http://localhost:23013',
    },
    realTime: {
      url: 'http://localhost:23026',
    },
    contacts: {
      url: 'http://localhost:23036',
    },
    notifications: {
      url: 'http://localhost:23042',
    },
    project_history: {
      sendProjectStructureOps: true,
      initializeHistoryForNewProjects: true,
      displayHistoryForNewProjects: true,
      url: `http://localhost:23054`,
    },
    v1_history: {
      url: `http://localhost:23100/api`,
      user: 'overleaf',
      pass: 'password',
    },
    webpack: {
      url: 'http://localhost:23808',
    },
    gitBridge: {
      url: 'http://localhost:28000',
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
      symbolPalette: false,
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
      symbolPalette: false,
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
      symbolPalette: true,
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
      symbolPalette: true,
    },
  }),

  defaultFeatures: features.personal,
  defaultPlanCode: 'personal',
  institutionPlanCode: 'professional',

  plans: [
    {
      planCode: 'v1_free',
      name: 'V1 Free',
      price_in_cents: 0,
      features: features.v1_free,
    },
    {
      planCode: 'personal',
      name: 'Personal',
      price_in_cents: 0,
      features: features.personal,
    },
    {
      planCode: 'collaborator',
      name: 'Collaborator',
      price_in_cents: 1500,
      features: features.collaborator,
    },
    {
      planCode: 'professional',
      name: 'Professional',
      price_in_cents: 3000,
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

  reconfirmNotificationDays: 14,

  unsupportedBrowsers: {
    ie: '<=11',
  },

  recaptcha: {
    siteKey: 'siteKey',
    disabled: {
      invite: true,
      login: false,
      passwordReset: true,
      register: true,
    },
  },

  // No email in tests
  email: undefined,

  test: {
    counterInit: 0,
  },
}

module.exports.mergeWith = function (overrides) {
  return merge(overrides, module.exports)
}
