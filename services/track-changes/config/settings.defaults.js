const Path = require('path')
const TMP_DIR =
  process.env.TMP_PATH || Path.resolve(Path.join(__dirname, '../../', 'tmp'))

module.exports = {
  mongo: {
    url:
      process.env.MONGO_CONNECTION_STRING ||
      `mongodb://${process.env.MONGO_HOST || 'localhost'}/sharelatex`
  },

  internal: {
    trackchanges: {
      port: 3015,
      host: process.env.LISTEN_ADDRESS || 'localhost'
    }
  },
  apis: {
    documentupdater: {
      url: `http://${
        process.env.DOCUMENT_UPDATER_HOST ||
        process.env.DOCUPDATER_HOST ||
        'localhost'
      }:3003`
    },
    docstore: {
      url: `http://${process.env.DOCSTORE_HOST || 'localhost'}:3016`
    },
    web: {
      url: `http://${
        process.env.WEB_API_HOST || process.env.WEB_HOST || 'localhost'
      }:${process.env.WEB_API_PORT || process.env.WEB_PORT || 3000}`,
      user: process.env.WEB_API_USER || 'sharelatex',
      pass: process.env.WEB_API_PASSWORD || 'password'
    }
  },
  redis: {
    lock: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || '',
      key_schema: {
        historyLock({ doc_id }) {
          return `HistoryLock:{${doc_id}}`
        },
        historyIndexLock({ project_id }) {
          return `HistoryIndexLock:{${project_id}}`
        }
      }
    },
    history: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || '',
      key_schema: {
        uncompressedHistoryOps({ doc_id }) {
          return `UncompressedHistoryOps:{${doc_id}}`
        },
        docsWithHistoryOps({ project_id }) {
          return `DocsWithHistoryOps:{${project_id}}`
        }
      }
    }
  },

  trackchanges: {
    s3: {
      key: process.env.AWS_ACCESS_KEY_ID,
      secret: process.env.AWS_SECRET_ACCESS_KEY,
      endpoint: process.env.AWS_S3_ENDPOINT,
      pathStyle: process.env.AWS_S3_PATH_STYLE === 'true'
    },
    stores: {
      doc_history: process.env.AWS_BUCKET
    },
    continueOnError: process.env.TRACK_CHANGES_CONTINUE_ON_ERROR || false
  },

  path: {
    dumpFolder: Path.join(TMP_DIR, 'dumpFolder')
  },

  sentry: {
    dsn: process.env.SENTRY_DSN
  }
}
