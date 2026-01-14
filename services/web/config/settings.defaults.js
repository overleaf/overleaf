const Path = require('node:path')
const { merge } = require('@overleaf/settings/merge')

let defaultFeatures, siteUrl

// Make time interval config easier.
const seconds = 1000
const minutes = 60 * seconds

// These credentials are used for authenticating api requests
// between services that may need to go over public channels
const httpAuthUser = process.env.WEB_API_USER
const httpAuthPass = process.env.WEB_API_PASSWORD
const httpAuthUsers = {}
if (httpAuthUser && httpAuthPass) {
  httpAuthUsers[httpAuthUser] = httpAuthPass
}

const intFromEnv = function (name, defaultValue) {
  if (
    [null, undefined].includes(defaultValue) ||
    typeof defaultValue !== 'number'
  ) {
    throw new Error(
      `Bad default integer value for setting: ${name}, ${defaultValue}`
    )
  }
  return parseInt(process.env[name], 10) || defaultValue
}

const defaultTextExtensions = [
  'tex',
  'latex',
  'sty',
  'cls',
  'bst',
  'bib',
  'bibtex',
  'txt',
  'tikz',
  'mtx',
  'rtex',
  'md',
  'asy',
  'lbx',
  'bbx',
  'cbx',
  'm',
  'lco',
  'dtx',
  'ins',
  'ist',
  'def',
  'clo',
  'ldf',
  'rmd',
  'lua',
  'gv',
  'mf',
  'yml',
  'yaml',
  'lhs',
  'mk',
  'xmpdata',
  'cfg',
  'rnw',
  'ltx',
  'inc',
]

const parseTextExtensions = function (extensions) {
  if (extensions) {
    return extensions.split(',').map(ext => ext.trim())
  } else {
    return []
  }
}

const httpPermissionsPolicy = {
  blocked: [
    'accelerometer',
    'attribution-reporting',
    'browsing-topics',
    'camera',
    'display-capture',
    'encrypted-media',
    'gamepad',
    'geolocation',
    'gyroscope',
    'hid',
    'identity-credentials-get',
    'idle-detection',
    'local-fonts',
    'magnetometer',
    'microphone',
    'midi',
    'otp-credentials',
    'payment',
    'picture-in-picture',
    'screen-wake-lock',
    'serial',
    'storage-access',
    'usb',
    'window-management',
    'xr-spatial-tracking',
  ],
  allowed: {
    autoplay: 'self "https://videos.ctfassets.net"',
    fullscreen: 'self',
  },
}

