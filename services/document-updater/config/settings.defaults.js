const Path = require('path')
const http = require('http')
http.globalAgent.maxSockets = 300

module.exports = {
  internal: {
    documentupdater: {
      host: process.env.LISTEN_ADDRESS || 'localhost',
      port: 3003
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
    trackchanges: {
      url: `http://${process.env.TRACK_CHANGES_HOST || 'localhost'}:3015`
    },
    project_history: {
      enabled: true,
      url: `http://${process.env.PROJECT_HISTORY_HOST || 'localhost'}:3054`
    }
  },

  redis: {
    pubsub: {
      host:
        process.env.PUBSUB_REDIS_HOST ||
        process.env.REDIS_HOST ||
        'localhost',
      port:
        process.env.PUBSUB_REDIS_PORT || process.env.REDIS_PORT || '6379',
      password:
        process.env.PUBSUB_REDIS_PASSWORD ||
        process.env.REDIS_PASSWORD ||
        '',
      maxRetriesPerRequest: parseInt(
        process.env.REDIS_MAX_RETRIES_PER_REQUEST || '20'
      )
    },

    history: {
      port:
        process.env.HISTORY_REDIS_PORT ||
        process.env.REDIS_PORT ||
        '6379',
      host:
        process.env.HISTORY_REDIS_HOST ||
        process.env.REDIS_HOST ||
        'localhost',
      password:
        process.env.HISTORY_REDIS_PASSWORD ||
        process.env.REDIS_PASSWORD ||
        '',
      maxRetriesPerRequest: parseInt(
        process.env.REDIS_MAX_RETRIES_PER_REQUEST || '20'
      ),
      key_schema: {
        uncompressedHistoryOps({ doc_id }) {
          return `UncompressedHistoryOps:{${doc_id}}`
        },
        docsWithHistoryOps({ project_id }) {
          return `DocsWithHistoryOps:{${project_id}}`
        }
      }
    },

    project_history: {
      port:
        process.env.NEW_HISTORY_REDIS_PORT ||
        process.env.REDIS_PORT ||
        '6379',
      host:
        process.env.NEW_HISTORY_REDIS_HOST ||
        process.env.REDIS_HOST ||
        'localhost',
      password:
        process.env.NEW_HISTORY_REDIS_PASSWORD ||
        process.env.REDIS_PASSWORD ||
        '',
      maxRetriesPerRequest: parseInt(
        process.env.REDIS_MAX_RETRIES_PER_REQUEST || '20'
      ),
      key_schema: {
        projectHistoryOps({ project_id }) {
          return `ProjectHistory:Ops:{${project_id}}`
        },
        projectHistoryFirstOpTimestamp({ project_id }) {
          return `ProjectHistory:FirstOpTimestamp:{${project_id}}`
        }
      }
    },

    lock: {
      port:
        process.env.LOCK_REDIS_PORT || process.env.REDIS_PORT || '6379',
      host:
        process.env.LOCK_REDIS_HOST ||
        process.env.REDIS_HOST ||
        'localhost',
      password:
        process.env.LOCK_REDIS_PASSWORD ||
        process.env.REDIS_PASSWORD ||
        '',
      maxRetriesPerRequest: parseInt(
        process.env.REDIS_MAX_RETRIES_PER_REQUEST || '20'
      ),
      key_schema: {
        blockingKey({ doc_id }) {
          return `Blocking:{${doc_id}}`
        }
      }
    },

    documentupdater: {
      port:
        process.env.DOC_UPDATER_REDIS_PORT ||
        process.env.REDIS_PORT ||
        '6379',
      host:
        process.env.DOC_UPDATER_REDIS_HOST ||
        process.env.REDIS_HOST ||
        'localhost',
      password:
        process.env.DOC_UPDATER_REDIS_PASSWORD ||
        process.env.REDIS_PASSWORD ||
        '',
      maxRetriesPerRequest: parseInt(
        process.env.REDIS_MAX_RETRIES_PER_REQUEST || '20'
      ),
      key_schema: {
        blockingKey({ doc_id }) {
          return `Blocking:{${doc_id}}`
        },
        docLines({ doc_id }) {
          return `doclines:{${doc_id}}`
        },
        docOps({ doc_id }) {
          return `DocOps:{${doc_id}}`
        },
        docVersion({ doc_id }) {
          return `DocVersion:{${doc_id}}`
        },
        docHash({ doc_id }) {
          return `DocHash:{${doc_id}}`
        },
        projectKey({ doc_id }) {
          return `ProjectId:{${doc_id}}`
        },
        docsInProject({ project_id }) {
          return `DocsIn:{${project_id}}`
        },
        ranges({ doc_id }) {
          return `Ranges:{${doc_id}}`
        },
        unflushedTime({ doc_id }) {
          return `UnflushedTime:{${doc_id}}`
        },
        pathname({ doc_id }) {
          return `Pathname:{${doc_id}}`
        },
        projectHistoryId({ doc_id }) {
          return `ProjectHistoryId:{${doc_id}}`
        },
        projectHistoryType({ doc_id }) {
          return `ProjectHistoryType:{${doc_id}}`
        },
        projectState({ project_id }) {
          return `ProjectState:{${project_id}}`
        },
        pendingUpdates({ doc_id }) {
          return `PendingUpdates:{${doc_id}}`
        },
        lastUpdatedBy({ doc_id }) {
          return `lastUpdatedBy:{${doc_id}}`
        },
        lastUpdatedAt({ doc_id }) {
          return `lastUpdatedAt:{${doc_id}}`
        },
        pendingUpdates({ doc_id }) {
          return `PendingUpdates:{${doc_id}}`
        },
        flushAndDeleteQueue() {
          return 'DocUpdaterFlushAndDeleteQueue'
        }
      }
    }
  },

  max_doc_length: 2 * 1024 * 1024, // 2mb

  dispatcherCount: process.env.DISPATCHER_COUNT,

  mongo: {
    url:
      process.env.MONGO_CONNECTION_STRING ||
      `mongodb://${process.env.MONGO_HOST || '127.0.0.1'}/sharelatex`
  },

  sentry: {
    dsn: process.env.SENTRY_DSN
  },

  publishOnIndividualChannels:
    process.env.PUBLISH_ON_INDIVIDUAL_CHANNELS || false,

  continuousBackgroundFlush:
    process.env.CONTINUOUS_BACKGROUND_FLUSH || false,

  smoothingOffset: process.env.SMOOTHING_OFFSET || 1000, // milliseconds

  disableDoubleFlush: process.env.DISABLE_DOUBLE_FLUSH || false // don't flush track-changes for projects using project-history
}
