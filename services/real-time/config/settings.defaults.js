const settings = {
  redis: {
    pubsub: {
      host:
        process.env.PUBSUB_REDIS_HOST || process.env.REDIS_HOST || 'localhost',
      port: process.env.PUBSUB_REDIS_PORT || process.env.REDIS_PORT || '6379',
      password:
        process.env.PUBSUB_REDIS_PASSWORD || process.env.REDIS_PASSWORD || '',
      maxRetriesPerRequest: parseInt(
        process.env.PUBSUB_REDIS_MAX_RETRIES_PER_REQUEST ||
          process.env.REDIS_MAX_RETRIES_PER_REQUEST ||
          '20'
      )
    },

    realtime: {
      host:
        process.env.REAL_TIME_REDIS_HOST ||
        process.env.REDIS_HOST ||
        'localhost',
      port:
        process.env.REAL_TIME_REDIS_PORT || process.env.REDIS_PORT || '6379',
      password:
        process.env.REAL_TIME_REDIS_PASSWORD ||
        process.env.REDIS_PASSWORD ||
        '',
      key_schema: {
        clientsInProject({ project_id }) {
          return `clients_in_project:{${project_id}}`
        },
        connectedUser({ project_id, client_id }) {
          return `connected_user:{${project_id}}:${client_id}`
        }
      },
      maxRetriesPerRequest: parseInt(
        process.env.REAL_TIME_REDIS_MAX_RETRIES_PER_REQUEST ||
          process.env.REDIS_MAX_RETRIES_PER_REQUEST ||
          '20'
      )
    },

    documentupdater: {
      host:
        process.env.DOC_UPDATER_REDIS_HOST ||
        process.env.REDIS_HOST ||
        'localhost',
      port:
        process.env.DOC_UPDATER_REDIS_PORT || process.env.REDIS_PORT || '6379',
      password:
        process.env.DOC_UPDATER_REDIS_PASSWORD ||
        process.env.REDIS_PASSWORD ||
        '',
      key_schema: {
        pendingUpdates({ doc_id }) {
          return `PendingUpdates:{${doc_id}}`
        }
      },
      maxRetriesPerRequest: parseInt(
        process.env.DOC_UPDATER_REDIS_MAX_RETRIES_PER_REQUEST ||
          process.env.REDIS_MAX_RETRIES_PER_REQUEST ||
          '20'
      )
    },

    websessions: {
      host: process.env.WEB_REDIS_HOST || process.env.REDIS_HOST || 'localhost',
      port: process.env.WEB_REDIS_PORT || process.env.REDIS_PORT || '6379',
      password:
        process.env.WEB_REDIS_PASSWORD || process.env.REDIS_PASSWORD || '',
      maxRetriesPerRequest: parseInt(
        process.env.WEB_REDIS_MAX_RETRIES_PER_REQUEST ||
          process.env.REDIS_MAX_RETRIES_PER_REQUEST ||
          '20'
      )
    }
  },

  internal: {
    realTime: {
      port: 3026,
      host: process.env.LISTEN_ADDRESS || 'localhost',
      user: 'sharelatex',
      pass: 'password'
    }
  },

  apis: {
    web: {
      url: `http://${
        process.env.WEB_API_HOST || process.env.WEB_HOST || 'localhost'
      }:${process.env.WEB_API_PORT || process.env.WEB_PORT || 3000}`,
      user: process.env.WEB_API_USER || 'sharelatex',
      pass: process.env.WEB_API_PASSWORD || 'password'
    },
    documentupdater: {
      url: `http://${
        process.env.DOCUMENT_UPDATER_HOST ||
        process.env.DOCUPDATER_HOST ||
        'localhost'
      }:3003`
    }
  },

  security: {
    sessionSecret: process.env.SESSION_SECRET || 'secret-please-change'
  },

  cookieName: process.env.COOKIE_NAME || 'sharelatex.sid',

  max_doc_length: 2 * 1024 * 1024, // 2mb

  // combine
  // max_doc_length (2mb see above) * 2 (delete + insert)
  // max_ranges_size (3mb see MAX_RANGES_SIZE in document-updater)
  // overhead for JSON serialization
  maxUpdateSize:
    parseInt(process.env.MAX_UPDATE_SIZE) || 7 * 1024 * 1024 + 64 * 1024,

  shutdownDrainTimeWindow: process.env.SHUTDOWN_DRAIN_TIME_WINDOW || 9,

  continualPubsubTraffic: process.env.CONTINUAL_PUBSUB_TRAFFIC || false,

  checkEventOrder: process.env.CHECK_EVENT_ORDER || false,

  publishOnIndividualChannels:
    process.env.PUBLISH_ON_INDIVIDUAL_CHANNELS || false,

  statusCheckInterval: parseInt(process.env.STATUS_CHECK_INTERVAL || '0'),

  sentry: {
    dsn: process.env.SENTRY_DSN
  },

  errors: {
    catchUncaughtErrors: true,
    shutdownOnUncaughtError: true
  }
}

// console.log settings.redis
module.exports = settings