module.exports = {
  env: 'server-ce',

  limits: {
    httpGlobalAgentMaxSockets: 300,
    httpsGlobalAgentMaxSockets: 300,
  },

  allowAnonymousReadAndWriteSharing:
    process.env.OVERLEAF_ALLOW_ANONYMOUS_READ_AND_WRITE_SHARING === 'true',

  // Databases
  // ---------
  mongo: {
    options: {
      appname: 'web',
      maxPoolSize: parseInt(process.env.MONGO_POOL_SIZE, 10) || 100,
      serverSelectionTimeoutMS:
        parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT, 10) || 60000,
      // Setting socketTimeoutMS to 0 means no timeout
      socketTimeoutMS: parseInt(
        process.env.MONGO_SOCKET_TIMEOUT ?? '60000',
        10
      ),
      monitorCommands: true,
    },
    url:
      process.env.MONGO_CONNECTION_STRING ||
      process.env.MONGO_URL ||
      `mongodb://${process.env.MONGO_HOST || '127.0.0.1'}/sharelatex`,
    hasSecondaries: process.env.MONGO_HAS_SECONDARIES === 'true',
  },

  redis: {
    web: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT || '6379',
      password: process.env.REDIS_PASSWORD || '',
      db: process.env.REDIS_DB,
      maxRetriesPerRequest: parseInt(
        process.env.REDIS_MAX_RETRIES_PER_REQUEST || '20'
      ),
    },

    // websessions:
    // 	cluster: [
    // 		{host: '127.0.0.1', port: 7000}
    // 		{host: '127.0.0.1', port: 7001}
    // 		{host: '127.0.0.1', port: 7002}
    // 		{host: '127.0.0.1', port: 7003}
    // 		{host: '127.0.0.1', port: 7004}
    // 		{host: '127.0.0.1', port: 7005}
    // 	]

    // ratelimiter:
    // 	cluster: [
    // 		{host: '127.0.0.1', port: 7000}
    // 		{host: '127.0.0.1', port: 7001}
    // 		{host: '127.0.0.1', port: 7002}
    // 		{host: '127.0.0.1', port: 7003}
    // 		{host: '127.0.0.1', port: 7004}
    // 		{host: '127.0.0.1', port: 7005}
    // 	]

    // cooldown:
    // 	cluster: [
    // 		{host: '127.0.0.1', port: 7000}
    // 		{host: '127.0.0.1', port: 7001}
    // 		{host: '127.0.0.1', port: 7002}
    // 		{host: '127.0.0.1', port: 7003}
    // 		{host: '127.0.0.1', port: 7004}
    // 		{host: '127.0.0.1', port: 7005}
    // 	]

    api: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT || '6379',
      password: process.env.REDIS_PASSWORD || '',
      maxRetriesPerRequest: parseInt(
        process.env.REDIS_MAX_RETRIES_PER_REQUEST || '20'
      ),
    },
  },

  // Service locations
  // -----------------

  // Configure which ports to run each service on. Generally you
  // can leave these as they are unless you have some other services
  // running which conflict, or want to run the web process on port 80.
  internal: {
    web: {
      port: process.env.WEB_PORT || 3000,
      host: process.env.LISTEN_ADDRESS || '127.0.0.1',
    },
  },

  // Tell each service where to find the other services. If everything
  // is running locally then this is easy, but they exist as separate config
  // options incase you want to run some services on remote hosts.
  apis: {
    web: {
      url: `http://${
        process.env.WEB_API_HOST || process.env.WEB_HOST || '127.0.0.1'
      }:${process.env.WEB_API_PORT || process.env.WEB_PORT || 3000}`,
      user: httpAuthUser,
      pass: httpAuthPass,
    },
    documentupdater: {
      url: `http://${
        process.env.DOCUPDATER_HOST ||
        process.env.DOCUMENT_UPDATER_HOST ||
        '127.0.0.1'
      }:3003`,
    },
    docstore: {
      url: `http://${process.env.DOCSTORE_HOST || '127.0.0.1'}:3016`,
      pubUrl: `http://${process.env.DOCSTORE_HOST || '127.0.0.1'}:3016`,
    },
    chat: {
      internal_url: `http://${process.env.CHAT_HOST || '127.0.0.1'}:3010`,
    },
    filestore: {
      url: `http://${process.env.FILESTORE_HOST || '127.0.0.1'}:3009`,
    },
    clsi: {
      url: `http://${process.env.CLSI_HOST || '127.0.0.1'}:3013`,
      // url: "http://#{process.env['CLSI_LB_HOST']}:3014"
      backendGroupName: undefined,
      submissionBackendClass:
        process.env.CLSI_SUBMISSION_BACKEND_CLASS || 'c3d',
    },
    clsiCache: {
      instances: JSON.parse(process.env.CLSI_CACHE_INSTANCES || '[]'),
    },
    project_history: {
      sendProjectStructureOps: true,
      url: `http://${process.env.PROJECT_HISTORY_HOST || '127.0.0.1'}:3054`,
    },
    historyBackupDeletion: {
      enabled: false,
      url: `http://${process.env.HISTORY_BACKUP_DELETION_HOST || '127.0.0.1'}:3101`,
      user: process.env.HISTORY_BACKUP_DELETION_USER || 'staging',
      pass: process.env.HISTORY_BACKUP_DELETION_PASS,
    },
    realTime: {
      url: `http://${process.env.REALTIME_HOST || '127.0.0.1'}:3026`,
    },
    contacts: {
      url: `http://${process.env.CONTACTS_HOST || '127.0.0.1'}:3036`,
    },
    notifications: {
      url: `http://${process.env.NOTIFICATIONS_HOST || '127.0.0.1'}:3042`,
    },
    webpack: {
      url: `http://${process.env.WEBPACK_HOST || '127.0.0.1'}:3808`,
    },
    wiki: {
      url: process.env.WIKI_URL || 'https://learn.sharelatex.com',
      maxCacheAge: parseInt(process.env.WIKI_MAX_CACHE_AGE || 5 * minutes, 10),
    },

    haveIBeenPwned: {
      enabled: process.env.HAVE_I_BEEN_PWNED_ENABLED === 'true',
      url:
        process.env.HAVE_I_BEEN_PWNED_URL || 'https://api.pwnedpasswords.com',
      timeout: parseInt(process.env.HAVE_I_BEEN_PWNED_TIMEOUT, 10) || 5 * 1000,
    },
    v1_history: {
      url:
        process.env.V1_HISTORY_URL ||
        `http://${process.env.V1_HISTORY_HOST || '127.0.0.1'}:${
          process.env.V1_HISTORY_PORT || '3100'
        }/api`,
      urlForGitBridge: process.env.V1_HISTORY_URL_FOR_GIT_BRIDGE,
      user: process.env.V1_HISTORY_USER || 'staging',
      pass:
        process.env.V1_HISTORY_PASS ||
        process.env.V1_HISTORY_PASSWORD ||
        'password',

      buckets: {
        globalBlobs: process.env.OVERLEAF_EDITOR_BLOBS_BUCKET,
        projectBlobs: process.env.OVERLEAF_EDITOR_PROJECT_BLOBS_BUCKET,
      },
    },

    // For legacy reasons, we need to populate the below objects.
    v1: {},
    recurly: {},
  },

  // Defines which features are allowed in the
  // Permissions-Policy HTTP header
  httpPermissions: httpPermissionsPolicy,
  useHttpPermissionsPolicy: true,

  jwt: {
    key: process.env.OT_JWT_AUTH_KEY,
    algorithm: process.env.OT_JWT_AUTH_ALG || 'HS256',
  },

  devToolbar: {
    enabled: false,
  },

  splitTests: [],

  // Where your instance of Overleaf Community Edition/Server Pro can be found publicly. Used in emails
  // that are sent out, generated links, etc.
  siteUrl: (siteUrl = process.env.PUBLIC_URL || 'http://127.0.0.1:3000'),

  lockManager: {
    lockTestInterval: intFromEnv('LOCK_MANAGER_LOCK_TEST_INTERVAL', 50),
    maxTestInterval: intFromEnv('LOCK_MANAGER_MAX_TEST_INTERVAL', 1000),
    maxLockWaitTime: intFromEnv('LOCK_MANAGER_MAX_LOCK_WAIT_TIME', 10000),
    redisLockExpiry: intFromEnv('LOCK_MANAGER_REDIS_LOCK_EXPIRY', 30),
    slowExecutionThreshold: intFromEnv(
      'LOCK_MANAGER_SLOW_EXECUTION_THRESHOLD',
      5000
    ),
  },

  // Optional separate location for websocket connections, if unset defaults to siteUrl.
  wsUrl: process.env.WEBSOCKET_URL,
  wsUrlV2: process.env.WEBSOCKET_URL_V2,
  wsUrlBeta: process.env.WEBSOCKET_URL_BETA,

  wsUrlV2Percentage: parseInt(
    process.env.WEBSOCKET_URL_V2_PERCENTAGE || '0',
    10
  ),
  wsRetryHandshake: parseInt(process.env.WEBSOCKET_RETRY_HANDSHAKE || '5', 10),

  // cookie domain
  // use full domain for cookies to only be accessible from that domain,
  // replace subdomain with dot to have them accessible on all subdomains
  cookieDomain: process.env.COOKIE_DOMAIN,
  cookieName: process.env.COOKIE_NAME || 'overleaf.sid',
  cookieRollingSession: true,

  // this is only used if cookies are used for clsi backend
  // clsiCookieKey: "clsiserver"

  robotsNoindex: process.env.ROBOTS_NOINDEX === 'true' || false,

  maxEntitiesPerProject: parseInt(
    process.env.MAX_ENTITIES_PER_PROJECT || '2000',
    10
  ),

  projectUploadTimeout: parseInt(
    process.env.PROJECT_UPLOAD_TIMEOUT || '120000',
    10
  ),
  maxUploadSize: 50 * 1024 * 1024, // 50 MB
  multerOptions: {
    preservePath: process.env.MULTER_PRESERVE_PATH,
  },

  // start failing the health check if active handles exceeds this limit
  maxActiveHandles: process.env.MAX_ACTIVE_HANDLES
    ? parseInt(process.env.MAX_ACTIVE_HANDLES, 10)
    : undefined,

  // Security
  // --------
  security: {
    sessionSecret: process.env.SESSION_SECRET,
    sessionSecretUpcoming: process.env.SESSION_SECRET_UPCOMING,
    sessionSecretFallback: process.env.SESSION_SECRET_FALLBACK,
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  }, // number of rounds used to hash user passwords (raised to power 2)

  adminUrl: process.env.ADMIN_URL,
  adminOnlyLogin: process.env.ADMIN_ONLY_LOGIN === 'true',
  adminPrivilegeAvailable: process.env.ADMIN_PRIVILEGE_AVAILABLE === 'true',
  adminRolesEnabled: false,
  blockCrossOriginRequests: process.env.BLOCK_CROSS_ORIGIN_REQUESTS === 'true',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || siteUrl).split(','),

  httpAuthUsers,

  // Default features
  // ----------------
  //
  // You can select the features that are enabled by default for new
  // new users.
  defaultFeatures: (defaultFeatures = {
    collaborators: -1,
    dropbox: true,
    github: true,
    gitBridge: true,
    versioning: true,
    compileTimeout: 180,
    compileGroup: 'standard',
    references: true,
    trackChanges: true,
  }),

  // featuresEpoch: 'YYYY-MM-DD',

  features: {
    personal: defaultFeatures,
  },

  groupPlanModalOptions: {
    plan_codes: [],
    currencies: [],
    sizes: [],
    usages: [],
  },
  plans: [
    {
      planCode: 'personal',
      name: 'Personal',
      price_in_cents: 0,
      features: defaultFeatures,
    },
  ],

  disableChat: process.env.OVERLEAF_DISABLE_CHAT === 'true',
  disableLinkSharing: process.env.OVERLEAF_DISABLE_LINK_SHARING === 'true',
  enableSubscriptions: false,
  restrictedCountries: [],
  enableOnboardingEmails: process.env.ENABLE_ONBOARDING_EMAILS === 'true',

  enabledLinkedFileTypes: (process.env.ENABLED_LINKED_FILE_TYPES || '').split(
    ','
  ),

  // i18n
  // ------
  //
  i18n: {
    checkForHTMLInVars: process.env.I18N_CHECK_FOR_HTML_IN_VARS === 'true',
    escapeHTMLInVars: process.env.I18N_ESCAPE_HTML_IN_VARS === 'true',
    subdomainLang: {
      www: { lngCode: 'en', url: siteUrl },
    },
    defaultLng: 'en',
  },

  // Spelling languages
  // dic = available in client
  // server: false = not available on server
  // ------------------
  languages: [
    { code: 'en', name: 'English' },
    { code: 'en_US', dic: 'en_US', name: 'English (American)' },
    { code: 'en_GB', dic: 'en_GB', name: 'English (British)' },
    { code: 'en_CA', dic: 'en_CA', name: 'English (Canadian)' },
    {
      code: 'en_AU',
      dic: 'en_AU',
      name: 'English (Australian)',
      server: false,
    },
    {
      code: 'en_ZA',
      dic: 'en_ZA',
      name: 'English (South African)',
      server: false,
    },
    { code: 'af', dic: 'af_ZA', name: 'Afrikaans' },
    { code: 'an', dic: 'an_ES', name: 'Aragonese', server: false },
    { code: 'ar', dic: 'ar', name: 'Arabic' },
    { code: 'be_BY', dic: 'be_BY', name: 'Belarusian', server: false },
    { code: 'eu', dic: 'eu', name: 'Basque' },
    { code: 'bn_BD', dic: 'bn_BD', name: 'Bengali', server: false },
    { code: 'bs_BA', dic: 'bs_BA', name: 'Bosnian', server: false },
    { code: 'br', dic: 'br_FR', name: 'Breton' },
    { code: 'bg', dic: 'bg_BG', name: 'Bulgarian' },
    { code: 'ca', dic: 'ca', name: 'Catalan' },
    { code: 'hr', dic: 'hr_HR', name: 'Croatian' },
    { code: 'cs', dic: 'cs_CZ', name: 'Czech' },
    { code: 'da', dic: 'da_DK', name: 'Danish' },
    { code: 'nl', dic: 'nl', name: 'Dutch' },
    { code: 'dz', dic: 'dz', name: 'Dzongkha', server: false },
    { code: 'eo', dic: 'eo', name: 'Esperanto' },
    { code: 'et', dic: 'et_EE', name: 'Estonian' },
    { code: 'fo', dic: 'fo', name: 'Faroese' },
    { code: 'fr', dic: 'fr', name: 'French' },
    { code: 'gl', dic: 'gl_ES', name: 'Galician' },
    { code: 'de', dic: 'de_DE', name: 'German' },
    { code: 'de_AT', dic: 'de_AT', name: 'German (Austria)', server: false },
    {
      code: 'de_CH',
      dic: 'de_CH',
      name: 'German (Switzerland)',
      server: false,
    },
    { code: 'el', dic: 'el_GR', name: 'Greek' },
    { code: 'gug_PY', dic: 'gug_PY', name: 'Guarani', server: false },
    { code: 'gu_IN', dic: 'gu_IN', name: 'Gujarati', server: false },
    { code: 'he_IL', dic: 'he_IL', name: 'Hebrew', server: false },
    { code: 'hi_IN', dic: 'hi_IN', name: 'Hindi', server: false },
    { code: 'hu_HU', dic: 'hu_HU', name: 'Hungarian', server: false },
    { code: 'is_IS', dic: 'is_IS', name: 'Icelandic', server: false },
    { code: 'id', dic: 'id_ID', name: 'Indonesian' },
    { code: 'ga', dic: 'ga_IE', name: 'Irish' },
    { code: 'it', dic: 'it_IT', name: 'Italian' },
    { code: 'kk', dic: 'kk_KZ', name: 'Kazakh' },
    { code: 'ko', dic: 'ko', name: 'Korean', server: false },
    { code: 'ku', name: 'Kurdish' },
    { code: 'kmr', dic: 'kmr_Latn', name: 'Kurmanji', server: false },
    { code: 'lv', dic: 'lv_LV', name: 'Latvian' },
    { code: 'lt', dic: 'lt_LT', name: 'Lithuanian' },
    { code: 'lo_LA', dic: 'lo_LA', name: 'Laotian', server: false },
    { code: 'ml_IN', dic: 'ml_IN', name: 'Malayalam', server: false },
    { code: 'mn_MN', dic: 'mn_MN', name: 'Mongolian', server: false },
    { code: 'nr', name: 'Ndebele' },
    { code: 'ne_NP', dic: 'ne_NP', name: 'Nepali', server: false },
    { code: 'ns', name: 'Northern Sotho' },
    { code: 'no', name: 'Norwegian' },
    { code: 'nb_NO', dic: 'nb_NO', name: 'Norwegian (Bokmål)', server: false },
    { code: 'nn_NO', dic: 'nn_NO', name: 'Norwegian (Nynorsk)', server: false },
    { code: 'oc_FR', dic: 'oc_FR', name: 'Occitan', server: false },
    { code: 'fa', dic: 'fa_IR', name: 'Persian' },
    { code: 'pl', dic: 'pl_PL', name: 'Polish' },
    { code: 'pt_BR', dic: 'pt_BR', name: 'Portuguese (Brazilian)' },
    {
      code: 'pt_PT',
      dic: 'pt_PT',
      name: 'Portuguese (European)',
    },
    { code: 'pa', name: 'Punjabi' },
    { code: 'ro', dic: 'ro_RO', name: 'Romanian' },
    { code: 'ru', dic: 'ru_RU', name: 'Russian' },
    { code: 'gd_GB', dic: 'gd_GB', name: 'Scottish Gaelic', server: false },
    { code: 'sr_RS', dic: 'sr_RS', name: 'Serbian', server: false },
    { code: 'si_LK', dic: 'si_LK', name: 'Sinhala', server: false },
    { code: 'sk', dic: 'sk_SK', name: 'Slovak' },
    { code: 'sl', dic: 'sl_SI', name: 'Slovenian' },
    { code: 'st', name: 'Southern Sotho' },
    { code: 'es', dic: 'es_ES', name: 'Spanish' },
    { code: 'sw_TZ', dic: 'sw_TZ', name: 'Swahili', server: false },
    { code: 'sv', dic: 'sv_SE', name: 'Swedish' },
    { code: 'tl', dic: 'tl', name: 'Tagalog' },
    { code: 'te_IN', dic: 'te_IN', name: 'Telugu', server: false },
    { code: 'th_TH', dic: 'th_TH', name: 'Thai', server: false },
    { code: 'bo', dic: 'bo', name: 'Tibetan', server: false },
    { code: 'ts', name: 'Tsonga' },
    { code: 'tn', name: 'Tswana' },
    { code: 'tr_TR', dic: 'tr_TR', name: 'Turkish', server: false },
    { code: 'uk_UA', dic: 'uk_UA', name: 'Ukrainian', server: false },
    { code: 'hsb', name: 'Upper Sorbian' },
    { code: 'uz_UZ', dic: 'uz_UZ', name: 'Uzbek', server: false },
    { code: 'vi_VN', dic: 'vi_VN', name: 'Vietnamese', server: false },
    { code: 'cy', name: 'Welsh' },
    { code: 'xh', name: 'Xhosa' },
  ],

  translatedLanguages: {
    cn: '简体中文',
    cs: 'Čeština',
    da: 'Dansk',
    de: 'Deutsch',
    en: 'English',
    es: 'Español',
    fi: 'Suomi',
    fr: 'Français',
    it: 'Italiano',
    ja: '日本語',
    ko: '한국어',
    nl: 'Nederlands',
    no: 'Norsk',
    pl: 'Polski',
    pt: 'Português',
    ro: 'Română',
    ru: 'Русский',
    sv: 'Svenska',
    tr: 'Türkçe',
    uk: 'Українська',
    'zh-CN': '简体中文',
  },

  maxDictionarySize: 1024 * 1024, // 1 MB

  // Password Settings
  // -----------
  // These restrict the passwords users can use when registering
  // opts are from http://antelle.github.io/passfield
  passwordStrengthOptions: {
    length: {
      min: 8,
      // Bcrypt does not support longer passwords than that.
      max: 72,
    },
  },

  elevateAccountSecurityAfterFailedLogin:
    parseInt(process.env.ELEVATED_ACCOUNT_SECURITY_AFTER_FAILED_LOGIN_MS, 10) ||
    24 * 60 * 60 * 1000,

  deviceHistory: {
    cookieName: process.env.DEVICE_HISTORY_COOKIE_NAME || 'deviceHistory',
    entryExpiry:
      parseInt(process.env.DEVICE_HISTORY_ENTRY_EXPIRY_MS, 10) ||
      90 * 24 * 60 * 60 * 1000,
    maxEntries: parseInt(process.env.DEVICE_HISTORY_MAX_ENTRIES, 10) || 10,
    secret: process.env.DEVICE_HISTORY_SECRET,
  },

  // Email support
  // -------------
  //
  //	Overleaf uses nodemailer (http://www.nodemailer.com/) to send transactional emails.
  //	To see the range of transport and options they support, see http://www.nodemailer.com/docs/transports
  // email:
  //	fromAddress: ""
  //	replyTo: ""
  //	lifecycle: false
  // # Example transport and parameter settings for Amazon SES
  //	transport: "SES"
  //	parameters:
  //		AWSAccessKeyID: ""
  //		AWSSecretKey: ""

  // For legacy reasons, we need to populate this object.
  sentry: {},

  // Production Settings
  // -------------------
  debugPugTemplates: process.env.DEBUG_PUG_TEMPLATES === 'true',
  precompilePugTemplatesAtBootTime: process.env
    .PRECOMPILE_PUG_TEMPLATES_AT_BOOT_TIME
    ? process.env.PRECOMPILE_PUG_TEMPLATES_AT_BOOT_TIME === 'true'
    : process.env.NODE_ENV === 'production',

  // Should javascript assets be served minified or not.
  useMinifiedJs: process.env.MINIFIED_JS === 'true' || false,

  // Should static assets be sent with a header to tell the browser to cache
  // them.
  cacheStaticAssets: false,

  // If you are running Overleaf over https, set this to true to send the
  // cookie with a secure flag (recommended).
  secureCookie: false,

  // 'SameSite' cookie setting. Can be set to 'lax', 'none' or 'strict'
  // 'lax' is recommended, as 'strict' will prevent people linking to projects
  // https://tools.ietf.org/html/draft-ietf-httpbis-rfc6265bis-03#section-4.1.2.7
  sameSiteCookie: 'lax',

  // If you are running Overleaf behind a proxy (like Apache, Nginx, etc)
  // then set this to true to allow it to correctly detect the forwarded IP
  // address and http/https protocol information.
  behindProxy: true,
  trustedProxyIps: process.env.TRUSTED_PROXY_IPS || 'loopback',

  // Delay before closing the http server upon receiving a SIGTERM process signal.
  gracefulShutdownDelayInMs:
    parseInt(process.env.GRACEFUL_SHUTDOWN_DELAY_SECONDS ?? '5', 10) * seconds,

  maxReconnectGracefullyIntervalMs: parseInt(
    process.env.MAX_RECONNECT_GRACEFULLY_INTERVAL_MS ?? '30000',
    10
  ),

  // Expose the hostname in the `X-Served-By` response header
  exposeHostname: process.env.EXPOSE_HOSTNAME === 'true',

  // Cookie max age (in milliseconds). Set to false for a browser session.
  cookieSessionLength: 5 * 24 * 60 * 60 * 1000, // 5 days

  // When true, only allow invites to be sent to email addresses that
  // already have user accounts
  restrictInvitesToExistingAccounts: false,

  // Should we allow access to any page without logging in? This includes
  // public projects, /learn, /templates, about pages, etc.
  allowPublicAccess: process.env.OVERLEAF_ALLOW_PUBLIC_ACCESS === 'true',

  // editor should be open by default
  editorIsOpen: process.env.EDITOR_OPEN !== 'false',

  // site should be open by default
  siteIsOpen: process.env.SITE_OPEN !== 'false',
  // status file for closing/opening the site at run-time, polled every 5s
  siteMaintenanceFile: process.env.SITE_MAINTENANCE_FILE,

  // Use a single compile directory for all users in a project
  // (otherwise each user has their own directory)
  // disablePerUserCompiles: true

  // Domain the client (pdfjs) should download the compiled pdf from
  pdfDownloadDomain: process.env.COMPILES_USER_CONTENT_DOMAIN, // "http://clsi-lb:3014"

  // By default turn on feature flag, can be overridden per request.
  enablePdfCaching: process.env.ENABLE_PDF_CACHING === 'true',

  // Maximum size of text documents in the real-time editing system.
  max_doc_length: 2 * 1024 * 1024, // 2mb

  primary_email_check_expiration: 1000 * 60 * 60 * 24 * 90, // 90 days

  userHardDeletionDelay:
    parseInt(process.env.OVERLEAF_USER_HARD_DELETION_DELAY, 10) ||
    1000 * 60 * 60 * 24 * 90, // 90 days
  projectHardDeletionDelay:
    parseInt(process.env.OVERLEAF_PROJECT_HARD_DELETION_DELAY, 10) ||
    1000 * 60 * 60 * 24 * 90, // 90 days

  // Maximum Delay before sending comment mention notifications
  notificationMaxDelay:
    parseInt(process.env.COMMENT_MENTION_DELAY_MINUTES) || 30 * 60 * 1000, // 30 minutes

  // Comment mention notifications will wait at least this long before being sent
  notificationMinDelay:
    parseInt(process.env.COMMENT_MENTION_DELAY_MINUTES) || 10 * 60 * 1000, // 10 minutes

  // Maximum JSON size in HTTP requests
  // We should be able to process twice the max doc length, to allow for
  //   - the doc content
  //   - text ranges spanning the whole doc
  //
  // There's also overhead required for the JSON encoding and the UTF-8
  // encoding, theoretically up to 6 times the max doc length (e.g. a document
  // entirely filled with "\u0011" characters). On the other hand, we don't want
  // to block the event loop with JSON parsing, so we try to find a practical
  // compromise.
  max_json_request_size:
    parseInt(process.env.MAX_JSON_REQUEST_SIZE) || 12 * 1024 * 1024, // 12 MB

  // Internal configs
  // ----------------
  path: {
    // If we ever need to write something to disk (e.g. incoming requests
    // that need processing but may be too big for memory, then write
    // them to disk here).
    dumpFolder: Path.resolve(__dirname, '../data/dumpFolder'),
    uploadFolder: Path.resolve(__dirname, '../data/uploads'),
  },

  // Automatic Snapshots
  // -------------------
  automaticSnapshots: {
    // How long should we wait after the user last edited to
    // take a snapshot?
    waitTimeAfterLastEdit: 5 * minutes,
    // Even if edits are still taking place, this is maximum
    // time to wait before taking another snapshot.
    maxTimeBetweenSnapshots: 30 * minutes,
  },

  // Smoke test
  // ----------
  // Provide log in credentials and a project to be able to run
  // some basic smoke tests to check the core functionality.
  //
  smokeTest: {
    user: process.env.SMOKE_TEST_USER,
    userId: process.env.SMOKE_TEST_USER_ID,
    password: process.env.SMOKE_TEST_PASSWORD,
    projectId: process.env.SMOKE_TEST_PROJECT_ID,
    rateLimitSubject: process.env.SMOKE_TEST_RATE_LIMIT_SUBJECT || '127.0.0.1',
    stepTimeout: parseInt(process.env.SMOKE_TEST_STEP_TIMEOUT || '10000', 10),
  },

  appName: process.env.APP_NAME || 'Overleaf (Community Edition)',

  adminEmail: process.env.ADMIN_EMAIL || 'placeholder@example.com',
  adminDomains: process.env.ADMIN_DOMAINS
    ? JSON.parse(process.env.ADMIN_DOMAINS)
    : undefined,

  nav: {
    title: process.env.APP_NAME || 'Overleaf Community Edition',

    hide_powered_by: process.env.NAV_HIDE_POWERED_BY === 'true',
    left_footer: [],

    right_footer: [
      {
        text: '<a href="https://github.com/overleaf/overleaf">Fork on GitHub!</a>',
      },
    ],

    showSubscriptionLink: false,

    header_extras: [],
  },
  // Example:
  //   header_extras: [{text: "Some Page", url: "http://example.com/some/page", class: "subdued"}]

  recaptcha: {
    endpoint:
      process.env.RECAPTCHA_ENDPOINT ||
      'https://www.google.com/recaptcha/api/siteverify',
    trustedUsers: (process.env.CAPTCHA_TRUSTED_USERS || '')
      .split(',')
      .map(x => x.trim())
      .filter(x => x !== ''),
    trustedUsersRegex: process.env.CAPTCHA_TRUSTED_USERS_REGEX
      ? // Enforce matching of the entire input.
        new RegExp(`^${process.env.CAPTCHA_TRUSTED_USERS_REGEX}$`)
      : null,
    disabled: {
      invite: true,
      login: true,
      passwordReset: true,
      register: true,
      addEmail: true,
    },
  },

  customisation: {},

  redirects: {
    '/templates/index': '/templates/',
  },

  enablePugCache: process.env.ENABLE_PUG_CACHE === 'true',
  reloadModuleViewsOnEachRequest:
    process.env.ENABLE_PUG_CACHE !== 'true' &&
    process.env.NODE_ENV === 'development',

  rateLimit: {
    subnetRateLimiterDisabled:
      process.env.SUBNET_RATE_LIMITER_DISABLED === 'true',
    autoCompile: {
      everyone: process.env.RATE_LIMIT_AUTO_COMPILE_EVERYONE || 100,
      standard: process.env.RATE_LIMIT_AUTO_COMPILE_STANDARD || 25,
    },
    login: {
      ip: { points: 20, subnetPoints: 200, duration: 60 },
      email: { points: 10, duration: 120 },
    },
  },

  analytics: {
    enabled: false,
  },

  compileBodySizeLimitMb: process.env.COMPILE_BODY_SIZE_LIMIT_MB || 7,

  textExtensions: defaultTextExtensions.concat(
    parseTextExtensions(process.env.ADDITIONAL_TEXT_EXTENSIONS)
  ),

  // case-insensitive file names that is editable (doc) in the editor
  editableFilenames: ['latexmkrc', '.latexmkrc', 'makefile', 'gnumakefile'],

  fileIgnorePattern:
    process.env.FILE_IGNORE_PATTERN ||
    '**/{{__MACOSX,.git,.texpadtmp,.R}{,/**},.!(latexmkrc),*.{dvi,aux,log,toc,out,pdfsync,synctex,synctex(busy),fdb_latexmk,fls,nlo,ind,glo,gls,glg,bbl,blg,doc,docx,gz,swp}}',

  validRootDocExtensions: ['tex', 'Rtex', 'ltx', 'Rnw'],

  emailConfirmationDisabled:
    process.env.EMAIL_CONFIRMATION_DISABLED === 'true' || false,

  emailAddressLimit: intFromEnv('EMAIL_ADDRESS_LIMIT', 10),

  enabledServices: (process.env.ENABLED_SERVICES || 'web,api')
    .split(',')
    .map(s => s.trim()),

  // module options
  // ----------
  modules: {
    sanitize: {
      options: {
        allowedTags: [
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'blockquote',
          'p',
          'a',
          'ul',
          'ol',
          'nl',
          'li',
          'b',
          'i',
          'strong',
          'em',
          'strike',
          'code',
          'hr',
          'br',
          'div',
          'table',
          'thead',
          'col',
          'caption',
          'tbody',
          'tr',
          'th',
          'td',
          'tfoot',
          'pre',
          'iframe',
          'img',
          'figure',
          'figcaption',
          'span',
          'source',
          'track',
          'video',
          'del',
        ],
        allowedAttributes: {
          a: [
            'href',
            'name',
            'target',
            'class',
            'event-tracking',
            'event-tracking-ga',
            'event-tracking-label',
            'event-tracking-trigger',
          ],
          div: ['class', 'id', 'style'],
          h1: ['class', 'id'],
          h2: ['class', 'id'],
          h3: ['class', 'id'],
          h4: ['class', 'id'],
          h5: ['class', 'id'],
          h6: ['class', 'id'],
          p: ['class'],
          col: ['width'],
          figure: ['class', 'id', 'style'],
          figcaption: ['class', 'id', 'style'],
          i: ['aria-hidden', 'aria-label', 'class', 'id', 'translate'],
          iframe: [
            'allowfullscreen',
            'frameborder',
            'height',
            'src',
            'style',
            'width',
          ],
          img: ['alt', 'class', 'src', 'style'],
          source: ['src', 'type'],
          span: ['class', 'id', 'style'],
          strong: ['style'],
          table: ['border', 'class', 'id', 'style'],
          td: ['colspan', 'rowspan', 'headers', 'style'],
          th: [
            'abbr',
            'headers',
            'colspan',
            'rowspan',
            'scope',
            'sorted',
            'style',
          ],
          tr: ['class'],
          track: ['src', 'kind', 'srcLang', 'label'],
          video: ['alt', 'class', 'controls', 'height', 'width'],
        },
      },
    },
  },

  overleafModuleImports: {
    // modules to import (an empty array for each set of modules)
    //
    // Restart webpack after making changes.
    //
    createFileModes: [],
    devToolbar: [],
    gitBridge: [],
    publishModal: [],
    tprFileViewInfo: [],
    tprFileViewRefreshError: [],
    tprFileViewRefreshButton: [],
    tprFileViewNotOriginalImporter: [],
    contactUsModal: [],
    sourceEditorExtensions: [],
    sourceEditorComponents: [],
    pdfLogEntryHeaderActionComponents: [],
    pdfLogEntryComponents: [],
    pdfLogEntriesComponents: [],
    pdfPreviewPromotions: [],
    diagnosticActions: [],
    sourceEditorCompletionSources: [],
    sourceEditorSymbolPalette: [],
    sourceEditorToolbarComponents: [],
    sourceEditorToolbarEndButtons: [],
    rootContextProviders: [],
    mainEditorLayoutModals: [],
    mainEditorLayoutPanels: [],
    langFeedbackLinkingWidgets: [],
    labsExperiments: [],
    integrationLinkingWidgets: [],
    referenceLinkingWidgets: [],
    importProjectFromGithubModalWrapper: [],
    importProjectFromGithubMenu: [],
    editorLeftMenuSync: [],
    editorLeftMenuManageTemplate: [],
    menubarExtraComponents: [],
    oauth2Server: [],
    managedGroupSubscriptionEnrollmentNotification: [],
    managedGroupEnrollmentInvite: [],
    ssoCertificateInfo: [],
    v1ImportDataScreen: [],
    snapshotUtils: [],
    visualEditorProviders: [],
    usGovBanner: [],
    rollingBuildsUpdatedAlert: [],
    offlineModeToolbarButtons: [],
    settingsEntries: [],
    autoCompleteExtensions: [],
    sectionTitleGenerators: [],
    toastGenerators: [
      Path.resolve(
        __dirname,
        '../frontend/js/features/pdf-preview/components/synctex-toasts'
      ),
    ],
    editorSidebarComponents: [
      Path.resolve(
        __dirname,
        '../modules/full-project-search/frontend/js/components/full-project-search.tsx'
      ),
    ],
    fileTreeToolbarComponents: [
      Path.resolve(
        __dirname,
        '../modules/full-project-search/frontend/js/components/full-project-search-button.tsx'
      ),
    ],
    fullProjectSearchPanel: [
      Path.resolve(
        __dirname,
        '../modules/full-project-search/frontend/js/components/full-project-search.tsx'
      ),
    ],
    integrationPanelComponents: [],
    referenceSearchSetting: [],
    errorLogsComponents: [],
    referenceIndices: [],
    railEntries: [],
    railPopovers: [],
  },

  moduleImportSequence: [
    'history-v1',
    'launchpad',
    'server-ce-scripts',
    'user-activate',
  ],
  viewIncludes: {},

  csp: {
    enabled: process.env.CSP_ENABLED === 'true',
    reportOnly: process.env.CSP_REPORT_ONLY === 'true',
    reportPercentage: parseFloat(process.env.CSP_REPORT_PERCENTAGE) || 0,
    reportUri: process.env.CSP_REPORT_URI,
    exclude: [],
    viewDirectives: {
      'app/views/project/ide-react': [`img-src 'self' data: blob:`],
    },
  },

  unsupportedBrowsers: {
    ie: '<=11',
    safari: '<=14',
    firefox: '<=78',
  },

  // ID of the IEEE brand in the rails app
  ieeeBrandId: intFromEnv('IEEE_BRAND_ID', 15),

  managedUsers: {
    enabled: false,
  },
}

module.exports.mergeWith = function (overrides) {
  return merge(overrides, module.exports)
}
