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
const httpAuthUser = 'sharelatex'
const httpAuthPass = process.env.WEB_API_PASSWORD
const httpAuthUsers = {}
httpAuthUsers[httpAuthUser] = httpAuthPass

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

const DATA_DIR = '/var/lib/sharelatex/data'
const TMP_DIR = '/var/lib/sharelatex/tmp'

const settings = {
  clsi: {
    optimiseInDocker: process.env.OPTIMISE_PDF === 'true',
  },

  brandPrefix: '',

  allowAnonymousReadAndWriteSharing:
    process.env.SHARELATEX_ALLOW_ANONYMOUS_READ_AND_WRITE_SHARING === 'true',

  // Databases
  // ---------

  // ShareLaTeX's main persistent data store is MongoDB (http://www.mongodb.org/)
  // Documentation about the URL connection string format can be found at:
  //
  //    http://docs.mongodb.org/manual/reference/connection-string/
  //
  // The following works out of the box with Mongo's default settings:
  mongo: {
    url: process.env.SHARELATEX_MONGO_URL || 'mongodb://dockerhost/sharelatex',
  },

  // Redis is used in ShareLaTeX for high volume queries, like real-time
  // editing, and session management.
  //
  // The following config will work with Redis's default settings:
  redis: {
    web: (redisConfig = {
      host: process.env.SHARELATEX_REDIS_HOST || 'dockerhost',
      port: process.env.SHARELATEX_REDIS_PORT || '6379',
      password: process.env.SHARELATEX_REDIS_PASS || undefined,
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
        // track-changes:lock
        historyLock({ doc_id }) {
          return `HistoryLock:${doc_id}`
        },
        historyIndexLock({ project_id }) {
          return `HistoryIndexLock:${project_id}`
        },
        // track-changes:history
        uncompressedHistoryOps({ doc_id }) {
          return `UncompressedHistoryOps:${doc_id}`
        },
        docsWithHistoryOps({ project_id }) {
          return `DocsWithHistoryOps:${project_id}`
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
    // track-changes and document-updater
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

  trackchanges: {
    continueOnError: true,
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

  // Where your instance of ShareLaTeX can be found publicly. This is used
  // when emails are sent out and in generated links:
  siteUrl: (siteUrl = process.env.SHARELATEX_SITE_URL || 'http://localhost'),

  // Status page URL as displayed on the maintenance/500 pages.
  statusPageUrl: process.env.SHARELATEX_STATUS_PAGE_URL,

  // The name this is used to describe your ShareLaTeX Installation
  appName: process.env.SHARELATEX_APP_NAME || 'ShareLaTeX (Community Edition)',

  restrictInvitesToExistingAccounts:
    process.env.SHARELATEX_RESTRICT_INVITES_TO_EXISTING_ACCOUNTS === 'true',

  nav: {
    title:
      process.env.SHARELATEX_NAV_TITLE ||
      process.env.SHARELATEX_APP_NAME ||
      'ShareLaTeX Community Edition',
  },

  // The email address which users will be directed to as the main point of
  // contact for this installation of ShareLaTeX.
  adminEmail: process.env.SHARELATEX_ADMIN_EMAIL || 'placeholder@example.com',

  // If provided, a sessionSecret is used to sign cookies so that they cannot be
  // spoofed. This is recommended.
  security: {
    sessionSecret:
      process.env.SHARELATEX_SESSION_SECRET || process.env.CRYPTO_RANDOM,
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

  // If you are running ShareLaTeX over https, set this to true to send the
  // cookie with a secure flag (recommended).
  secureCookie: process.env.SHARELATEX_SECURE_COOKIE != null,

  // If you are running ShareLaTeX behind a proxy (like Apache, Nginx, etc)
  // then set this to true to allow it to correctly detect the forwarded IP
  // address and http/https protocol information.

  behindProxy: process.env.SHARELATEX_BEHIND_PROXY || false,

  i18n: {
    subdomainLang: {
      www: {
        lngCode: process.env.SHARELATEX_SITE_LANGUAGE || 'en',
        url: siteUrl,
      },
    },
    defaultLng: process.env.SHARELATEX_SITE_LANGUAGE || 'en',
  },

  currentImageName: process.env.TEX_LIVE_DOCKER_IMAGE,

  apis: {
    web: {
      url: 'http://localhost:3000',
      user: httpAuthUser,
      pass: httpAuthPass,
    },
    project_history: {
      sendProjectStructureOps: true,
      initializeHistoryForNewProjects: process.env.SHARELATEX_FPH_INITIALIZE_NEW_PROJECTS === 'true',
      displayHistoryForNewProjects: process.env.SHARELATEX_FPH_DISPLAY_NEW_PROJECTS === 'true',
      url: 'http://localhost:3054',
    },
    v1_history: {
      url: process.env.V1_HISTORY_URL || 'http://localhost:3100/api',
      user: 'staging',
      pass: process.env.STAGING_PASSWORD,
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
    templates: true,
    references: true,
  },
}

// # OPTIONAL CONFIGURABLE SETTINGS

if (process.env.SHARELATEX_LEFT_FOOTER != null) {
  try {
    settings.nav.left_footer = JSON.parse(process.env.SHARELATEX_LEFT_FOOTER)
  } catch (error) {
    e = error
    console.error('could not parse SHARELATEX_LEFT_FOOTER, not valid JSON')
  }
}

if (process.env.SHARELATEX_RIGHT_FOOTER != null) {
  settings.nav.right_footer = process.env.SHARELATEX_RIGHT_FOOTER
  try {
    settings.nav.right_footer = JSON.parse(process.env.SHARELATEX_RIGHT_FOOTER)
  } catch (error1) {
    e = error1
    console.error('could not parse SHARELATEX_RIGHT_FOOTER, not valid JSON')
  }
}

if (process.env.SHARELATEX_HEADER_IMAGE_URL != null) {
  settings.nav.custom_logo = process.env.SHARELATEX_HEADER_IMAGE_URL
}

if (process.env.SHARELATEX_HEADER_NAV_LINKS != null) {
  console.error(`\
# # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
#
#  WARNING: SHARELATEX_HEADER_NAV_LINKS is no longer supported
#  See https://github.com/sharelatex/sharelatex/wiki/Configuring-Headers,-Footers-&-Logo
#
# # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #\
`)
}

if (process.env.SHARELATEX_HEADER_EXTRAS != null) {
  try {
    settings.nav.header_extras = JSON.parse(
      process.env.SHARELATEX_HEADER_EXTRAS
    )
  } catch (error2) {
    e = error2
    console.error('could not parse SHARELATEX_HEADER_EXTRAS, not valid JSON')
  }
}

// Sending Email
// -------------
//
// You must configure a mail server to be able to send invite emails from
// ShareLaTeX. The config settings are passed to nodemailer. See the nodemailer
// documentation for available options:
//
//     http://www.nodemailer.com/docs/transports

if (process.env.SHARELATEX_EMAIL_FROM_ADDRESS != null) {
  settings.email = {
    fromAddress: process.env.SHARELATEX_EMAIL_FROM_ADDRESS,
    replyTo: process.env.SHARELATEX_EMAIL_REPLY_TO || '',
    driver: process.env.SHARELATEX_EMAIL_DRIVER,
    parameters: {
      // AWS Creds
      AWSAccessKeyID: process.env.SHARELATEX_EMAIL_AWS_SES_ACCESS_KEY_ID,
      AWSSecretKey: process.env.SHARELATEX_EMAIL_AWS_SES_SECRET_KEY,

      // SMTP Creds
      host: process.env.SHARELATEX_EMAIL_SMTP_HOST,
      port: process.env.SHARELATEX_EMAIL_SMTP_PORT,
      secure: parse(process.env.SHARELATEX_EMAIL_SMTP_SECURE),
      ignoreTLS: parse(process.env.SHARELATEX_EMAIL_SMTP_IGNORE_TLS),
      name: process.env.SHARELATEX_EMAIL_SMTP_NAME,
      logger: process.env.SHARELATEX_EMAIL_SMTP_LOGGER === 'true',
    },

    textEncoding: process.env.SHARELATEX_EMAIL_TEXT_ENCODING,
    template: {
      customFooter: process.env.SHARELATEX_CUSTOM_EMAIL_FOOTER,
    },
  }

  if (process.env.SHARELATEX_EMAIL_AWS_SES_REGION != null) {
    settings.email.parameters.region =
      process.env.SHARELATEX_EMAIL_AWS_SES_REGION
  }

  if (
    process.env.SHARELATEX_EMAIL_SMTP_USER != null ||
    process.env.SHARELATEX_EMAIL_SMTP_PASS != null
  ) {
    settings.email.parameters.auth = {
      user: process.env.SHARELATEX_EMAIL_SMTP_USER,
      pass: process.env.SHARELATEX_EMAIL_SMTP_PASS,
    }
  }

  if (process.env.SHARELATEX_EMAIL_SMTP_TLS_REJECT_UNAUTH != null) {
    settings.email.parameters.tls = {
      rejectUnauthorized: parse(
        process.env.SHARELATEX_EMAIL_SMTP_TLS_REJECT_UNAUTH
      ),
    }
  }
}

// i18n
if (process.env.SHARELATEX_LANG_DOMAIN_MAPPING != null) {
  settings.i18n.subdomainLang = parse(
    process.env.SHARELATEX_LANG_DOMAIN_MAPPING
  )
}

// Password Settings
// -----------
// These restrict the passwords users can use when registering
// opts are from http://antelle.github.io/passfield
if (
  process.env.SHARELATEX_PASSWORD_VALIDATION_PATTERN ||
  process.env.SHARELATEX_PASSWORD_VALIDATION_MIN_LENGTH ||
  process.env.SHARELATEX_PASSWORD_VALIDATION_MAX_LENGTH
) {
  settings.passwordStrengthOptions = {
    pattern: process.env.SHARELATEX_PASSWORD_VALIDATION_PATTERN || 'aA$3',
    length: {
      min: process.env.SHARELATEX_PASSWORD_VALIDATION_MIN_LENGTH || 8,
      max: process.env.SHARELATEX_PASSWORD_VALIDATION_MAX_LENGTH || 150,
    },
  }
}

// ######################
// ShareLaTeX Server Pro
// ######################

if (parse(process.env.SHARELATEX_IS_SERVER_PRO) === true) {
  settings.bypassPercentageRollouts = true
  settings.apis.references = { url: 'http://localhost:3040' }
}

// LDAP - SERVER PRO ONLY
// ----------

if (process.env.SHARELATEX_LDAP_HOST) {
  console.error(`\
# # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
#
#  WARNING: The LDAP configuration format has changed in version 0.5.1
#  See https://github.com/sharelatex/sharelatex/wiki/Server-Pro:-LDAP-Config
#
# # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #\
`)
}

if (process.env.SHARELATEX_LDAP_URL) {
  let _ldap_connect_timeout,
    _ldap_group_search_attribs,
    _ldap_search_attribs,
    _ldap_timeout
  settings.externalAuth = true
  settings.ldap = {
    emailAtt: process.env.SHARELATEX_LDAP_EMAIL_ATT,
    nameAtt: process.env.SHARELATEX_LDAP_NAME_ATT,
    lastNameAtt: process.env.SHARELATEX_LDAP_LAST_NAME_ATT,
    updateUserDetailsOnLogin:
      process.env.SHARELATEX_LDAP_UPDATE_USER_DETAILS_ON_LOGIN === 'true',
    placeholder: process.env.SHARELATEX_LDAP_PLACEHOLDER,
    server: {
      url: process.env.SHARELATEX_LDAP_URL,
      bindDn: process.env.SHARELATEX_LDAP_BIND_DN,
      bindCredentials: process.env.SHARELATEX_LDAP_BIND_CREDENTIALS,
      bindProperty: process.env.SHARELATEX_LDAP_BIND_PROPERTY,
      searchBase: process.env.SHARELATEX_LDAP_SEARCH_BASE,
      searchScope: process.env.SHARELATEX_LDAP_SEARCH_SCOPE,
      searchFilter: process.env.SHARELATEX_LDAP_SEARCH_FILTER,
      searchAttributes: (_ldap_search_attribs =
        process.env.SHARELATEX_LDAP_SEARCH_ATTRIBUTES)
        ? (() => {
            try {
              return JSON.parse(_ldap_search_attribs)
            } catch (error3) {
              e = error3
              return console.error(
                'could not parse SHARELATEX_LDAP_SEARCH_ATTRIBUTES'
              )
            }
          })()
        : undefined,
      groupDnProperty: process.env.SHARELATEX_LDAP_GROUP_DN_PROPERTY,
      groupSearchBase: process.env.SHARELATEX_LDAP_GROUP_SEARCH_BASE,
      groupSearchScope: process.env.SHARELATEX_LDAP_GROUP_SEARCH_SCOPE,
      groupSearchFilter: process.env.SHARELATEX_LDAP_GROUP_SEARCH_FILTER,
      groupSearchAttributes: (_ldap_group_search_attribs =
        process.env.SHARELATEX_LDAP_GROUP_SEARCH_ATTRIBUTES)
        ? (() => {
            try {
              return JSON.parse(_ldap_group_search_attribs)
            } catch (error4) {
              e = error4
              return console.error(
                'could not parse SHARELATEX_LDAP_GROUP_SEARCH_ATTRIBUTES'
              )
            }
          })()
        : undefined,
      cache: process.env.SHARELATEX_LDAP_CACHE === 'true',
      timeout: (_ldap_timeout = process.env.SHARELATEX_LDAP_TIMEOUT)
        ? (() => {
            try {
              return parseIntOrFail(_ldap_timeout)
            } catch (error5) {
              e = error5
              return console.error('Cannot parse SHARELATEX_LDAP_TIMEOUT')
            }
          })()
        : undefined,
      connectTimeout: (_ldap_connect_timeout =
        process.env.SHARELATEX_LDAP_CONNECT_TIMEOUT)
        ? (() => {
            try {
              return parseIntOrFail(_ldap_connect_timeout)
            } catch (error6) {
              e = error6
              return console.error(
                'Cannot parse SHARELATEX_LDAP_CONNECT_TIMEOUT'
              )
            }
          })()
        : undefined,
    },
  }

  if (process.env.SHARELATEX_LDAP_TLS_OPTS_CA_PATH) {
    let ca, ca_paths
    try {
      ca = JSON.parse(process.env.SHARELATEX_LDAP_TLS_OPTS_CA_PATH)
    } catch (error7) {
      e = error7
      console.error(
        'could not parse SHARELATEX_LDAP_TLS_OPTS_CA_PATH, invalid JSON'
      )
    }

    if (typeof ca === 'string') {
      ca_paths = [ca]
    } else if (
      typeof ca === 'object' &&
      (ca != null ? ca.length : undefined) != null
    ) {
      ca_paths = ca
    } else {
      console.error('problem parsing SHARELATEX_LDAP_TLS_OPTS_CA_PATH')
    }

    settings.ldap.server.tlsOptions = {
      rejectUnauthorized:
        process.env.SHARELATEX_LDAP_TLS_OPTS_REJECT_UNAUTH === 'true',
      ca: ca_paths, // e.g.'/etc/ldap/ca_certs.pem'
    }
  }
}

if (process.env.SHARELATEX_SAML_ENTRYPOINT) {
  // NOTE: see https://github.com/node-saml/passport-saml/blob/master/README.md for docs of `server` options
  let _saml_additionalAuthorizeParams,
    _saml_additionalLogoutParams,
    _saml_additionalParams,
    _saml_expiration,
    _saml_skew
  settings.externalAuth = true
  settings.saml = {
    updateUserDetailsOnLogin:
      process.env.SHARELATEX_SAML_UPDATE_USER_DETAILS_ON_LOGIN === 'true',
    identityServiceName: process.env.SHARELATEX_SAML_IDENTITY_SERVICE_NAME,
    emailField:
      process.env.SHARELATEX_SAML_EMAIL_FIELD ||
      process.env.SHARELATEX_SAML_EMAIL_FIELD_NAME,
    firstNameField: process.env.SHARELATEX_SAML_FIRST_NAME_FIELD,
    lastNameField: process.env.SHARELATEX_SAML_LAST_NAME_FIELD,
    server: {
      // strings
      entryPoint: process.env.SHARELATEX_SAML_ENTRYPOINT,
      callbackUrl: process.env.SHARELATEX_SAML_CALLBACK_URL,
      issuer: process.env.SHARELATEX_SAML_ISSUER,
      decryptionPvk: process.env.SHARELATEX_SAML_DECRYPTION_PVK,
      decryptionCert: process.env.SHARELATEX_SAML_DECRYPTION_CERT,
      signingCert: process.env.SHARELATEX_SAML_SIGNING_CERT,
      signatureAlgorithm: process.env.SHARELATEX_SAML_SIGNATURE_ALGORITHM,
      identifierFormat: process.env.SHARELATEX_SAML_IDENTIFIER_FORMAT,
      attributeConsumingServiceIndex:
        process.env.SHARELATEX_SAML_ATTRIBUTE_CONSUMING_SERVICE_INDEX,
      authnContext:
        process.env.SHARELATEX_SAML_AUTHN_CONTEXT &&
        process.env.SHARELATEX_SAML_AUTHN_CONTEXT.split(','),
      authnRequestBinding: process.env.SHARELATEX_SAML_AUTHN_REQUEST_BINDING,
      validateInResponseTo: process.env.SHARELATEX_SAML_VALIDATE_IN_RESPONSE_TO,
      cacheProvider: process.env.SHARELATEX_SAML_CACHE_PROVIDER,
      logoutUrl: process.env.SHARELATEX_SAML_LOGOUT_URL,
      logoutCallbackUrl: process.env.SHARELATEX_SAML_LOGOUT_CALLBACK_URL,
      disableRequestedAuthnContext:
        process.env.SHARELATEX_SAML_DISABLE_REQUESTED_AUTHN_CONTEXT === 'true',
      forceAuthn: process.env.SHARELATEX_SAML_FORCE_AUTHN === 'true',
      skipRequestCompression:
        process.env.SHARELATEX_SAML_SKIP_REQUEST_COMPRESSION === 'true',
      acceptedClockSkewMs: (_saml_skew =
        process.env.SHARELATEX_SAML_ACCEPTED_CLOCK_SKEW_MS)
        ? (() => {
            try {
              return parseIntOrFail(_saml_skew)
            } catch (error8) {
              e = error8
              return console.error(
                'Cannot parse SHARELATEX_SAML_ACCEPTED_CLOCK_SKEW_MS'
              )
            }
          })()
        : undefined,
      requestIdExpirationPeriodMs: (_saml_expiration =
        process.env.SHARELATEX_SAML_REQUEST_ID_EXPIRATION_PERIOD_MS)
        ? (() => {
            try {
              return parseIntOrFail(_saml_expiration)
            } catch (error9) {
              e = error9
              return console.error(
                'Cannot parse SHARELATEX_SAML_REQUEST_ID_EXPIRATION_PERIOD_MS'
              )
            }
          })()
        : undefined,
      additionalParams: (_saml_additionalParams =
        process.env.SHARELATEX_SAML_ADDITIONAL_PARAMS)
        ? (() => {
            try {
              return JSON.parse(_saml_additionalParams)
            } catch (error10) {
              e = error10
              return console.error(
                'Cannot parse SHARELATEX_SAML_ADDITIONAL_PARAMS'
              )
            }
          })()
        : undefined,
      additionalAuthorizeParams: (_saml_additionalAuthorizeParams =
        process.env.SHARELATEX_SAML_ADDITIONAL_AUTHORIZE_PARAMS)
        ? (() => {
            try {
              return JSON.parse(_saml_additionalAuthorizeParams)
            } catch (error11) {
              e = error11
              return console.error(
                'Cannot parse SHARELATEX_SAML_ADDITIONAL_AUTHORIZE_PARAMS'
              )
            }
          })()
        : undefined,
      additionalLogoutParams: (_saml_additionalLogoutParams =
        process.env.SHARELATEX_SAML_ADDITIONAL_LOGOUT_PARAMS)
        ? (() => {
            try {
              return JSON.parse(_saml_additionalLogoutParams)
            } catch (error12) {
              e = error12
              return console.error(
                'Cannot parse SHARELATEX_SAML_ADDITIONAL_LOGOUT_PARAMS'
              )
            }
          })()
        : undefined,
    },
  }

  // SHARELATEX_SAML_CERT cannot be empty
  // https://github.com/node-saml/passport-saml/commit/f6b1c885c0717f1083c664345556b535f217c102
  if (process.env.SHARELATEX_SAML_CERT) {
    settings.saml.server.cert = process.env.SHARELATEX_SAML_CERT
    settings.saml.server.privateKey = process.env.SHARELATEX_SAML_PRIVATE_CERT
  }
}

// Compiler
// --------
if (process.env.SANDBOXED_COMPILES === 'true') {
  settings.clsi = {
    dockerRunner: true,
    docker: {
      image: process.env.TEX_LIVE_DOCKER_IMAGE,
      env: {
        HOME: '/tmp',
        PATH:
          process.env.COMPILER_PATH ||
          '/usr/local/texlive/2015/bin/x86_64-linux:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      },
      user: 'www-data',
    },
  }

  if (settings.path == null) {
    settings.path = {}
  }
  settings.path.synctexBaseDir = () => '/compile'
  if (process.env.SANDBOXED_COMPILES_SIBLING_CONTAINERS === 'true') {
    console.log('Using sibling containers for sandboxed compiles')
    if (process.env.SANDBOXED_COMPILES_HOST_DIR) {
      settings.path.sandboxedCompilesHostDir =
        process.env.SANDBOXED_COMPILES_HOST_DIR
    } else {
      console.error(
        'Sibling containers, but SANDBOXED_COMPILES_HOST_DIR not set'
      )
    }
  }
}

// Templates
// ---------
if (process.env.SHARELATEX_TEMPLATES_USER_ID) {
  settings.templates = {
    mountPointUrl: '/templates',
    user_id: process.env.SHARELATEX_TEMPLATES_USER_ID,
  }

  settings.templateLinks = parse(
    process.env.SHARELATEX_NEW_PROJECT_TEMPLATE_LINKS
  )
}

// /Learn
// -------
if (process.env.SHARELATEX_PROXY_LEARN != null) {
  settings.proxyLearn = parse(process.env.SHARELATEX_PROXY_LEARN)
  if (settings.proxyLearn) {
    settings.nav.header_extras = [
      {
        url: '/learn',
        text: 'documentation',
      },
    ].concat(settings.nav.header_extras || [])
  }
}

// /References
// -----------
if (process.env.SHARELATEX_ELASTICSEARCH_URL != null) {
  settings.references.elasticsearch = {
    host: process.env.SHARELATEX_ELASTICSEARCH_URL,
  }
}

// filestore
switch (process.env.SHARELATEX_FILESTORE_BACKEND) {
  case 's3':
    settings.filestore = {
      backend: 's3',
      stores: {
        user_files: process.env.SHARELATEX_FILESTORE_USER_FILES_BUCKET_NAME,
        template_files:
          process.env.SHARELATEX_FILESTORE_TEMPLATE_FILES_BUCKET_NAME,
      },
      s3: {
        key:
          process.env.SHARELATEX_FILESTORE_S3_ACCESS_KEY_ID ||
          process.env.AWS_ACCESS_KEY_ID,
        secret:
          process.env.SHARELATEX_FILESTORE_S3_SECRET_ACCESS_KEY ||
          process.env.AWS_SECRET_ACCESS_KEY,
        endpoint: process.env.SHARELATEX_FILESTORE_S3_ENDPOINT,
        pathStyle: process.env.SHARELATEX_FILESTORE_S3_PATH_STYLE === 'true',
        region:
          process.env.SHARELATEX_FILESTORE_S3_REGION ||
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
