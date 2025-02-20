/* eslint-disable
    camelcase,
    no-cond-assign,
    no-dupe-keys,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let redisConfig, siteUrl
let e
const Path = require('path')

// These credentials are used for authenticating api requests
// between services that may need to go over public channels
const httpAuthUser = process.env.WEB_API_USER
const httpAuthPass = process.env.WEB_API_PASSWORD
const httpAuthUsers = {}
if (httpAuthUser && httpAuthPass) {
  httpAuthUsers[httpAuthUser] = httpAuthPass
}

const parse = function (option) {
  if (option != null) {
    try {
      const opt = JSON.parse(option)
      return opt
    } catch (err) {
      throw new Error(`problem parsing ${option}, invalid JSON`)
    }
  }
}

const parseIntOrFail = function (value) {
  const parsedValue = parseInt(value, 10)
  if (isNaN(parsedValue)) {
    throw new Error(`'${value}' is an invalid integer`)
  }
  return parsedValue
}

const DATA_DIR = '/var/lib/overleaf/data'
const TMP_DIR = '/var/lib/overleaf/tmp'

const settings = {
  clsi: {
    optimiseInDocker: process.env.OPTIMISE_PDF === 'true',
  },

  brandPrefix: '',

  allowAnonymousReadAndWriteSharing:
    process.env.OVERLEAF_ALLOW_ANONYMOUS_READ_AND_WRITE_SHARING === 'true',

  // Databases
  // ---------

  // Overleaf Community Edition's main persistent data store is MongoDB (http://www.mongodb.org/)
  // Documentation about the URL connection string format can be found at:
  //
  //    http://docs.mongodb.org/manual/reference/connection-string/
  //
  // The following works out of the box with Mongo's default settings:
  mongo: {
    url: process.env.OVERLEAF_MONGO_URL || 'mongodb://dockerhost/sharelatex',
  },

  // Redis is used in Overleaf Community Edition for high volume queries, like real-time
  // editing, and session management.
  //
  // The following config will work with Redis's default settings:
  redis: {
    web: (redisConfig = {
      host: process.env.OVERLEAF_REDIS_HOST || 'dockerhost',
      port: process.env.OVERLEAF_REDIS_PORT || '6379',
      password: process.env.OVERLEAF_REDIS_PASS || undefined,
      key_schema: {
        // document-updater
        blockingKey({ doc_id }) {
          return `Blocking:${doc_id}`
        },
        docLines({ doc_id }) {
          return `doclines:${doc_id}`
        },
        docOps({ doc_id }) {
          return `DocOps:${doc_id}`
        },
        docVersion({ doc_id }) {
          return `DocVersion:${doc_id}`
        },
        docHash({ doc_id }) {
          return `DocHash:${doc_id}`
        },
        projectKey({ doc_id }) {
          return `ProjectId:${doc_id}`
        },
        docsInProject({ project_id }) {
          return `DocsIn:${project_id}`
        },
        ranges({ doc_id }) {
          return `Ranges:${doc_id}`
        },
        // document-updater:realtime
        pendingUpdates({ doc_id }) {
          return `PendingUpdates:${doc_id}`
        },
        // document-updater:history
        uncompressedHistoryOps({ doc_id }) {
          return `UncompressedHistoryOps:${doc_id}`
        },
        docsWithHistoryOps({ project_id }) {
          return `DocsWithHistoryOps:${project_id}`
        },
        // document-updater:lock
        blockingKey({ doc_id }) {
          return `Blocking:${doc_id}`
        },
        // realtime
        clientsInProject({ project_id }) {
          return `clients_in_project:${project_id}`
        },
        connectedUser({ project_id, client_id }) {
          return `connected_user:${project_id}:${client_id}`
        },
      },
    }),
    fairy: redisConfig,
    // document-updater
    realtime: redisConfig,
    documentupdater: redisConfig,
    lock: redisConfig,
    history: redisConfig,
    websessions: redisConfig,
    api: redisConfig,
    pubsub: redisConfig,
    project_history: redisConfig,

    project_history_migration: {
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      maxRetriesPerRequest: parseInt(
        process.env.REDIS_MAX_RETRIES_PER_REQUEST || '20'
      ),
      key_schema: {
        projectHistoryOps({ projectId }) {
          return `ProjectHistory:Ops:{${projectId}}` // NOTE: the extra braces are intentional
        },
      },
    },
  },

  // Local disk caching
  // ------------------
  path: {
    // If we ever need to write something to disk (e.g. incoming requests
    // that need processing but may be too big for memory), then write
    // them to disk here:
    dumpFolder: Path.join(TMP_DIR, 'dumpFolder'),
    // Where to write uploads before they are processed
    uploadFolder: Path.join(TMP_DIR, 'uploads'),
    // Where to write intermediate file for full project history migration
    projectHistories: Path.join(TMP_DIR, 'projectHistories'),
    // Where to write the project to disk before running LaTeX on it
    compilesDir: Path.join(DATA_DIR, 'compiles'),
    // Where to cache downloaded URLs for the CLSI
    clsiCacheDir: Path.join(DATA_DIR, 'cache'),
    // Where to write the output files to disk after running LaTeX
    outputDir: Path.join(DATA_DIR, 'output'),
  },

  // Server Config
  // -------------

  // Where your instance of Overleaf Community Edition can be found publicly. This is used
  // when emails are sent out and in generated links:
  siteUrl: (siteUrl = process.env.OVERLEAF_SITE_URL || 'http://localhost'),

  // Status page URL as displayed on the maintenance/500 pages.
  statusPageUrl: process.env.OVERLEAF_STATUS_PAGE_URL,

  // The name this is used to describe your Overleaf Community Edition Installation
  appName: process.env.OVERLEAF_APP_NAME || 'Overleaf Community Edition',

  restrictInvitesToExistingAccounts:
    process.env.OVERLEAF_RESTRICT_INVITES_TO_EXISTING_ACCOUNTS === 'true',

  nav: {
    title:
      process.env.OVERLEAF_NAV_TITLE ||
      process.env.OVERLEAF_APP_NAME ||
      'Overleaf Community Edition',
  },

  // The email address which users will be directed to as the main point of
  // contact for this installation of Overleaf Community Edition.
  adminEmail: process.env.OVERLEAF_ADMIN_EMAIL || 'placeholder@example.com',

  // If provided, a sessionSecret is used to sign cookies so that they cannot be
  // spoofed. This is recommended.
  security: {
    sessionSecret:
      process.env.OVERLEAF_SESSION_SECRET || process.env.CRYPTO_RANDOM,
  },

  csp: {
    enabled: process.env.OVERLEAF_CSP_ENABLED !== 'false',
  },

  rateLimit: {
    subnetRateLimiterDisabled:
      process.env.SUBNET_RATE_LIMITER_DISABLED !== 'false',
  },

  // These credentials are used for authenticating api requests
  // between services that may need to go over public channels
  httpAuthUsers,

  // Should javascript assets be served minified or not.
  useMinifiedJs: true,

  // Should static assets be sent with a header to tell the browser to cache
  // them. This should be false in development where changes are being made,
  // but should be set to true in production.
  cacheStaticAssets: true,

  // If you are running Overleaf Community Edition over https, set this to true to send the
  // cookie with a secure flag (recommended).
  secureCookie: process.env.OVERLEAF_SECURE_COOKIE != null,

  // If you are running Overleaf Community Edition behind a proxy (like Apache, Nginx, etc)
  // then set this to true to allow it to correctly detect the forwarded IP
  // address and http/https protocol information.

  behindProxy: process.env.OVERLEAF_BEHIND_PROXY || false,
  trustedProxyIps: process.env.OVERLEAF_TRUSTED_PROXY_IPS,

  // The amount of time, in milliseconds, until the (rolling) cookie session expires
  cookieSessionLength: parseInt(
    process.env.OVERLEAF_COOKIE_SESSION_LENGTH || 5 * 24 * 60 * 60 * 1000, // default 5 days
    10
  ),

  redisLockTTLSeconds: parseInt(
    process.env.OVERLEAF_REDIS_LOCK_TTL_SECONDS || '60',
    10
  ),

  i18n: {
    subdomainLang: {
      www: {
        lngCode: process.env.OVERLEAF_SITE_LANGUAGE || 'en',
        url: siteUrl,
      },
    },
    defaultLng: process.env.OVERLEAF_SITE_LANGUAGE || 'en',
  },

  currentImageName: process.env.TEX_LIVE_DOCKER_IMAGE,

  apis: {
    web: {
      url: 'http://127.0.0.1:3000',
      user: httpAuthUser,
      pass: httpAuthPass,
    },
    project_history: {
      sendProjectStructureOps: true,
      url: 'http://127.0.0.1:3054',
    },
    v1_history: {
      url: process.env.V1_HISTORY_URL || 'http://127.0.0.1:3100/api',
      user: 'staging',
      pass: process.env.STAGING_PASSWORD,
      requestTimeout: parseInt(
        process.env.OVERLEAF_HISTORY_V1_HTTP_REQUEST_TIMEOUT || '300000', // default is 5min
        10
      ),
    },
  },
  references: {},
  notifications: undefined,

  defaultFeatures: {
    collaborators: -1,
    dropbox: true,
    versioning: true,
    compileTimeout: parseIntOrFail(process.env.COMPILE_TIMEOUT || 180),
    compileGroup: 'standard',
    trackChanges: true,
    references: true,
  },
}

// # OPTIONAL CONFIGURABLE SETTINGS

if (process.env.OVERLEAF_LEFT_FOOTER != null) {
  try {
    settings.nav.left_footer = JSON.parse(process.env.OVERLEAF_LEFT_FOOTER)
  } catch (error) {
    e = error
    console.error('could not parse OVERLEAF_LEFT_FOOTER, not valid JSON')
  }
}

if (process.env.OVERLEAF_RIGHT_FOOTER != null) {
  settings.nav.right_footer = process.env.OVERLEAF_RIGHT_FOOTER
  try {
    settings.nav.right_footer = JSON.parse(process.env.OVERLEAF_RIGHT_FOOTER)
  } catch (error1) {
    e = error1
    console.error('could not parse OVERLEAF_RIGHT_FOOTER, not valid JSON')
  }
}

if (process.env.OVERLEAF_HEADER_IMAGE_URL != null) {
  settings.nav.custom_logo = process.env.OVERLEAF_HEADER_IMAGE_URL
}

if (process.env.OVERLEAF_HEADER_EXTRAS != null) {
  try {
    settings.nav.header_extras = JSON.parse(process.env.OVERLEAF_HEADER_EXTRAS)
  } catch (error2) {
    e = error2
    console.error('could not parse OVERLEAF_HEADER_EXTRAS, not valid JSON')
  }
}

if (process.env.OVERLEAF_LOGIN_SUPPORT_TEXT != null) {
  settings.nav.login_support_text = process.env.OVERLEAF_LOGIN_SUPPORT_TEXT
}

if (process.env.OVERLEAF_LOGIN_SUPPORT_TITLE != null) {
  settings.nav.login_support_title = process.env.OVERLEAF_LOGIN_SUPPORT_TITLE
}

// Sending Email
// -------------
//
// You must configure a mail server to be able to send invite emails from
// Overleaf Community Edition. The config settings are passed to nodemailer. See the nodemailer
// documentation for available options:
//
//     http://www.nodemailer.com/docs/transports

if (process.env.OVERLEAF_EMAIL_FROM_ADDRESS != null) {
  settings.email = {
    fromAddress: process.env.OVERLEAF_EMAIL_FROM_ADDRESS,
    replyTo: process.env.OVERLEAF_EMAIL_REPLY_TO || '',
    driver: process.env.OVERLEAF_EMAIL_DRIVER,
    parameters: {
      // AWS Creds
      AWSAccessKeyID: process.env.OVERLEAF_EMAIL_AWS_SES_ACCESS_KEY_ID,
      AWSSecretKey: process.env.OVERLEAF_EMAIL_AWS_SES_SECRET_KEY,

      // SMTP Creds
      host: process.env.OVERLEAF_EMAIL_SMTP_HOST,
      port: process.env.OVERLEAF_EMAIL_SMTP_PORT,
      secure: parse(process.env.OVERLEAF_EMAIL_SMTP_SECURE),
      ignoreTLS: parse(process.env.OVERLEAF_EMAIL_SMTP_IGNORE_TLS),
      name: process.env.OVERLEAF_EMAIL_SMTP_NAME,
      logger: process.env.OVERLEAF_EMAIL_SMTP_LOGGER === 'true',
    },

    textEncoding: process.env.OVERLEAF_EMAIL_TEXT_ENCODING,
    template: {
      customFooter: process.env.OVERLEAF_CUSTOM_EMAIL_FOOTER,
    },
  }

  if (process.env.OVERLEAF_EMAIL_AWS_SES_REGION != null) {
    settings.email.parameters.region = process.env.OVERLEAF_EMAIL_AWS_SES_REGION
  }

  if (
    process.env.OVERLEAF_EMAIL_SMTP_USER != null ||
    process.env.OVERLEAF_EMAIL_SMTP_PASS != null
  ) {
    settings.email.parameters.auth = {
      user: process.env.OVERLEAF_EMAIL_SMTP_USER,
      pass: process.env.OVERLEAF_EMAIL_SMTP_PASS,
    }
  }

  if (process.env.OVERLEAF_EMAIL_SMTP_TLS_REJECT_UNAUTH != null) {
    settings.email.parameters.tls = {
      rejectUnauthorized: parse(
        process.env.OVERLEAF_EMAIL_SMTP_TLS_REJECT_UNAUTH
      ),
    }
  }
}

// i18n
if (process.env.OVERLEAF_LANG_DOMAIN_MAPPING != null) {
  settings.i18n.subdomainLang = parse(process.env.OVERLEAF_LANG_DOMAIN_MAPPING)
}

// Password Settings
// -----------
// These restrict the passwords users can use when registering
// opts are from http://antelle.github.io/passfield
if (
  process.env.OVERLEAF_PASSWORD_VALIDATION_PATTERN ||
  process.env.OVERLEAF_PASSWORD_VALIDATION_MIN_LENGTH ||
  process.env.OVERLEAF_PASSWORD_VALIDATION_MAX_LENGTH
) {
  settings.passwordStrengthOptions = {
    pattern: process.env.OVERLEAF_PASSWORD_VALIDATION_PATTERN || 'aA$3',
    length: {
      min: process.env.OVERLEAF_PASSWORD_VALIDATION_MIN_LENGTH || 8,
      max: process.env.OVERLEAF_PASSWORD_VALIDATION_MAX_LENGTH || 72,
    },
  }
}

// /References
// -----------
if (process.env.OVERLEAF_ELASTICSEARCH_URL != null) {
  settings.references.elasticsearch = {
    host: process.env.OVERLEAF_ELASTICSEARCH_URL,
  }
}

// filestore
switch (process.env.OVERLEAF_FILESTORE_BACKEND) {
  case 's3':
    settings.filestore = {
      backend: 's3',
      stores: {
        user_files: process.env.OVERLEAF_FILESTORE_USER_FILES_BUCKET_NAME,
        template_files:
          process.env.OVERLEAF_FILESTORE_TEMPLATE_FILES_BUCKET_NAME,
      },
      s3: {
        key:
          process.env.OVERLEAF_FILESTORE_S3_ACCESS_KEY_ID ||
          process.env.AWS_ACCESS_KEY_ID,
        secret:
          process.env.OVERLEAF_FILESTORE_S3_SECRET_ACCESS_KEY ||
          process.env.AWS_SECRET_ACCESS_KEY,
        endpoint: process.env.OVERLEAF_FILESTORE_S3_ENDPOINT,
        pathStyle: process.env.OVERLEAF_FILESTORE_S3_PATH_STYLE === 'true',
        region:
          process.env.OVERLEAF_FILESTORE_S3_REGION ||
          process.env.AWS_DEFAULT_REGION,
      },
    }
    break
  default:
    settings.filestore = {
      backend: 'fs',
      stores: {
        user_files: Path.join(DATA_DIR, 'user_files'),
        template_files: Path.join(DATA_DIR, 'template_files'),
      },
    }
}

// With lots of incoming and outgoing HTTP connections to different services,
// sometimes long running, it is a good idea to increase the default number
// of sockets that Node will hold open.
const http = require('http')
http.globalAgent.maxSockets = 300
const https = require('https')
https.globalAgent.maxSockets = 300

module.exports = settings
