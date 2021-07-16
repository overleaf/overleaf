module.exports = {
  internal: {
    documentupdater: {
      host: process.env.LISTEN_ADDRESS || 'localhost',
      port: 3003,
    },
  },

  apis: {
    web: {
      url: `http://${
        process.env.WEB_API_HOST || process.env.WEB_HOST || 'localhost'
      }:${process.env.WEB_API_PORT || process.env.WEB_PORT || 3000}`,
      user: process.env.WEB_API_USER || 'sharelatex',
      pass: process.env.WEB_API_PASSWORD || 'password',
    },
    trackchanges: {
      url: `http://${process.env.TRACK_CHANGES_HOST || 'localhost'}:3015`,
    },
    project_history: {
      enabled: true,
      url: `http://${process.env.PROJECT_HISTORY_HOST || 'localhost'}:3054`,
    },
  },

  redis: {
    pubsub: {
      host:
        process.env.PUBSUB_REDIS_HOST || process.env.REDIS_HOST || 'localhost',
      port: process.env.PUBSUB_REDIS_PORT || process.env.REDIS_PORT || '6379',
      password:
        process.env.PUBSUB_REDIS_PASSWORD || process.env.REDIS_PASSWORD || '',
      maxRetriesPerRequest: parseInt(
        process.env.REDIS_MAX_RETRIES_PER_REQUEST || '20'
      ),
    },

    history: {
      port: process.env.HISTORY_REDIS_PORT || process.env.REDIS_PORT || '6379',
      host:
        process.env.HISTORY_REDIS_HOST || process.env.REDIS_HOST || 'localhost',
      password:
        process.env.HISTORY_REDIS_PASSWORD || process.env.REDIS_PASSWORD || '',
      maxRetriesPerRequest: parseInt(
        process.env.REDIS_MAX_RETRIES_PER_REQUEST || '20'
      ),
      key_schema: {
        uncompressedHistoryOps({ doc_id: docId }) {
          return `UncompressedHistoryOps:{${docId}}`
        },
        docsWithHistoryOps({ project_id: projectId }) {
          return `DocsWithHistoryOps:{${projectId}}`
        },
      },
    },

    project_history: {
      port:
        process.env.NEW_HISTORY_REDIS_PORT || process.env.REDIS_PORT || '6379',
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
        projectHistoryOps({ project_id: projectId }) {
          return `ProjectHistory:Ops:{${projectId}}`
        },
        projectHistoryFirstOpTimestamp({ project_id: projectId }) {
          return `ProjectHistory:FirstOpTimestamp:{${projectId}}`
        },
      },
    },

    lock: {
      port: process.env.LOCK_REDIS_PORT || process.env.REDIS_PORT || '6379',
      host:
        process.env.LOCK_REDIS_HOST || process.env.REDIS_HOST || 'localhost',
      password:
        process.env.LOCK_REDIS_PASSWORD || process.env.REDIS_PASSWORD || '',
      maxRetriesPerRequest: parseInt(
        process.env.REDIS_MAX_RETRIES_PER_REQUEST || '20'
      ),
      key_schema: {
        blockingKey({ doc_id: docId }) {
          return `Blocking:{${docId}}`
        },
      },
    },

    documentupdater: {
      port:
        process.env.DOC_UPDATER_REDIS_PORT || process.env.REDIS_PORT || '6379',
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
        blockingKey({ doc_id: docId }) {
          return `Blocking:{${docId}}`
        },
        docLines({ doc_id: docId }) {
          return `doclines:{${docId}}`
        },
        docOps({ doc_id: docId }) {
          return `DocOps:{${docId}}`
        },
        docVersion({ doc_id: docId }) {
          return `DocVersion:{${docId}}`
        },
        docHash({ doc_id: docId }) {
          return `DocHash:{${docId}}`
        },
        projectKey({ doc_id: docId }) {
          return `ProjectId:{${docId}}`
        },
        docsInProject({ project_id: projectId }) {
          return `DocsIn:{${projectId}}`
        },
        ranges({ doc_id: docId }) {
          return `Ranges:{${docId}}`
        },
        unflushedTime({ doc_id: docId }) {
          return `UnflushedTime:{${docId}}`
        },
        pathname({ doc_id: docId }) {
          return `Pathname:{${docId}}`
        },
        projectHistoryId({ doc_id: docId }) {
          return `ProjectHistoryId:{${docId}}`
        },
        projectHistoryType({ doc_id: docId }) {
          return `ProjectHistoryType:{${docId}}`
        },
        projectState({ project_id: projectId }) {
          return `ProjectState:{${projectId}}`
        },
        pendingUpdates({ doc_id: docId }) {
          return `PendingUpdates:{${docId}}`
        },
        lastUpdatedBy({ doc_id: docId }) {
          return `lastUpdatedBy:{${docId}}`
        },
        lastUpdatedAt({ doc_id: docId }) {
          return `lastUpdatedAt:{${docId}}`
        },
        flushAndDeleteQueue() {
          return 'DocUpdaterFlushAndDeleteQueue'
        },
      },
    },
  },

  max_doc_length: 2 * 1024 * 1024, // 2mb
  maxJsonRequestSize:
    parseInt(process.env.MAX_JSON_REQUEST_SIZE, 10) || 8 * 1024 * 1024,

  dispatcherCount: parseInt(process.env.DISPATCHER_COUNT || 10, 10),

  mongo: {
    options: {
      useUnifiedTopology:
        (process.env.MONGO_USE_UNIFIED_TOPOLOGY || 'true') === 'true',
    },
    url:
      process.env.MONGO_CONNECTION_STRING ||
      `mongodb://${process.env.MONGO_HOST || '127.0.0.1'}/sharelatex`,
  },

  sentry: {
    dsn: process.env.SENTRY_DSN,
  },

  publishOnIndividualChannels:
    process.env.PUBLISH_ON_INDIVIDUAL_CHANNELS || false,

  continuousBackgroundFlush: process.env.CONTINUOUS_BACKGROUND_FLUSH || false,

  smoothingOffset: process.env.SMOOTHING_OFFSET || 1000, // milliseconds

  disableDoubleFlush: process.env.DISABLE_DOUBLE_FLUSH || false, // don't flush track-changes for projects using project-history
}
