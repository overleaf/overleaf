const { merge } = require('@overleaf/settings/merge')

let features

const httpAuthUser = 'overleaf'
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
    sessionSecretUpcoming: 'static-secret-upcoming-for-tests',
    sessionSecretFallback: 'static-secret-fallback-for-tests',
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

  mongo: {
    options: {
      family: 4,
    },
  },

  apis: {
    linkedUrlProxy: {
      url: process.env.LINKED_URL_PROXY,
    },

    web: {
      url: 'http://127.0.0.1:23000',
      user: httpAuthUser,
      pass: httpAuthPass,
    },

    haveIBeenPwned: {
      enabled: false,
      url: 'http://127.0.0.1:1337',
    },
    documentupdater: {
      url: 'http://127.0.0.1:23003',
    },
    docstore: {
      url: 'http://127.0.0.1:23016',
      pubUrl: 'http://127.0.0.1:23016',
    },
    chat: {
      internal_url: 'http://127.0.0.1:23010',
    },
    filestore: {
      url: 'http://127.0.0.1:23009',
    },
    clsi: {
      url: 'http://127.0.0.1:23013',
    },
    realTime: {
      url: 'http://127.0.0.1:23026',
    },
    contacts: {
      url: 'http://127.0.0.1:23036',
    },
    notifications: {
      url: 'http://127.0.0.1:23042',
    },
    project_history: {
      sendProjectStructureOps: true,
      url: `http://127.0.0.1:23054`,
    },
    v1_history: {
      url: `http://127.0.0.1:23100/api`,
      user: 'overleaf',
      pass: 'password',
    },
    historyBackupDeletion: {
      url: `http://127.0.0.1:23101`,
      user: 'overleaf',
      pass: 'password',
    },
    webpack: {
      url: 'http://127.0.0.1:23808',
    },
    gitBridge: {
      url: 'http://127.0.0.1:28000',
    },
  },

  features: (features = {
    v1_free: {
      collaborators: 1,
      dropbox: false,
      versioning: false,
      github: true,
      gitBridge: true,
      references: false,
      referencesSearch: false,
      mendeley: true,
      papers: true,
      zotero: true,
      compileTimeout: 60,
      compileGroup: 'standard',
      trackChanges: false,
      symbolPalette: false,
      aiErrorAssistant: false,
    },
    personal: {
      collaborators: 1,
      dropbox: false,
      versioning: false,
      github: false,
      gitBridge: false,
      references: false,
      referencesSearch: false,
      mendeley: false,
      papers: false,
      zotero: false,
      compileTimeout: 60,
      compileGroup: 'standard',
      trackChanges: false,
      symbolPalette: false,
      aiErrorAssistant: false,
    },
    collaborator: {
      collaborators: 10,
      dropbox: true,
      versioning: true,
      github: true,
      gitBridge: true,
      references: true,
      referencesSearch: true,
      mendeley: true,
      papers: true,
      zotero: true,
      compileTimeout: 180,
      compileGroup: 'priority',
      trackChanges: true,
      symbolPalette: true,
      aiErrorAssistant: false,
    },
    professional: {
      collaborators: -1,
      dropbox: true,
      versioning: true,
      github: true,
      gitBridge: true,
      references: true,
      referencesSearch: true,
      mendeley: true,
      papers: true,
      zotero: true,
      compileTimeout: 180,
      compileGroup: 'priority',
      trackChanges: true,
      symbolPalette: true,
      aiErrorAssistant: false,
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

  recaptcha: {
    siteKey: 'siteKey',
    disabled: {
      invite: true,
      login: false,
      passwordReset: true,
      register: true,
      addEmail: true,
    },
  },

  // No email in tests
  email: undefined,

  test: {
    counterInit: 0,
  },

  devToolbar: {
    enabled: false,
  },
}

module.exports.mergeWith = function (overrides) {
  return merge(overrides, module.exports)
}
