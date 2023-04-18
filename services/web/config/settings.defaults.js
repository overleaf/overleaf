const Path = require('path')
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

const sessionSecret = process.env.SESSION_SECRET || 'secret-please-change'

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
  'latexmkrc',
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
]

const parseTextExtensions = function (extensions) {
  if (extensions) {
    return extensions.split(',').map(ext => ext.trim())
  } else {
    return []
  }
}

module.exports = {
  env: 'server-ce',

  limits: {
    httpGlobalAgentMaxSockets: 300,
    httpsGlobalAgentMaxSockets: 300,
  },

  allowAnonymousReadAndWriteSharing:
    process.env.SHARELATEX_ALLOW_ANONYMOUS_READ_AND_WRITE_SHARING === 'true',

  // Databases
  // ---------
  mongo: {
    options: {
      appname: 'web',
      maxPoolSize: parseInt(process.env.MONGO_POOL_SIZE, 10) || 100,
      serverSelectionTimeoutMS:
        parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT, 10) || 60000,
      socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT, 10) || 60000,
    },
    url:
      process.env.MONGO_CONNECTION_STRING ||
      process.env.MONGO_URL ||
      `mongodb://${process.env.MONGO_HOST || '127.0.0.1'}/sharelatex`,
    hasSecondaries: process.env.MONGO_HAS_SECONDARIES === 'true',
  },

  redis: {
    web: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || '6379',
      password: process.env.REDIS_PASSWORD || '',
      db: process.env.REDIS_DB,
      maxRetriesPerRequest: parseInt(
        process.env.REDIS_MAX_RETRIES_PER_REQUEST || '20'
      ),
    },

    // websessions:
    // 	cluster: [
    // 		{host: 'localhost', port: 7000}
    // 		{host: 'localhost', port: 7001}
    // 		{host: 'localhost', port: 7002}
    // 		{host: 'localhost', port: 7003}
    // 		{host: 'localhost', port: 7004}
    // 		{host: 'localhost', port: 7005}
    // 	]

    // ratelimiter:
    // 	cluster: [
    // 		{host: 'localhost', port: 7000}
    // 		{host: 'localhost', port: 7001}
    // 		{host: 'localhost', port: 7002}
    // 		{host: 'localhost', port: 7003}
    // 		{host: 'localhost', port: 7004}
    // 		{host: 'localhost', port: 7005}
    // 	]

    // cooldown:
    // 	cluster: [
    // 		{host: 'localhost', port: 7000}
    // 		{host: 'localhost', port: 7001}
    // 		{host: 'localhost', port: 7002}
    // 		{host: 'localhost', port: 7003}
    // 		{host: 'localhost', port: 7004}
    // 		{host: 'localhost', port: 7005}
    // 	]

    api: {
      host: process.env.REDIS_HOST || 'localhost',
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
      host: process.env.LISTEN_ADDRESS || 'localhost',
    },
  },

  // Tell each service where to find the other services. If everything
  // is running locally then this is easy, but they exist as separate config
  // options incase you want to run some services on remote hosts.
  apis: {
    web: {
      url: `http://${
        process.env.WEB_API_HOST || process.env.WEB_HOST || 'localhost'
      }:${process.env.WEB_API_PORT || process.env.WEB_PORT || 3000}`,
      user: httpAuthUser,
      pass: httpAuthPass,
    },
    documentupdater: {
      url: `http://${
        process.env.DOCUPDATER_HOST ||
        process.env.DOCUMENT_UPDATER_HOST ||
        'localhost'
      }:3003`,
    },
    spelling: {
      url: `http://${process.env.SPELLING_HOST || 'localhost'}:3005`,
      host: process.env.SPELLING_HOST,
    },
    trackchanges: {
      url: `http://${process.env.TRACK_CHANGES_HOST || 'localhost'}:3015`,
    },
    docstore: {
      url: `http://${process.env.DOCSTORE_HOST || 'localhost'}:3016`,
      pubUrl: `http://${process.env.DOCSTORE_HOST || 'localhost'}:3016`,
    },
    chat: {
      internal_url: `http://${process.env.CHAT_HOST || 'localhost'}:3010`,
    },
    filestore: {
      url: `http://${process.env.FILESTORE_HOST || 'localhost'}:3009`,
    },
    clsi: {
      url: `http://${process.env.CLSI_HOST || 'localhost'}:3013`,
      // url: "http://#{process.env['CLSI_LB_HOST']}:3014"
      backendGroupName: undefined,
      defaultBackendClass: process.env.CLSI_DEFAULT_BACKEND_CLASS || 'e2',
    },
    project_history: {
      sendProjectStructureOps: true,
      initializeHistoryForNewProjects: true,
      displayHistoryForNewProjects: true,
      url: `http://${process.env.PROJECT_HISTORY_HOST || 'localhost'}:3054`,
    },
    realTime: {
      url: `http://${process.env.REALTIME_HOST || 'localhost'}:3026`,
    },
    contacts: {
      url: `http://${process.env.CONTACTS_HOST || 'localhost'}:3036`,
    },
    notifications: {
      url: `http://${process.env.NOTIFICATIONS_HOST || 'localhost'}:3042`,
    },
    webpack: {
      url: `http://${process.env.WEBPACK_HOST || 'localhost'}:3808`,
    },

    haveIBeenPwned: {
      enabled: process.env.HAVE_I_BEEN_PWNED_ENABLED === 'true',
      url:
        process.env.HAVE_I_BEEN_PWNED_URL || 'https://api.pwnedpasswords.com',
      timeout: parseInt(process.env.HAVE_I_BEEN_PWNED_TIMEOUT, 10) || 5 * 1000,
    },

    // For legacy reasons, we need to populate the below objects.
    v1: {},
    recurly: {},
  },

  jwt: {
    key: process.env.OT_JWT_AUTH_KEY,
    algorithm: process.env.OT_JWT_AUTH_ALG || 'HS256',
  },

  splitTests: [],

  // Where your instance of ShareLaTeX can be found publically. Used in emails
  // that are sent out, generated links, etc.
  siteUrl: (siteUrl = process.env.PUBLIC_URL || 'http://localhost:3000'),

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
  cookieName: process.env.COOKIE_NAME || 'sharelatex.sid',
  cookieRollingSession: true,

  // this is only used if cookies are used for clsi backend
  // clsiCookieKey: "clsiserver"

  robotsNoindex: process.env.ROBOTS_NOINDEX === 'true' || false,

  maxEntitiesPerProject: 2000,

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
    sessionSecret,
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  }, // number of rounds used to hash user passwords (raised to power 2)

  adminUrl: process.env.ADMIN_URL,
  adminOnlyLogin: process.env.ADMIN_ONLY_LOGIN === 'true',
  adminPrivilegeAvailable: process.env.ADMIN_PRIVILEGE_AVAILABLE === 'true',
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
    templates: true,
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

  enableSubscriptions: false,

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
  // ------------------
  //
  // You must have the corresponding aspell package installed to
  // be able to use a language.
  languages: [
    { code: 'en', name: 'English' },
    { code: 'en_US', name: 'English (American)' },
    { code: 'en_GB', name: 'English (British)' },
    { code: 'en_CA', name: 'English (Canadian)' },
    { code: 'af', name: 'Afrikaans' },
    { code: 'ar', name: 'Arabic' },
    { code: 'gl', name: 'Galician' },
    { code: 'eu', name: 'Basque' },
    { code: 'br', name: 'Breton' },
    { code: 'bg', name: 'Bulgarian' },
    { code: 'ca', name: 'Catalan' },
    { code: 'hr', name: 'Croatian' },
    { code: 'cs', name: 'Czech' },
    { code: 'da', name: 'Danish' },
    { code: 'nl', name: 'Dutch' },
    { code: 'eo', name: 'Esperanto' },
    { code: 'et', name: 'Estonian' },
    { code: 'fo', name: 'Faroese' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'el', name: 'Greek' },
    { code: 'id', name: 'Indonesian' },
    { code: 'ga', name: 'Irish' },
    { code: 'it', name: 'Italian' },
    { code: 'kk', name: 'Kazakh' },
    { code: 'ku', name: 'Kurdish' },
    { code: 'lv', name: 'Latvian' },
    { code: 'lt', name: 'Lithuanian' },
    { code: 'nr', name: 'Ndebele' },
    { code: 'ns', name: 'Northern Sotho' },
    { code: 'no', name: 'Norwegian' },
    { code: 'fa', name: 'Persian' },
    { code: 'pl', name: 'Polish' },
    { code: 'pt_BR', name: 'Portuguese (Brazilian)' },
    { code: 'pt_PT', name: 'Portuguese (European)' },
    { code: 'pa', name: 'Punjabi' },
    { code: 'ro', name: 'Romanian' },
    { code: 'ru', name: 'Russian' },
    { code: 'sk', name: 'Slovak' },
    { code: 'sl', name: 'Slovenian' },
    { code: 'st', name: 'Southern Sotho' },
    { code: 'es', name: 'Spanish' },
    { code: 'sv', name: 'Swedish' },
    { code: 'tl', name: 'Tagalog' },
    { code: 'ts', name: 'Tsonga' },
    { code: 'tn', name: 'Tswana' },
    { code: 'hsb', name: 'Upper Sorbian' },
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
  //	ShareLaTeX uses nodemailer (http://www.nodemailer.com/) to send transactional emails.
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

  // If you are running ShareLaTeX over https, set this to true to send the
  // cookie with a secure flag (recommended).
  secureCookie: false,

  // 'SameSite' cookie setting. Can be set to 'lax', 'none' or 'strict'
  // 'lax' is recommended, as 'strict' will prevent people linking to projects
  // https://tools.ietf.org/html/draft-ietf-httpbis-rfc6265bis-03#section-4.1.2.7
  sameSiteCookie: 'lax',

  // If you are running ShareLaTeX behind a proxy (like Apache, Nginx, etc)
  // then set this to true to allow it to correctly detect the forwarded IP
  // address and http/https protocol information.
  behindProxy: false,

  // Delay before closing the http server upon receiving a SIGTERM process signal.
  gracefulShutdownDelayInMs: parseInt(
    process.env.GRACEFUL_SHUTDOWN_DELAY || 30 * seconds,
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
  allowPublicAccess: process.env.SHARELATEX_ALLOW_PUBLIC_ACCESS === 'true',

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
  pdfDownloadDomain: process.env.PDF_DOWNLOAD_DOMAIN, // "http://clsi-lb:3014"
  compilesUserContentDomain: process.env.COMPILES_USER_CONTENT_DOMAIN,

  // By default turn on feature flag, can be overridden per request.
  enablePdfCaching: process.env.ENABLE_PDF_CACHING === 'true',

  // Maximum size of text documents in the real-time editing system.
  max_doc_length: 2 * 1024 * 1024, // 2mb

  primary_email_check_expiration: 1000 * 60 * 60 * 24 * 90, // 90 days

  // Maximum JSON size in HTTP requests
  // We should be able to process twice the max doc length, to allow for
  //   - the doc content
  //   - text ranges spanning the whole doc
  //
  // There's also overhead required for the JSON encoding and the UTF-8 encoding,
  // theoretically up to 3 times the max doc length. On the other hand, we don't
  // want to block the event loop with JSON parsing, so we try to find a
  // practical compromise.
  max_json_request_size:
    parseInt(process.env.MAX_JSON_REQUEST_SIZE) || 6 * 1024 * 1024, // 6 MB

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
        text: "<i class='fa fa-github-square'></i> Fork on GitHub!",
        url: 'https://github.com/overleaf/overleaf',
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
    disabled: {
      invite: true,
      login: true,
      passwordReset: true,
      register: true,
    },
  },

  customisation: {},

  redirects: {
    '/templates/index': '/templates/',
  },

  reloadModuleViewsOnEachRequest: process.env.NODE_ENV === 'development',

  rateLimit: {
    autoCompile: {
      everyone: process.env.RATE_LIMIT_AUTO_COMPILE_EVERYONE || 100,
      standard: process.env.RATE_LIMIT_AUTO_COMPILE_STANDARD || 25,
    },
  },

  analytics: {
    enabled: false,
  },

  compileBodySizeLimitMb: process.env.COMPILE_BODY_SIZE_LIMIT_MB || 7,

  textExtensions: defaultTextExtensions.concat(
    parseTextExtensions(process.env.ADDITIONAL_TEXT_EXTENSIONS)
  ),

  validRootDocExtensions: ['tex', 'Rtex', 'ltx'],

  emailConfirmationDisabled:
    process.env.EMAIL_CONFIRMATION_DISABLED === 'true' || false,

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
          col: ['width'],
          figure: ['class', 'id', 'style'],
          figcaption: ['class', 'id', 'style'],
          i: ['aria-hidden', 'aria-label', 'class', 'id'],
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
          video: ['alt', 'class', 'controls', 'height', 'width'],
        },
      },
    },
  },

  overleafModuleImports: {
    // modules to import (an empty array for each set of modules)
    createFileModes: [],
    gitBridge: [],
    publishModal: [],
    tprLinkedFileInfo: [],
    tprLinkedFileRefreshError: [],
    contactUsModal: [],
    editorToolbarButtons: [],
    sourceEditorExtensions: [],
    sourceEditorComponents: [],
    sourceEditorCompletionSources: [],
    integrationLinkingWidgets: [],
    referenceLinkingWidgets: [],
    importProjectFromGithubModalWrapper: [],
    importProjectFromGithubMenu: [],
    editorLeftMenuSync: [],
    editorLeftMenuManageTemplate: [],
  },

  moduleImportSequence: [
    'launchpad',
    'server-ce-scripts',
    'user-activate',
    'history-migration',
  ],

  csp: {
    enabled: process.env.CSP_ENABLED === 'true',
    reportOnly: process.env.CSP_REPORT_ONLY === 'true',
    reportPercentage: parseFloat(process.env.CSP_REPORT_PERCENTAGE) || 0,
    reportUri: process.env.CSP_REPORT_URI,
    exclude: ['app/views/project/editor', 'app/views/project/list'],
  },

  unsupportedBrowsers: {
    ie: '<=11',
  },

  // ID of the IEEE brand in the rails app
  ieeeBrandId: intFromEnv('IEEE_BRAND_ID', 15),
}

module.exports.mergeWith = function (overrides) {
  return merge(overrides, module.exports)
}
